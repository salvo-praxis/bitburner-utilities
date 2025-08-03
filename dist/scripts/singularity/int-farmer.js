// v0.5.1 | 2025-07-27 | SALVO PRAXIS (PRAAXIS_ALPHA)
// int-farmer.js — Intelligence XP farming automation
//
// Changelog:
// v0.5.1: "Self-healing" reconnect for manual-hack modes; script auto-reconnects if user returns to home or is disconnected from target server, preventing unwanted termination during session interruptions. Maintains safety—never attempts to hack home. (ChatGPT + Salvo Praxis)
//
// Usage: run scripts/singularity/int-farmer.js --help
/** @param {NS} ns **/
export async function main(ns) {
    // ----- CONFIG & COLOR CONSTANTS -----
    const VERSION = "v0.5.1 | 2025-07-27 | SALVO PRAXIS";
    const color = {
        reset: "\u001b[0m",
        bold: "\u001b[1m",
        white: "\u001b[37m",
        cyan: "\u001b[36m",
        yellow: "\u001b[33m",
        green: "\u001b[32m",
        red: "\u001b[31m",
        magenta: "\u001b[35m",
        gray: "\u001b[90m",
        black: "\u001b[30m"
    };
    const colW = {
        server: 16, reqHack: 8, chance: 8, hackTime: 8, xp: 12, note: 20
    };
    const SEC_WARN_MARGIN = 2;
    const OPT_REEVAL_CYCLES = 5;
    // ----- FLAG PARSE -----
    const args = ns.flags([
        ["help", false],
        ["mode", ""],
        ["max-ram", 0],
        ["threads-only", 0],
        ["cycle-time", 10],
        ["focus", false],
        ["target", ""],
        ["quiet", false],
        ["optimized", false],
        ["list", false],
        ["top", 5],
        ["all", false],
        ["auto-switch", true],
    ]);
    if (args.help || !args.mode)
        return showHelp(ns, color, VERSION);
    // Ensure directories exist
    try {
        await ns.write("/data/.keep", "", "w");
        await ns.write("/tmp/.keep", "", "w");
    }
    catch { }
    // ----- MODE SELECTOR -----
    switch (args.mode) {
        case "programs":
            await trainPrograms(ns, args["max-ram"], args["threads-only"], color);
            break;
        case "university":
            await trainUniversity(ns, args["cycle-time"], args["focus"], color);
            break;
        case "config":
            await writeConfig(ns, color);
            break;
        case "reset":
            await resetConfig(ns, color);
            break;
        case "manual-hack":
            await manualHackController(ns, args, color, colW, SEC_WARN_MARGIN, OPT_REEVAL_CYCLES);
            break;
        case "crime":
            await farmCrime(ns, args.target || "Heist", color);
            break;
        case "singularity-go":
            await farmSingularityGo(ns, color);
            break;
        case "join-reset":
            await farmJoinReset(ns, args.target || "Sector-12", color);
            break;
        default:
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ERROR: Unknown mode '${args.mode}'.`);
            showHelp(ns, color, VERSION);
    }
}
function timestamp() { return new Date().toLocaleTimeString(); }
function pad(s, w, alignRight = false) {
    s = String(s);
    return alignRight ? s.padStart(w) : s.padEnd(w);
}
function padCenter(s, w) {
    s = String(s);
    let left = Math.floor((w - s.length) / 2), right = w - s.length - left;
    return ' '.repeat(left) + s + ' '.repeat(right);
}
// ========== HELP (Colorized) ==========
function showHelp(ns, color, VERSION) {
    let out = "";
    out += `${color.white}${color.bold}// ${VERSION}${color.reset}\n`;
    out += `${color.white}int-farmer.js — Intelligence XP farming automation (SF4 required for most modes)${color.reset}\n`;
    out += `${color.white}Usage:${color.reset} run scripts/singularity/int-farmer.js --mode=${color.cyan}<mode>${color.reset} [flags]\n\n`;
    out += `${color.white}Modes:${color.reset}\n`;
    out += `  ${color.cyan}programs        ${color.gray}Loop start/cancel program creation (low efficiency)\n`;
    out += `  ${color.cyan}university      ${color.gray}Cycle through configured university courses\n`;
    out += `  ${color.cyan}config          ${color.gray}Write /data/courses.json with optimized courses\n`;
    out += `  ${color.cyan}reset           ${color.gray}Clear /data/courses.json\n`;
    out += `  ${color.cyan}manual-hack     ${color.gray}Loop manualHack() on a server for Int XP\n`;
    out += `  ${color.cyan}crime           ${color.gray}Loop commitCrime() for Int-yielding crimes\n`;
    out += `  ${color.cyan}singularity-go  ${color.gray}Loop goToLocation() for tiny Int XP\n`;
    out += `  ${color.cyan}join-reset      ${color.gray}Join faction and softReset loop (destructive)\n`;
    out += `\n${color.white}Flags:${color.reset}\n`;
    out += `  ${color.yellow}--max-ram       ${color.gray}[programs] Max RAM (GB) to dedicate (0 = unlimited)\n`;
    out += `  ${color.yellow}--threads-only  ${color.gray}[programs] Exact threads to run\n`;
    out += `  ${color.yellow}--cycle-time    ${color.gray}[programs/university/crime] Seconds per cycle (default: 10)\n`;
    out += `  ${color.yellow}--focus         ${color.gray}[university] Focus on work (boosts exp, reduces charisma)\n`;
    out += `  ${color.yellow}--target        ${color.gray}[manual-hack] server, [crime] crime type, [join-reset] faction\n`;
    out += `  ${color.yellow}--quiet         ${color.gray}Suppress frequent status updates\n`;
    out += `  ${color.yellow}--optimized     ${color.gray}[manual-hack] Auto-pick/run best server by XP/hr\n`;
    out += `  ${color.yellow}--list          ${color.gray}[manual-hack] Show table of top targets, do not hack\n`;
    out += `  ${color.yellow}--top N         ${color.gray}[manual-hack] Display N top targets (default: 5)\n`;
    out += `  ${color.yellow}--all           ${color.gray}[manual-hack] Show all eligible targets\n`;
    out += `  ${color.yellow}--auto-switch   ${color.gray}[manual-hack] Enable auto-switching to new best server (default: true)\n`;
    out += `\n${color.white}Examples:${color.reset}\n`;
    out += `  ${color.cyan}run scripts/singularity/int-farmer.js --mode=manual-hack --optimized --list${color.reset}\n`;
    out += `  ${color.cyan}run scripts/singularity/int-farmer.js --mode=university --cycle-time=600 --focus${color.reset}\n`;
    ns.tprint(out);
}
// ========== BOX-DRAWING TABLE UTILITY ==========
function printTable(title, columns, rows, color, ns) {
    ns.tprint('\n');
    const RED = color.red, WHITE = color.white, RESET = color.reset;
    let colWidths = columns.map(col => col.width + 2);
    let totalWidth = colWidths.reduce((a, b) => a + b, 0) + columns.length + 1;
    let top = RED + '╔' + '═'.repeat(totalWidth - 2) + '╗';
    let titleLine = RED + '║' + WHITE +
        padCenter(title, totalWidth - 2) +
        RED + '║';
    let header = RED + '╠';
    colWidths.forEach((w, i) => {
        header += '═'.repeat(w);
        header += (i < colWidths.length - 1) ? '╦' : '╣';
    });
    let headers = RED + '║' + columns.map((col, i) => ' ' + WHITE + pad(col.name, col.width, false) + RED + ' ').join('║') + '║';
    let rowsep = RED + '╠';
    colWidths.forEach((w, i) => {
        rowsep += '═'.repeat(w);
        rowsep += (i < colWidths.length - 1) ? '╬' : '╣';
    });
    let datarows = rows.map(row => RED + '║' +
        columns.map((col, idx) => {
            let val = String(row[col.name]);
            let thisColor = WHITE;
            if (col.name === "XP/hr" && row._xpColor)
                thisColor = row._xpColor;
            if (col.name === "Note" && row._noteColor)
                thisColor = row._noteColor;
            return ' ' + thisColor + pad(val, col.width, false) + RED + ' ';
        }).join('║') + '║');
    let bottom = RED + '╚';
    colWidths.forEach((w, i) => {
        bottom += '═'.repeat(w);
        bottom += (i < colWidths.length - 1) ? '╩' : '╝';
    });
    let out = ['\n', top, titleLine, header, headers, rowsep, ...datarows, bottom].join('\n') + RESET;
    ns.tprint(out);
}
// ========== OPTIMIZED MANUAL-HACK CONTROLLER ==========
async function manualHackController(ns, args, color, colW, SEC_WARN_MARGIN, OPT_REEVAL_CYCLES) {
    if (!ns.singularity) {
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ERROR: Singularity API required.`);
        return;
    }
    const getTargets = () => {
        const player = ns.getPlayer();
        const rooted = ns.scan("home")
            .concat(ns.getPurchasedServers())
            .reduce((set, srv) => set.add(srv), new Set(["home"]));
        let servers = [];
        let queue = ["home"], seen = new Set();
        while (queue.length) {
            const srv = queue.pop();
            if (seen.has(srv))
                continue;
            seen.add(srv);
            for (const neighbor of ns.scan(srv)) {
                if (!seen.has(neighbor))
                    queue.push(neighbor);
            }
        }
        servers = Array.from(seen);
        const privs = ns.getPurchasedServers();
        return servers.filter(s => s !== "home" &&
            !privs.includes(s) &&
            ns.hasRootAccess(s) &&
            ns.getServerRequiredHackingLevel(s) <= player.skills.hacking &&
            ns.hackAnalyzeChance(s) >= 0.7);
    };
    function evaluateServers(ns, targets, player) {
        return targets.map(s => {
            const reqHack = ns.getServerRequiredHackingLevel(s);
            const currSec = ns.getServerSecurityLevel(s);
            const minSec = ns.getServerMinSecurityLevel(s);
            const secWarn = currSec > minSec + SEC_WARN_MARGIN;
            const hackChance = ns.hackAnalyzeChance(s);
            const hackTime = ns.getHackTime(s) / 1000;
            const estXP = Math.pow(reqHack, 1.15) * hackChance / hackTime;
            let note = "";
            if (secWarn)
                note += "Sec high! ";
            if (hackChance < 0.85)
                note += "Low chance. ";
            if (reqHack < player.skills.hacking * 0.3)
                note += "Too easy. ";
            return {
                server: s, reqHack, hackChance, hackTime, estXP, secWarn, note: note.trim(),
                currSec, minSec
            };
        }).sort((a, b) => b.estXP - a.estXP);
    }
    if (args.optimized || args.list) {
        const player = ns.getPlayer();
        const targets = getTargets();
        if (!targets.length) {
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[manual-hack]${color.reset} No eligible servers found (all too hard, too easy, not rooted, or no access).`);
            return;
        }
        const serverInfo = evaluateServers(ns, targets, player);
        const toShow = args.all ? serverInfo : serverInfo.slice(0, args.top || 5);
        const columns = [
            { name: "Server", width: colW.server },
            { name: "ReqHack", width: colW.reqHack },
            { name: "Chance", width: colW.chance },
            { name: "Time", width: colW.hackTime },
            { name: "XP/hr", width: colW.xp },
            { name: "Note", width: colW.note }
        ];
        const datarows = toShow.map(s => ({
            "Server": s.server,
            "ReqHack": s.reqHack,
            "Chance": Math.round(s.hackChance * 100) + "%",
            "Time": s.hackTime.toFixed(2) + "s",
            "XP/hr": (s.estXP * 3600).toFixed(2),
            "Note": s.note,
            _xpColor: s.secWarn ? color.yellow : color.green,
            _noteColor: s.secWarn ? color.yellow : color.white
        }));
        printTable("Optimized Manual Hack Targets", columns, datarows, color, ns);
        if (args.list)
            return;
        const best = serverInfo[0];
        ns.tprint(`${color.white}[manual-hack]${color.reset} Optimized target: ${color.cyan}${best.server}${color.reset} (ReqHack: ${color.white}${best.reqHack}${color.reset}, Chance: ${color.white}${Math.round(best.hackChance * 100)}%${color.reset}, Hack Time: ${color.white}${best.hackTime.toFixed(2)}s${color.reset}, XP/hr: ${color.green}${(best.estXP * 3600).toFixed(2)}${color.reset})`);
        await farmManualHackOptimized(ns, best, args, color, SEC_WARN_MARGIN, OPT_REEVAL_CYCLES, evaluateServers, getTargets);
        return;
    }
    await farmManualHack(ns, args.target || "n00dles", args.quiet, color, SEC_WARN_MARGIN);
}
// ========== PATCHED: Self-Healing farmManualHackOptimized ==========
async function farmManualHackOptimized(ns, best, args, color, SEC_WARN_MARGIN, OPT_REEVAL_CYCLES, evaluateServers, getTargets) {
    let cycles = 0;
    let server = best.server;
    let quiet = args.quiet;
    let silent = args.silent || false;
    let startInt = ns.getPlayer().exp.intelligence;
    let beforeInt = startInt;
    let lastLogTime = Date.now();
    while (true) {
        if (!await ns.singularity.connect(server)) {
            if (!silent)
                ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Failed to connect to ${color.cyan}${server}${color.reset}.${color.reset}`);
            return;
        }
        const sec = ns.getServerSecurityLevel(server), min = ns.getServerMinSecurityLevel(server);
        if (sec > min + SEC_WARN_MARGIN && !silent) {
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.yellow}Security high${color.reset} (${color.white}${sec.toFixed(2)} > min ${min.toFixed(2)}${color.reset}); consider improving weaken cycle!`);
        }
        try {
            await ns.singularity.manualHack();
        }
        catch (e) {
            ns.singularity.stopAction();
            if (server === "home") {
                if (!silent)
                    ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Session on home; reconnecting to ${best.server}.${color.reset}`);
                continue;
            }
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Error during hack: ${e.message}${color.reset}`);
            return;
        }
        cycles++;
        const currentInt = ns.getPlayer().exp.intelligence;
        const gain = currentInt - beforeInt;
        let c;
        if (gain < 0.003)
            c = color.red;
        else if (gain < 0.015)
            c = color.yellow;
        else if (gain < 0.06)
            c = color.green;
        else
            c = color.cyan;
        if (gain > 0 && !quiet && !silent) {
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ` +
                `${color.red}[${color.white}manual-hack${color.red}]${color.reset} ` +
                `${color.white}Recent Gain: ${color.reset}${c}${gain.toFixed(6)}${color.reset} ${color.cyan}Int XP${color.reset}`);
        }
        beforeInt = currentInt;
        const now = Date.now();
        if (now - lastLogTime >= 60000 && !silent) {
            const sessionGain = currentInt - startInt;
            let sessionColor;
            if (sessionGain < 0.01)
                sessionColor = color.red;
            else if (sessionGain < 0.05)
                sessionColor = color.yellow;
            else if (sessionGain < 0.2)
                sessionColor = color.green;
            else
                sessionColor = color.cyan;
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ` +
                `${color.red}[${color.white}manual-hack${color.red}]${color.reset} ` +
                `${color.white}Total Session Gain: ${color.reset}${sessionColor}${sessionGain.toFixed(6)}${color.reset} ${color.cyan}Int XP${color.reset}`);
            lastLogTime = now;
        }
        if (args["auto-switch"] && cycles % OPT_REEVAL_CYCLES === 0) {
            const player = ns.getPlayer();
            const eligible = getTargets();
            if (eligible.length) {
                const scores = evaluateServers(ns, eligible, player);
                if (scores[0].server !== server && scores[0].estXP > best.estXP * 1.05) {
                    if (!silent)
                        ns.tprint(`${color.green}[${color.white}${timestamp()}${color.green}]${color.reset} ${color.green}[${color.white}manual-hack${color.green}]${color.reset} ${color.white}Switching to better server:${color.reset} ${color.cyan}${scores[0].server}${color.reset} (XP/hr: ${color.green}${(scores[0].estXP * 3600).toFixed(2)}${color.reset})`);
                    server = scores[0].server;
                    best = scores[0];
                    continue;
                }
            }
        }
        await ns.sleep(500);
    }
}
// ========== PATCHED: Self-Healing farmManualHack ==========
async function farmManualHack(ns, server, quiet = false, color, SEC_WARN_MARGIN) {
    if (!ns.serverExists(server) || server === "home" || !ns.hasRootAccess(server)) {
        ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Invalid server '${server}' (non-existent, home, or no root). Try nuke'ing it first.${color.reset}`);
        return;
    }
    let startInt = ns.getPlayer().exp.intelligence;
    let beforeInt = startInt;
    ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Starting hack loop for ${color.cyan}${server}${color.reset} (Your Hack: ${ns.getHackingLevel()}, Req: ${ns.getServerRequiredHackingLevel(server)}, Chance: ${(ns.hackAnalyzeChance(server) * 100).toFixed(2)}%)`);
    let lastLogTime = Date.now();
    while (true) {
        if (!await ns.singularity.connect(server)) {
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Failed to connect to '${server}'. Ensure you have discovered the network path.${color.reset}`);
            return;
        }
        try {
            await ns.singularity.manualHack();
        }
        catch (e) {
            ns.singularity.stopAction();
            if (server === "home") {
                ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Session on home; reconnecting to target server.${color.reset}`);
                continue;
            }
            else {
                ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ${color.red}[${color.white}manual-hack${color.red}]${color.reset} ${color.white}Error during hack: ${e.message}${color.reset}`);
                return;
            }
        }
        const currentInt = ns.getPlayer().exp.intelligence;
        const gain = currentInt - beforeInt;
        let c;
        if (gain < 0.003)
            c = color.red;
        else if (gain < 0.015)
            c = color.yellow;
        else if (gain < 0.06)
            c = color.green;
        else
            c = color.cyan;
        if (gain > 0 && !quiet) {
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ` +
                `${color.red}[${color.white}manual-hack${color.red}]${color.reset} ` +
                `${color.white}Recent Gain: ${color.reset}${c}${gain.toFixed(6)}${color.reset} ${color.cyan}Int XP${color.reset}`);
        }
        beforeInt = currentInt;
        const now = Date.now();
        if (now - lastLogTime >= 60000) {
            const sessionGain = currentInt - startInt;
            let sessionColor;
            if (sessionGain < 0.01)
                sessionColor = color.red;
            else if (sessionGain < 0.05)
                sessionColor = color.yellow;
            else if (sessionGain < 0.2)
                sessionColor = color.green;
            else
                sessionColor = color.cyan;
            ns.tprint(`${color.red}[${color.white}${timestamp()}${color.red}]${color.reset} ` +
                `${color.red}[${color.white}manual-hack${color.red}]${color.reset} ` +
                `${color.white}Total Session Gain: ${color.reset}${sessionColor}${sessionGain.toFixed(6)}${color.reset} ${color.cyan}Int XP${color.reset}`);
            lastLogTime = now;
        }
        await ns.sleep(500);
    }
}
// ========== TRAIN PROGRAMS ==========
async function trainPrograms(ns, maxRamGB, threadsOnly, color) {
    const workerPath = "/tmp/int-trainer-worker.js";
    const workerSrc = `// DUMMY WORKER\nwhile(true) {};\n`;
    for (const host of ["home", ...ns.getPurchasedServers()]) {
        if (ns.scriptRunning(workerPath, host))
            ns.scriptKill(workerPath, host);
    }
    await ns.write(workerPath, workerSrc, "w");
    const hosts = ["home", ...ns.getPurchasedServers()].filter(h => ns.hasRootAccess(h));
    const ramPerThread = ns.getScriptRam(workerPath, "home");
    const capRam = maxRamGB > 0 ? maxRamGB : Infinity;
    let usedRam = 0, totalThreads = 0;
    if (threadsOnly > 0) {
        const targetHost = hosts[0];
        const freeRam = ns.getServerMaxRam(targetHost) - ns.getServerUsedRam(targetHost);
        const threads = Math.min(threadsOnly, Math.floor(freeRam / ramPerThread));
        if (threads > 0) {
            ns.exec(workerPath, targetHost, threads);
            usedRam = threads * ramPerThread;
            totalThreads = threads;
        }
    }
    else {
        for (const host of hosts) {
            const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
            if (freeRam < ramPerThread)
                continue;
            const maxThreadsByFree = Math.floor(freeRam / ramPerThread);
            const maxThreadsByCap = Math.floor((capRam - usedRam) / ramPerThread);
            const threads = Math.min(maxThreadsByFree, maxThreadsByCap);
            if (threads > 0) {
                ns.exec(workerPath, host, threads);
                usedRam += threads * ramPerThread;
                totalThreads += threads;
            }
            if (usedRam >= capRam)
                break;
        }
    }
    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[programs]${color.reset} Launched ${totalThreads} workers using ~${usedRam.toFixed(2)} GB`);
}
// ========== TRAIN UNIVERSITY ==========
async function trainUniversity(ns, cycleTime, focus, color) {
    const configPath = "/data/courses.json";
    let courses;
    try {
        const raw = ns.read(configPath);
        courses = JSON.parse(raw);
        if (!Array.isArray(courses) || courses.length === 0)
            throw new Error("Invalid config");
    }
    catch {
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} No valid config; run config mode`);
        return;
    }
    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} Starting loop with ${courses.length} courses (cycle: ${cycleTime}s, focus: ${focus})`);
    while (true) {
        const player = ns.getPlayer();
        if (player.isWorking && !player.workType.includes("University")) {
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} Stopped: Player working elsewhere (${player.workType})`);
            return;
        }
        for (const c of courses) {
            if (player.city !== c.city) {
                if (player.money < 200000) {
                    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} Insufficient funds for travel to ${c.city} (<200k)`);
                    return;
                }
                await ns.singularity.travelToCity(c.city);
            }
            ns.singularity.universityCourse(c.university, c.name, focus);
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} Started ${c.name} at ${c.university} (${c.city})`);
            if (cycleTime <= 0) {
                while (true) {
                    await ns.sleep(60000);
                    if (ns.getPlayer().workType !== "Taking a university course") {
                        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} Stopped: No longer in course`);
                        return;
                    }
                    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[university]${color.reset} Running ${c.name} at ${c.city}`);
                }
            }
            else {
                await ns.sleep(cycleTime * 1000);
            }
        }
    }
}
// ========== CONFIG WRITERS ==========
async function writeConfig(ns, color) {
    const configPath = "/data/courses.json";
    const universityData = [
        { city: "Sector-12", university: "Rothman University" },
        { city: "Aevum", university: "Summit University" },
        { city: "Volhaven", university: "ZB Institute of Technology" },
    ];
    const courseData = [
        { name: "Study Computer Science", skill: "hacking" },
        { name: "Data Structures", skill: "hacking" },
        { name: "Networks", skill: "hacking" },
        { name: "Algorithms", skill: "hacking" },
        { name: "Management", skill: "charisma" },
        { name: "Leadership", skill: "charisma" },
    ];
    const travelCost = 200000;
    const travelTime = 1000;
    const rates = [];
    const currentCity = ns.getPlayer().city;
    ns.singularity.stopAction();
    for (const u of universityData) {
        if (ns.getPlayer().city !== u.city) {
            if (ns.getPlayer().money < travelCost) {
                ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[config]${color.reset} Insufficient funds for travel to ${u.city} (<${travelCost})`);
                return;
            }
            await ns.singularity.travelToCity(u.city);
            await ns.sleep(travelTime);
        }
        for (const s of courseData) {
            const playerBefore = ns.getPlayer();
            const beforeExp = playerBefore.exp[s.skill];
            ns.singularity.universityCourse(u.university, s.name, false);
            await ns.sleep(5000);
            const playerAfter = ns.getPlayer();
            const afterExp = playerAfter.exp[s.skill];
            ns.singularity.stopAction();
            const rate = (afterExp - beforeExp) / 5;
            const adjustedRate = rate / (1 + (u.city !== currentCity ? travelTime / 5000 : 0));
            rates.push({ city: u.city, university: u.university, name: s.name, rate: adjustedRate });
        }
    }
    if (ns.getPlayer().city !== currentCity) {
        if (ns.getPlayer().money < travelCost) {
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[config]${color.reset} Insufficient funds to return to ${currentCity} (<${travelCost})`);
            return;
        }
        await ns.singularity.travelToCity(currentCity);
    }
    rates.sort((a, b) => b.rate - a.rate);
    let top = rates.slice(0, 4);
    top.sort((a, b) => a.city.localeCompare(b.city) || b.rate - a.rate);
    try {
        await ns.write(configPath, JSON.stringify(top, null, 2), "w");
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[config]${color.reset} Wrote ${top.length} courses to ${configPath} (rates: ${top.map(c => c.rate.toFixed(2)).join(', ')} exp/s)`);
    }
    catch (e) {
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[config]${color.reset} Failed to write ${configPath}: ${e.message}`);
    }
}
async function resetConfig(ns, color) {
    const configPath = "/data/courses.json";
    try {
        await ns.write(configPath, "", "w");
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[reset]${color.reset} Cleared ${configPath}`);
    }
    catch (e) {
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[reset]${color.reset} Failed to clear ${configPath}: ${e.message}`);
    }
}
// ========== CRIME LOOP ==========
async function farmCrime(ns, crime, color) {
    const validCrimes = ["Heist", "Assassination", "Grand Theft Auto"];
    if (!validCrimes.includes(crime)) {
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[crime]${color.reset} Invalid crime '${crime}'; use: ${validCrimes.join(", ")}`);
        return;
    }
    let beforeInt = ns.getPlayer().exp.intelligence;
    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[crime]${color.reset} Starting loop for ${crime}`);
    while (true) {
        ns.singularity.commitCrime(crime);
        await ns.sleep(ns.singularity.getCrimeStats(crime).time + 100);
        const currentInt = ns.getPlayer().exp.intelligence;
        const gain = currentInt - beforeInt;
        if (gain > 0) {
            let c = gain < 0.1 ? color.red : (gain < 1 ? color.yellow : (gain < 10 ? color.yellow : color.green));
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[crime]${color.reset} Gained${color.reset} ${c}${gain.toFixed(6)}${color.reset} ${color.cyan}Int XP${color.reset}`);
            beforeInt = currentInt;
        }
    }
}
// ========== SINGULARITY GO ==========
async function farmSingularityGo(ns, color) {
    const locations = ["Sector-12", "Aevum"];
    let beforeInt = ns.getPlayer().exp.intelligence;
    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[singularity-go]${color.reset} Starting location loop (low XP)`);
    let i = 0;
    while (true) {
        await ns.singularity.goToLocation(locations[i % 2]);
        i++;
        const currentInt = ns.getPlayer().exp.intelligence;
        const gain = currentInt - beforeInt;
        if (gain > 0) {
            let c = gain < 0.1 ? color.red : (gain < 1 ? color.yellow : (gain < 10 ? color.yellow : color.green));
            ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[singularity-go]${color.reset} Gained${color.reset} ${c}${gain.toFixed(6)}${color.reset} ${color.cyan}Int XP${color.reset}`);
            beforeInt = currentInt;
        }
        await ns.sleep(1);
    }
}
// ========== JOIN AND RESET ==========
async function farmJoinReset(ns, faction, color) {
    const invites = ns.singularity.checkFactionInvitations();
    if (!invites.includes(faction)) {
        ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[join-reset]${color.reset} No invite to ${faction}. Gain rep/invite first.`);
        return;
    }
    ns.tprint(`${color.red}[${timestamp()}]${color.reset} ${color.red}[join-reset]${color.reset} WARNING: Destructive loop! Joining ${faction}, resetting.`);
    ns.singularity.joinFaction(faction);
    ns.singularity.softReset("/scripts/singularity/int-farmer.js --mode=join-reset --target=" + faction);
}
