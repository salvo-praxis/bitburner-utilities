/**
 * auto-backdoor.js
 * Modular helper to backdoor a specific server or all eligible servers automatically via Singularity.
 * Author: Salvo Praxis (PRAAXIS_ALPHA)
 *
 * Usage:
 *   run auto-backdoor.js --server <hostname>
 *   run auto-backdoor.js --all [--persistent] [--interval=60000]
 *   run auto-backdoor.js --update
 *   run auto-backdoor.js --help
 *   run auto-backdoor.js --log
 *
 * Requires: Singularity access (SF4) for all but --update.
 */
/** @param {NS} ns **/
export async function main(ns) {
    // === COLOR SCHEME ===
    const color = {
        reset: "\u001b[0m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        red: "\u001b[31m",
        cyan: "\u001b[36m",
        magenta: "\u001b[35m",
        gray: "\u001b[90m",
        white: "\u001b[37m",
        bold: "\u001b[1m"
    };
    // === FLAGS ===
    const args = ns.flags([
        ["server", ""],
        ["all", false],
        ["persistent", false],
        ["interval", 60000],
        ["update", false],
        ["help", false],
        ["log", false]
    ]);
    const backdooredServersFile = "/data/backdoored-servers.txt";
    const logFile = "/logs/auto-backdoor.txt";
    let logBuffer = [];
    function log(msg, noColorMsg = null) {
        ns.tprint(msg);
        logBuffer.push(`[${(new Date()).toISOString()}] ` + (noColorMsg || msg.replace(/\u001b\[[0-9;]*m/g, '')));
    }
    function logSummary(msg) {
        ns.tprint(msg);
        logBuffer.push(`[${(new Date()).toISOString()}] ` + msg.replace(/\u001b\[[0-9;]*m/g, ''));
    }
    function flushLogs() {
        if (args.log)
            ns.write(logFile, logBuffer.join("\n") + "\n", "w");
        logBuffer = [];
    }
    // === HELP MODE ===
    if (args.help || (!args.server && !args.all && !args.update)) {
        let helpBuf = [];
        helpBuf.push("");
        helpBuf.push(""); // Leading space
        helpBuf.push(color.cyan + "==============================" + color.reset);
        helpBuf.push(color.cyan + "        auto-backdoor.js      " + color.reset);
        helpBuf.push(color.cyan + "==============================" + color.reset);
        helpBuf.push("");
        helpBuf.push(color.white + "Automates installing backdoors using the Singularity API." + color.reset);
        helpBuf.push(color.white + "Requires: Singularity access (SF4), root access, and sufficient hacking level." + color.reset);
        helpBuf.push("");
        helpBuf.push(color.cyan + "Usage:" + color.reset);
        helpBuf.push("  " + color.white + "run auto-backdoor.js " + color.yellow + "--server <hostname>" + color.reset);
        helpBuf.push("  " + color.white + "run auto-backdoor.js " + color.yellow + "--all [--persistent] [--interval=60000]" + color.reset);
        helpBuf.push("  " + color.white + "run auto-backdoor.js " + color.yellow + "--update" + color.reset);
        helpBuf.push("  " + color.white + "run auto-backdoor.js " + color.yellow + "--help" + color.reset);
        helpBuf.push("  " + color.white + "run auto-backdoor.js " + color.yellow + "--log" + color.reset);
        helpBuf.push("");
        helpBuf.push(color.cyan + "Flags:" + color.reset);
        helpBuf.push("  " + color.yellow + "--server <hostname>   " + color.white + "Only backdoor the specified server." + color.reset);
        helpBuf.push("  " + color.yellow + "--all                 " + color.white + "Backdoor every eligible server." + color.reset);
        helpBuf.push("  " + color.yellow + "--persistent          " + color.white + "Repeat --all every interval ms." + color.reset);
        helpBuf.push("  " + color.yellow + "--interval=60000      " + color.white + "Time between persistent passes (ms)" + color.reset);
        helpBuf.push("  " + color.yellow + "--update              " + color.white + "Update backdoored servers file and exit (no SF4 needed)" + color.reset);
        helpBuf.push("  " + color.yellow + "--help                " + color.white + "Display this help text." + color.reset);
        helpBuf.push("  " + color.yellow + "--log                 " + color.white + "Write progress and summary to /logs/auto-backdoor.txt." + color.reset);
        helpBuf.push("");
        helpBuf.push(color.cyan + "Notes:" + color.reset);
        helpBuf.push(color.white + "- All modes except --update require SF4 (Singularity API)." + color.reset);
        helpBuf.push(color.white + "- Purchased/private servers are ignored." + color.reset);
        helpBuf.push(color.white + "- If no action flag given, help is shown." + color.reset);
        ns.tprint(helpBuf.join("\n"));
        if (ns.singularity && ns.singularity.connect)
            ns.singularity.connect("home");
        return;
    }
    // === --UPDATE MODE: NO SF4 NEEDED ===
    if (args.update) {
        // Discover all servers
        const all = new Set(["home"]);
        const queue = ["home"];
        while (queue.length) {
            const cur = queue.shift();
            for (const n of ns.scan(cur))
                if (!all.has(n)) {
                    all.add(n);
                    queue.push(n);
                }
        }
        const backdoored = [...all].filter(s => s !== "home" &&
            ns.hasRootAccess(s) &&
            ns.getServer(s).backdoorInstalled);
        log(color.cyan + `Updated ${color.yellow}${backdoored.length}${color.cyan} backdoored servers in ${color.yellow}${backdooredServersFile}` + color.reset);
        ns.write(backdooredServersFile, backdoored.join("\n"), "w");
        flushLogs();
        if (ns.singularity && ns.singularity.connect)
            ns.singularity.connect("home");
        return;
    }
    // === REQUIRE SINGULARITY FOR EVERYTHING ELSE ===
    if (!ns.singularity || !ns.singularity.connect) {
        log(color.red + "ERROR: Singularity API required for auto-backdoor!" + color.reset);
        flushLogs();
        if (ns.singularity && ns.singularity.connect)
            ns.singularity.connect("home");
        return;
    }
    // === BFS PATHFINDING UTIL ===
    const pathCache = new Map();
    const scanCache = new Map();
    const cachedScan = host => {
        if (!scanCache.has(host))
            scanCache.set(host, ns.scan(host));
        return scanCache.get(host);
    };
    async function findPath(target) {
        if (pathCache.has(target))
            return pathCache.get(target);
        let parent = new Map();
        let queue = ["home"];
        let visited = new Set(["home"]);
        parent.set("home", null);
        while (queue.length) {
            const current = queue.shift();
            if (current === target) {
                let path = [];
                let cur = target;
                while (cur !== null) {
                    path.unshift(cur);
                    cur = parent.get(cur);
                }
                pathCache.set(target, path);
                return path;
            }
            for (const neighbor of cachedScan(current)) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parent.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }
        pathCache.set(target, null);
        return null;
    }
    async function connectTo(target) {
        const path = await findPath(target);
        if (!path)
            return false;
        ns.singularity.connect("home");
        for (let i = 1; i < path.length; i++) {
            if (!ns.singularity.connect(path[i])) {
                log(color.red + `Failed to connect to ${path[i]} (in path to ${target})` + color.reset);
                return false;
            }
            await ns.sleep(50);
        }
        return true;
    }
    // === --SERVER MODE ===
    if (args.server) {
        const s = args.server;
        const purchased = new Set(ns.getPurchasedServers());
        // Silently ignore purchased/private servers: NO log
        if (purchased.has(s)) {
            ns.singularity.connect("home");
            return;
        }
        let fail = 0, success = 0;
        log(color.cyan + `Starting auto-backdoor of 1 server(s)...` + color.reset);
        log(color.yellow + `(1/1) Connecting to ${color.yellow}${s}${color.reset}...`);
        const path = await findPath(s);
        if (!path) {
            log(color.red + `  ✖ No path found to ${color.yellow}${s}${color.red}. Skipping.` + color.reset);
            fail++;
        }
        else if (!ns.hasRootAccess(s)) {
            log(color.red + `  ✖ No root on ${color.yellow}${s}${color.red}. Skipping.` + color.reset);
            fail++;
        }
        else if (ns.getServer(s).backdoorInstalled) {
            log(color.green + `  ✔ Already backdoored ${color.yellow}${s}${color.green}. Skipping.` + color.reset);
        }
        else if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(s)) {
            log(color.red + `  ✖ Hacking level too low for ${color.yellow}${s}${color.red}. Skipping.` + color.reset);
            fail++;
        }
        else if (!(await connectTo(s))) {
            log(color.red + `  ✖ Could not connect to ${color.yellow}${s}${color.red}.` + color.reset);
            fail++;
        }
        else {
            try {
                log(color.yellow + `  ...Backdooring ${color.yellow}${s}${color.yellow} (this may take a moment)...` + color.reset);
                await ns.singularity.installBackdoor(s);
                log(color.green + `  ✔ Successfully backdoored ${color.yellow}${s}` + color.reset);
                success++;
            }
            catch (e) {
                log(color.red + `  ✖ Error backdooring ${color.yellow}${s}: ${e}` + color.reset);
                fail++;
            }
        }
        logSummary(color.cyan + `Backdoor complete: ` +
            color.green + `${success} succeeded` + color.cyan +
            `, ` + color.red + `${fail} failed` +
            color.cyan + `, 1 total.` + color.reset);
        flushLogs();
        ns.singularity.connect("home");
        return;
    }
    // === --ALL / --PERSISTENT MODE ===
    if (args.all) {
        const interval = Math.max(1000, Number(args["interval"]) || 60000);
        const persistent = !!args["persistent"];
        do {
            // Discover all servers, including private/purchased
            const allServers = new Set(["home"]);
            const queue = ["home"];
            while (queue.length) {
                const cur = queue.shift();
                for (const n of ns.scan(cur))
                    if (!allServers.has(n)) {
                        allServers.add(n);
                        queue.push(n);
                    }
            }
            // Always get current purchased servers list/set
            const purchasedServers = new Set(ns.getPurchasedServers());
            // Only include eligible, *non-purchased* servers
            const targets = [...allServers].filter(s => s !== "home" &&
                !purchasedServers.has(s) && // <-- filter out purchased/private servers!
                ns.hasRootAccess(s) &&
                !ns.getServer(s).backdoorInstalled &&
                ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(s));
            if (targets.length === 0) {
                if (persistent) {
                    log(color.yellow + "💤 No viable servers found, sleeping for " +
                        color.cyan + (interval / 1000).toFixed(1) + "s..." + color.reset);
                }
                else {
                    log(color.cyan + "Starting auto-backdoor: " +
                        color.yellow + "No viable servers to backdoor at this time." + color.reset);
                }
                flushLogs();
                ns.singularity.connect("home");
                if (!persistent)
                    return;
                await ns.sleep(interval);
                continue;
            }
            log(color.cyan + `Starting auto-backdoor of ${targets.length} server(s)...` + color.reset);
            let success = 0, fail = 0;
            for (let i = 0; i < targets.length; i++) {
                const s = targets[i];
                log(color.yellow + `(${i + 1}/${targets.length}) Connecting to ${color.yellow}${s}${color.reset}...`);
                const path = await findPath(s);
                if (!path) {
                    log(color.red + `  ✖ No path found to ${color.yellow}${s}${color.red}. Skipping.` + color.reset);
                    fail++;
                    continue;
                }
                if (!ns.hasRootAccess(s)) {
                    log(color.red + `  ✖ No root on ${color.yellow}${s}${color.red}. Skipping.` + color.reset);
                    fail++;
                    continue;
                }
                if (ns.getServer(s).backdoorInstalled) {
                    log(color.green + `  ✔ Already backdoored ${color.yellow}${s}${color.green}. Skipping.` + color.reset);
                    continue;
                }
                if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(s)) {
                    log(color.red + `  ✖ Hacking level too low for ${color.yellow}${s}${color.red}. Skipping.` + color.reset);
                    fail++;
                    continue;
                }
                if (!(await connectTo(s))) {
                    log(color.red + `  ✖ Could not connect to ${color.yellow}${s}${color.red}.` + color.reset);
                    fail++;
                    continue;
                }
                try {
                    log(color.yellow + `  ...Backdooring ${color.yellow}${s}${color.yellow} (this may take a moment)...` + color.reset);
                    await ns.singularity.installBackdoor(s);
                    log(color.green + `  ✔ Successfully backdoored ${color.yellow}${s}` + color.reset);
                    success++;
                }
                catch (e) {
                    log(color.red + `  ✖ Error backdooring ${color.yellow}${s}: ${e}` + color.reset);
                    fail++;
                }
            }
            logSummary(color.cyan + `Backdoor complete: ` +
                color.green + `${success} succeeded` + color.cyan +
                `, ` + color.red + `${fail} failed` +
                color.cyan + `, ${targets.length} total.` + color.reset);
            flushLogs();
            ns.singularity.connect("home");
            if (!persistent)
                break;
            await ns.sleep(interval);
        } while (true);
        ns.singularity.connect("home");
        return;
    }
}
