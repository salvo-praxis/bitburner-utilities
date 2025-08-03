export async function main(ns) {
    const args = ns.flags([
        ["max-ram", 100],
        ["help", false],
    ]);

    if (args.help) {
        ns.tprint(`
auto-share.js - Dynamically spawns share.js to boost faction rep while working

Usage:
  run auto-share.js [--max-ram <percent>] [--help]

Modes:
  No flags            Use as much current RAM as possible at launch (does not adapt)
  --max-ram <percent> Use <percent> of TOTAL home RAM, adapting dynamically as free RAM changes

Options:
  --max-ram <percent>   Target percent of total RAM to dynamically allocate (default: 100%)
  --help                Show this help message
        `);
        return;
    }

    const shareScript = "/scripts/share.js";
    const updateInterval = 500;
    let isSharing = false;
    let lastThreads = 0;
    let lastUsedRam = 0;
    let lastCheckTime = 0;

    if (!ns.fileExists(shareScript, "home")) {
        ns.write(
            shareScript,
            `/** @param {NS} ns */ export async function main(ns) { while (true) { await ns.share(); await ns.sleep(1000); } }`,
            "w"
        );
        ns.tprint(`Created ${shareScript}`);
    }

    const dynamicMode = args["max-ram"] !== 100;

    ns.tprint(`Auto-share started in ${dynamicMode ? "adaptive" : "static"} mode with --max-ram ${args["max-ram"]}%`);

    while (true) {
        const totalRam = ns.getServerMaxRam("home");
        const usedRam = ns.getServerUsedRam("home");
        const shareRamCost = ns.getScriptRam(shareScript, "home") || 4;

        const player = ns.getPlayer();
        const workType = player.workType || "none";
        const isWorking = player.isWorking === true;
        const shouldShare = isWorking || !workType.toLowerCase().includes("idle");

        let maxThreads = 0;
        let usedRamForShare = 0;

        if (dynamicMode) {
            // Adaptive: allocate % of total RAM as free RAM becomes available
            const targetFraction = Math.max(0, Math.min(args["max-ram"], 100)) / 100;
            const targetRam = totalRam * targetFraction;
            const availableRam = Math.max(0, targetRam - usedRam);
            maxThreads = Math.floor(availableRam / shareRamCost);
            usedRamForShare = maxThreads * shareRamCost;
        } else {
            // Static: use all current available RAM *once* at launch, then lock
            if (!isSharing) {
                const availableRam = Math.max(0, totalRam - usedRam);
                maxThreads = Math.floor(availableRam / shareRamCost);
                usedRamForShare = maxThreads * shareRamCost;
            } else {
                maxThreads = lastThreads; // hold steady
            }
        }

        const now = Date.now();
        const ramDelta = usedRamForShare - lastUsedRam;
        const timeSinceLastCheck = now - lastCheckTime;

        const shouldRedeploy =
            !isSharing ||
            maxThreads !== lastThreads ||
            (dynamicMode && Math.abs(ramDelta) > 1 && timeSinceLastCheck > 5000);

        if (shouldShare && shouldRedeploy && maxThreads > 0) {
            if (isSharing) ns.kill(shareScript, "home");
            ns.exec(shareScript, "home", maxThreads);
            isSharing = true;
            lastThreads = maxThreads;
            lastUsedRam = usedRamForShare;
            lastCheckTime = now;
            ns.tprint(`Sharing with ${maxThreads} threads (~${usedRamForShare.toFixed(1)} GB). Work: ${workType}`);
        } else if (!shouldShare && isSharing) {
            ns.kill(shareScript, "home");
            isSharing = false;
            lastThreads = 0;
            ns.tprint("Stopped sharing: No faction work detected.");
        }

        await ns.sleep(updateInterval);
    }
}
