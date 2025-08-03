/**
 * deploy-scripts.js
 * BIOS-format, colorized modular deployer, PRAAXIS_ALPHA standards.
 * v2.9.5 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage:
 *   run deploy-scripts.js [--target-dir=/scripts/] [--retry-delay=100] [--exec-delay=0] [--help]
 */
/** @param {NS} ns **/
export async function main(ns) {
    // --- Configurable Delays ---
    const defaultRetryDelay = 500; // ms (lowered for speed!)
    const defaultExecDelay = 100; // ms (set to 0 for fastest runtime)
    const maxRetries = 5;
    // --- Static Config ---
    const lowRamScript = "/scripts/hgw-lowram.js";
    const highRamScript = "/scripts/hgw-highram.js";
    const lowRamThreshold = 8; // GB
    const defaultTargetDir = "/scripts/";
    const distributedTargetsFile = "/data/target-list.txt";
    const rootedServersFile = "/data/rooted-servers.txt";
    // --- Parse flags ---
    const args = ns.flags([
        ["target-dir", defaultTargetDir],
        ["retry-delay", defaultRetryDelay],
        ["exec-delay", defaultExecDelay],
        ["help", false],
        ["quiet", false],
        ["silent", false],
    ]);
    // --- Color Codes ---
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
    const arrowWhite = c.cyan + "→" + c.reset;
    // --- Utility Colorizer ---
    function colorBySize(val) {
        if (val <= 8)
            return c.red;
        if (val <= 32)
            return c.yellow;
        if (val <= 128)
            return c.green;
        return c.lgreen;
    }
    function biosMsg(type, msg, server = null, always = false) {
        if (args.silent && !always)
            return;
        let icon = arrowCyan; // line prefix arrow is cyan
        let colorType = "";
        if (type === "INIT")
            colorType = c.cyan;
        else if (type === "SUCCESS")
            colorType = c.lgreen;
        else if (type === "SUMMARY")
            colorType = c.cyan;
        else if (type === "TERMINATE")
            colorType = c.red;
        let tags = [];
        if (server)
            tags.push(c.white + "[" + server + "]" + c.reset);
        tags.push(c.white + "[" + colorType + type + c.reset + c.white + "]" + c.reset);
        ns.tprint(`${icon} ${tags.join("")} ${c.white}${msg}${c.reset}`);
    }
    function biosHeader() {
        if (args.silent)
            return;
        ns.tprint(c.yellow + "→ deploy-scripts.js: DEPLOY SCRIPTS (REMOTE) ─ DISTRIBUTED HGW" + c.reset);
        ns.tprint(c.cyan + "• Deploys optimized HGW scripts to all rooted servers and targets." + c.reset);
    }
    function showHelp() {
        ns.tprint(`${c.bold + c.green}deploy-scripts.js${c.reset} ${c.white}| Distributed script deployment${c.reset}\n\n` +
            `${c.cyan}--target-dir=/scripts/${c.reset} ${c.yellow}Directory to deploy scripts from (default: /scripts/)${c.reset}\n` +
            `${c.cyan}--retry-delay=100${c.reset}   ${c.yellow}Milliseconds between failed exec retries (default: 100)${c.reset}\n` +
            `${c.cyan}--exec-delay=0${c.reset}      ${c.yellow}Milliseconds between server deployments (default: 0)${c.reset}\n` +
            `${c.cyan}--quiet${c.reset}           ${c.yellow}Suppress non-essential status updates${c.reset}\n` +
            `${c.cyan}--silent${c.reset}          ${c.yellow}Only output errors/fatal events${c.reset}\n` +
            `${c.cyan}--help${c.reset}            ${c.yellow}Display this help message${c.reset}\n`);
    }
    // --- HELP ---
    if (args.help)
        return showHelp();
    biosHeader();
    const retryDelay = Math.max(0, Number(args["retry-delay"]) || defaultRetryDelay);
    const executionDelay = Math.max(0, Number(args["exec-delay"]) || defaultExecDelay);
    const targetDir = args["target-dir"].endsWith("/") ? args["target-dir"] : args["target-dir"] + "/";
    // Read rooted servers
    let rootedServers = [];
    try {
        rootedServers = ns.read(rootedServersFile)
            .split("\n")
            .map(l => l.trim().split(":")[0])
            .filter(h => h && ns.serverExists(h));
        biosMsg("INIT", `Parsed ${rootedServers.length} rooted servers.`);
    }
    catch (e) {
        biosMsg("TERMINATE", `🛑 ERROR reading ${rootedServersFile}: ${e}`);
        return;
    }
    // Read valid targets
    let validTargets = [];
    try {
        validTargets = ns.read(distributedTargetsFile)
            .split("\n")
            .map(l => l.trim())
            .filter(h => h && ns.serverExists(h) && ns.hasRootAccess(h));
        biosMsg("INIT", `Found ${validTargets.length} valid targets.`);
    }
    catch (e) {
        biosMsg("TERMINATE", `ERROR reading ${distributedTargetsFile}: ${e}`);
        return;
    }
    if (validTargets.length === 0) {
        biosMsg("TERMINATE", "🛑 No valid target servers found.");
        return;
    }
    // Collect capable servers
    const capableServers = rootedServers
        .filter(h => h !== "home")
        .map(h => ({ name: h, maxRam: ns.getServerMaxRam(h) }))
        .filter(s => s.maxRam >= ns.getScriptRam(lowRamScript));
    if (capableServers.length === 0) {
        biosMsg("TERMINATE", "🛑 No capable servers with sufficient RAM.");
        return;
    }
    biosMsg("INIT", `Found ${capableServers.length} capable servers.`);
    // Add type annotations for threadAssignments
    let threadAssignments = {};
    // Compute thread assignments (distributed mode only)
    const ramHigh = ns.getScriptRam(highRamScript);
    const ramLow = ns.getScriptRam(lowRamScript);
    let totalThreads = 0;
    for (const srv of capableServers) {
        // Kill all processes
        ns.ps(srv.name).forEach(p => ns.kill(p.pid, srv.name));
        const used = ns.getServerUsedRam(srv.name);
        const scriptRam = srv.maxRam <= lowRamThreshold ? ramLow : ramHigh;
        srv.threads = Math.floor((srv.maxRam - used) / scriptRam);
        totalThreads += srv.threads;
        biosMsg("INIT", `${srv.name}: Available threads = ${colorBySize(srv.threads)}${srv.threads}${c.white}`);
    }
    biosMsg("INIT", `Total available threads: ${colorBySize(totalThreads)}${totalThreads}${c.white}`);
    const nTargets = validTargets.length;
    for (const srv of capableServers) {
        threadAssignments[srv.name] = {};
        let T = srv.threads;
        if (T <= 0)
            continue;
        const base = Math.floor(T / nTargets);
        let extra = T % nTargets;
        for (let i = 0; i < nTargets; i++) {
            const tgt = validTargets[i];
            const th = base + (extra > 0 ? 1 : 0);
            if (extra > 0)
                extra--;
            threadAssignments[srv.name][tgt] = th;
        }
    }
    // Deploy scripts
    let deployedCount = 0;
    let totalDeployed = 0;
    for (const srv of capableServers) {
        const details = ns.getServer(srv.name);
        const usedRam = ns.getServerUsedRam(srv.name);
        const availRam = details.maxRam - usedRam;
        biosMsg("INIT", `${srv.name}: Available RAM ` +
            `${colorBySize(availRam)}${availRam}GB${c.white}` +
            `${c.white} of ${colorBySize(details.maxRam)}${details.maxRam.toFixed(2)}GB${c.white}`);
        const script = srv.maxRam <= lowRamThreshold ? lowRamScript : highRamScript;
        if (!ns.fileExists(script, "home")) {
            biosMsg("TERMINATE", `🛑 ERROR: Missing script ${script}`);
            continue;
        }
        // Clean up old scripts in targetDir
        ns.ls(srv.name)
            .filter(f => f.startsWith(targetDir) && f.endsWith(".js"))
            .forEach(f => ns.rm(f, srv.name));
        await ns.scp(script, srv.name, "home");
        biosMsg("SUCCESS", `${c.yellow}Copied ${script}${c.reset}`);
        const scriptRam = ns.getScriptRam(script);
        let availRamForExec = details.maxRam - ns.getServerUsedRam(srv.name);
        for (const tgt of validTargets) {
            let th = threadAssignments[srv.name][tgt];
            th = Math.min(th, Math.floor(availRamForExec / scriptRam));
            if (th <= 0)
                continue;
            const path = targetDir + script.split("/").pop();
            let ok = false;
            for (let i = 0; i < maxRetries; i++) {
                if (ns.exec(path, srv.name, th, tgt)) {
                    biosMsg("SUCCESS", `${srv.name}: Deployed ${path}${c.white} ${colorBySize(th)}x${th}${c.white} ${arrowWhite} ${c.white}${tgt}`);
                    totalDeployed += th;
                    deployedCount++;
                    availRamForExec -= th * scriptRam;
                    ok = true;
                    break;
                }
                await ns.sleep(retryDelay);
            }
            if (!ok)
                biosMsg("TERMINATE", `${srv.name}: Failed to exec ${path} on ${tgt}`);
        }
        if (executionDelay > 0)
            await ns.sleep(executionDelay); // only delay if > 0
    }
    biosMsg("SUMMARY", `✅ Total deployed threads: ${c.lgreen}${totalDeployed}${c.white}`);
    biosMsg("SUMMARY", `✅ Deployed to ${c.lgreen}${deployedCount}${c.white} targets across ${c.lgreen}${capableServers.length}${c.white} servers.`);
    biosMsg("TERMINATE", "🛑 Deployment complete.");
}
