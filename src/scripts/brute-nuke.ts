/**
 * brute-nuke.js
 * Modern BIOS-format output, PRAAXIS_ALPHA standards.
 * v2.9.6 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage:
 *   run brute-nuke.js [--write] [--persistent] [--interval=60000] [--dry-run] [--quiet] [--silent] [--help]
 */

const OUTPUT_FILE = "/data/brute-nuked-servers.txt";
const ROOTED_FILE = "/data/rooted-servers.txt";
const PORT_OPENER_MAP = [
    { prog: "BruteSSH.exe",   fn: ns => ns.brutessh   },
    { prog: "FTPCrack.exe",   fn: ns => ns.ftpcrack   },
    { prog: "relaySMTP.exe",  fn: ns => ns.relaysmtp  },
    { prog: "HTTPWorm.exe",   fn: ns => ns.httpworm   },
    { prog: "SQLInject.exe",  fn: ns => ns.sqlinject  }
];

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        ["write", false],
        ["persistent", false],
        ["interval", 60000],
        ["dry-run", false],
        ["quiet", false],
        ["silent", false],
        ["help", false],
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
        if (type === "INIT")      colorType = c.cyan;
        else if (type === "SUCCESS") colorType = c.lgreen;
        else if (type === "SUMMARY") colorType = c.cyan;
        else if (type === "TERMINATE") { icon = c.cyan + "→" + c.reset; colorType = c.red; }
        let tags = [];
        tags.push(c.white + "[" + colorType + type + c.reset + c.white + "]" + c.reset);
        if (server) tags.push(c.white + "[" + server + "]" + c.reset);
        ns.tprint(`${icon} ${tags.join("")} ${c.white}${msg}${c.reset}`);
    }
    if (args.help) return showHelp(ns, c);
    biosHeader(ns, c, args);

    while (true) {
        let nuked = new Set();
        try {
            const data = ns.read(OUTPUT_FILE);
            nuked = new Set(data.split("\n").filter(s => s.trim()));
        } catch (_) {}

        const servers = bfsCrawl(ns);
        const availableOpeners = PORT_OPENER_MAP.filter(o => ns.fileExists(o.prog, "home"));
        let newlyNuked = [];
        for (const server of servers) {
            if (server === "home") continue;
            if (ns.hasRootAccess(server)) continue;
            const reqPorts = ns.getServerNumPortsRequired(server);
            if (availableOpeners.length < reqPorts) continue;

            biosMsg("INIT", `nuking ${server}...`, server);

            // Open ports
            for (let i = 0; i < reqPorts; ++i) {
                try { if (!args["dry-run"]) availableOpeners[i].fn(ns)(server); } catch (_) {}
            }
            // Nuke
            try { if (!args["dry-run"]) ns.nuke(server); } catch (_) {}

            if (ns.hasRootAccess(server) && !nuked.has(server)) {
                newlyNuked.push(server);
                biosMsg("SUCCESS", `rooted & logged.`, server);
                if (!args["dry-run"]) await ns.write(OUTPUT_FILE, server + "\n", "a");
            }
            await ns.sleep(100);
        }

        if (newlyNuked.length > 0)
            biosMsg("SUMMARY", `✅ ${newlyNuked.length} servers rooted this run.`);

        // Always show total, even if 0 new ones.
        let nukedNow = new Set();
        try {
            const data = ns.read(OUTPUT_FILE);
            nukedNow = new Set(data.split("\n").filter(s => s.trim()));
        } catch (_) {}
        biosMsg("SUMMARY", `✅ Total rooted servers: ${c.lgreen}${nukedNow.size}${c.white}`);

        // ALWAYS write rooted-servers.txt if --write is present, even if nothing was just rooted!
        if (args.write) {
            let allNowRooted = servers.filter(s => s !== "home" && ns.hasRootAccess(s));
            await ns.write(ROOTED_FILE, allNowRooted.join("\n"), "w");
            biosMsg("SUCCESS", `Updated ${ROOTED_FILE} (${allNowRooted.length} total rooted servers).`);
        }

        if (!args["persistent"]) break;
        await ns.sleep(args["interval"]);
    }
    biosMsg("TERMINATE", "Nuke routine complete.");
}

// --- Helpers ---
function bfsCrawl(ns) {
    const visited = new Set(["home"]);
    const queue = ["home"];
    while (queue.length > 0) {
        const host = queue.shift();
        for (const neighbor of ns.scan(host)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return [...visited];
}

function biosHeader(ns, c, args) {
    if (args.silent) return;
    ns.tprint(
        c.yellow + "→ brute-nuke.js: BRUTE-NUKE ─ NETWORK ROOTER" + c.reset
    );
    ns.tprint(
        c.cyan + "→ Automated and optionally persistent brute-nuking tool." + c.reset
    );
}

function showHelp(ns, c) {
    ns.tprint(
        `${c.bold + c.green}brute-nuke.js${c.reset} ${c.white}| Modular network nuke automation${c.reset}\n\n` +
        `${c.cyan}--write${c.reset}         ${c.yellow}Write all rooted servers to rooted-servers.txt after each run (even if 0 new rooted)${c.reset}\n` +
        `${c.cyan}--persistent${c.reset}   ${c.yellow}Loop and scan/nuke every interval${c.reset}\n` +
        `${c.cyan}--interval=ms${c.reset}  ${c.yellow}Sleep ms between persistent scans (default: 60000)${c.reset}\n` +
        `${c.cyan}--dry-run${c.reset}      ${c.yellow}Simulate, do not actually nuke or open ports${c.reset}\n` +
        `${c.cyan}--quiet${c.reset}        ${c.yellow}Suppress minor update messages${c.reset}\n` +
        `${c.cyan}--silent${c.reset}       ${c.yellow}Suppress all except errors/BIOS${c.reset}\n` +
        `${c.cyan}--help${c.reset}         ${c.yellow}Show this help screen${c.reset}\n`
    );
}
