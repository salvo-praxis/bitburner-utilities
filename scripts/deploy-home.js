/** 
 * deploy-home.js
 * BIOS-format, colorized modular deployer, PRAAXIS_ALPHA standards.
 * v2.9.4 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage:
 *   run deploy-home.js [--max-ram <percent>] [--killall] [--help]
 */

/** @param {NS} ns **/
export async function main(ns) {
    const HOME = "home";
    const lowRamScript = "/scripts/hgw-lowram.js";
    const highRamScript = "/scripts/hgw-highram.js";
    const lowRamThreshold = 8; // GB
    const targetsFile = "/data/target-list.txt";
    const maxRetries = 5;
    const retryDelay = 500; // ms

    // Parse flags
    const args = ns.flags([
        ["max-ram", 100],
        ["killall", false],
        ["quiet", false],
        ["silent", false],
        ["help", false]
    ]);

    const c = {
        reset: "\u001b[0m",
        white: "\u001b[37m",
        red: "\u001b[31m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        cyan: "\u001b[36m",
        bold: "\u001b[1m",
        lgreen: "\u001b[92m",
        lcyan: "\u001b[96m"
    };
    const arrowCyan = c.cyan + "→" + c.reset;

    function biosMsg(type, msg, server = null, always = false) {
        if (args.silent && !always) return;
        let icon = arrowCyan, colorType = "";
        if (type === "INIT") colorType = c.cyan;
        else if (type === "SUCCESS") colorType = c.lgreen;
        else if (type === "SUMMARY") { icon = c.cyan + c.bold + "→" + c.reset; colorType = c.cyan; }
        else if (type === "TERMINATE") { icon = c.cyan + c.bold + "→" + c.reset; colorType = c.red; }
        // Order: [TYPE][SERVER]
        let tags = [];
        tags.push(c.white + "[" + colorType + type + c.reset + c.white + "]" + c.reset);
        if (server) tags.push(c.white + "[" + server + "]" + c.reset);
        ns.tprint(`${icon} ${tags.join("")} ${c.white}${msg}${c.reset}`);
    }

    function colorBySize(val) {
        if (val <= 8) return c.red;
        if (val <= 32) return c.yellow;
        if (val <= 128) return c.green;
        return c.lgreen;
    }

    function biosHeader() {
        if (args.silent) return;
        ns.tprint(
            c.yellow + "→ deploy-home.js: DEPLOY HOME ─ DISTRIBUTED HGW" + c.reset
        );
        ns.tprint(
            c.cyan + "→ Deploys optimized HGW scripts on home to all distributed targets." + c.reset
        );
    }

    function showHelp() {
        ns.tprint(
            `${c.bold + c.green}deploy-home.js${c.reset} ${c.white}| Home script deployment${c.reset}\n\n` +
            `${c.cyan}--max-ram <percent>${c.reset}  ${c.yellow}Limit RAM usage to this percent of home${c.reset}\n` +
            `${c.cyan}--killall${c.reset}            ${c.yellow}Kill all home processes except this one before deploying${c.reset}\n` +
            `${c.cyan}--quiet${c.reset}              ${c.yellow}Suppress minor updates${c.reset}\n` +
            `${c.cyan}--silent${c.reset}             ${c.yellow}Only output errors/fatal events${c.reset}\n` +
            `${c.cyan}--help${c.reset}               ${c.yellow}Display this help message${c.reset}\n`
        );
    }

    if (args.help) return showHelp();

    biosHeader();

    // Read valid targets
    let targets = [];
    try {
        targets = ns.read(targetsFile)
            .split("\n")
            .map(l => l.trim())
            .filter(h => h && ns.serverExists(h) && ns.hasRootAccess(h));
        biosMsg("INIT", `Found ${targets.length} valid targets.`);
    } catch (e) {
        biosMsg("TERMINATE", `ERROR reading ${targetsFile}: ${e}`);
        return;
    }
    if (targets.length === 0) {
        biosMsg("TERMINATE", `No valid targets in ${targetsFile}`);
        return;
    }

    // Kill all existing processes on home except this script, if --killall specified
    if (args["killall"]) {
        const selfPid = ns.getRunningScript().pid;
        const procs = ns.ps(HOME);
        let killed = 0;
        for (const p of procs) {
            if (p.pid !== selfPid) {
                try {
                    ns.kill(p.pid, HOME);
                    killed++;
                } catch (_) {}
            }
        }
        await ns.sleep(100);
        biosMsg("INIT", `Killed ${killed} processes on home prior to deploy.`);
    }

    // Determine usable RAM per args
    const maxRam = ns.getServerMaxRam(HOME);
    const usedRam = ns.getServerUsedRam(HOME);
    const ramPercent = Math.max(0, Math.min(args["max-ram"], 100)) / 100;
    const ramLimit = args["killall"] ? maxRam * ramPercent : (maxRam - usedRam) * ramPercent;
    const usableRam = Math.max(0, ramLimit);

    const script = usableRam <= lowRamThreshold ? lowRamScript : highRamScript;
    const scriptRam = ns.getScriptRam(script, HOME);

    if (!ns.fileExists(script, HOME)) {
        biosMsg("TERMINATE", `🛑 ERROR: Missing script ${script}`);
        return;
    }

    // Calculate total threads
    const totalThreads = Math.floor(usableRam / scriptRam);
    if (totalThreads < 1) {
        biosMsg("TERMINATE", `🛑 Insufficient RAM: ${usableRam.toFixed(2)}GB usable, need ${scriptRam.toFixed(2)}GB`);
        return;
    }
    biosMsg(
        "INIT",
        `Usable RAM: ${colorBySize(usableRam)}${usableRam.toFixed(2)}GB${c.white} (${args["max-ram"]}% ${args["killall"] ? "of total" : "of available"}), using ${script} (${colorBySize(scriptRam)}${scriptRam.toFixed(2)}GB/thread${c.white})`
    );

    // Thread assignment
    const nTargets = targets.length;
    const threadAssignments = {};
    let T = totalThreads;
    const base = Math.floor(T / nTargets);
    let extra = T % nTargets;
    for (let i = 0; i < nTargets; i++) {
        const tgt = targets[i];
        const th = base + (extra > 0 ? 1 : 0);
        if (extra > 0) extra--;
        threadAssignments[tgt] = th;
    }

    let launchedThreads = 0;
    const scriptName = script.split("/").pop();
    let availRam = usableRam;
    biosMsg("INIT", `Deploying scripts...`);
    for (const tgt of targets) {
        let th = threadAssignments[tgt];
        th = Math.min(th, Math.floor(availRam / scriptRam));
        if (th <= 0) continue;

        let ok = false;
        for (let i = 0; i < maxRetries; i++) {
            if (ns.exec(script, HOME, th, tgt)) {
                biosMsg(
                    "SUCCESS",
                    `Deployed ${scriptName}${c.white} ${colorBySize(th)}x${th}${c.white} ${c.cyan}→${c.white} ${tgt}`
                );
                launchedThreads += th;
                availRam -= th * scriptRam;
                ok = true;
                break;
            }
            await ns.sleep(retryDelay);
        }
        if (!ok) biosMsg("TERMINATE", `🛑 Failed to deploy ${scriptName} x${th} -> ${tgt} after ${maxRetries} retries`);
    }

    biosMsg("SUMMARY", `✅ Launched ${c.lgreen}${launchedThreads}${c.white} threads across ${c.lgreen}${nTargets}${c.white} targets on home.`);
    biosMsg("TERMINATE", "🛑 Home deployment complete.");
}
