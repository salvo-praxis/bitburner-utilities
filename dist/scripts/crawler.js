/**
 * crawler.js
 * PRAAXIS_ALPHA Automation Suite (v2.10, 2025-07-24)
 * Author: Salvo Praxis (Robert Cleaver)
 * Usage: run crawler.js [--crawl] [--reset] [--help]
 */
/** @param {NS} ns **/
export async function main(ns) {
    // === COLOR + BIOS OUTPUT CONSTANTS ===
    const color = {
        reset: "\u001b[0m",
        white: "\u001b[37m",
        cyan: "\u001b[36m",
        green: "\u001b[32m",
        brightGreen: "\u001b[92m",
        red: "\u001b[31m",
        yellow: "\u001b[33m",
        magenta: "\u001b[35m"
    };
    const ARROW = color.cyan + "→" + color.reset;
    const CHECK = color.brightGreen + "✅" + color.reset;
    const ERROR = color.red + "🟥" + color.reset;
    function BIOS(type, ctx, msg, icon = "") {
        let tcol = color.cyan;
        if (type === "success")
            tcol = color.brightGreen;
        else if (type === "error" || type === "terminate")
            tcol = color.red;
        else if (type === "summary")
            tcol = color.cyan;
        else if (type === "crawl")
            tcol = color.magenta;
        return (`${color.white}[${tcol}${(type || "INFO").toUpperCase()}${color.white}]`
            + `[${color.white}${ctx}${color.white}] ${msg}${icon ? " " + icon : ""}${color.reset}`);
    }
    // Output buffer for BIOS-style output
    let outBuffer = [];
    function print() { outBuffer.forEach(line => ns.tprint(line)); }
    // === ARGUMENTS & FILES ===
    const args = ns.flags([
        ["crawl", false],
        ["reset", false],
        ["help", false],
    ]);
    const knownServersFile = "/data/known-servers.txt";
    const distributedTargetsFile = "/data/target-list.txt";
    const backdooredServersFile = "/data/backdoored-servers.txt";
    const bruteNukedFile = "/data/brute-nuked-servers.txt";
    // === HELP MODE ===
    if (args.help) {
        outBuffer.push(BIOS("summary", "HELP", `
Usage:
  run crawler.js [--crawl] [--reset] [--help]

Flags:
  --crawl      Discover network (default behavior if no other flag given)
  --reset      Clear all known server/target/backdoor files
  --help       Show this help text

Files:
  /data/known-servers.txt   (all discovered servers)
  /data/distributed-targets.txt   (target list, now handled by targeting.js)
  /data/backdoored-servers.txt
  /data/brute-nuked-servers.txt
`.trim()));
        print();
        return;
    }
    // === RESET MODE ===
    if (args.reset) {
        outBuffer.push(BIOS("terminate", "RESET", "Clearing server data files..."));
        const defaultTargets = "n00dles\nfoodnstuff\n";
        const filesToClear = [
            [knownServersFile, ""],
            [backdooredServersFile, ""],
            [bruteNukedFile, ""],
            [distributedTargetsFile, defaultTargets]
        ];
        for (const [file, contents] of filesToClear) {
            ns.write(file, contents, "w");
        }
        outBuffer.push(BIOS("success", "RESET", "Server files reset. 'n00dles' and 'foodnstuff' preserved as starter targets."));
        print();
        return;
    }
    // === DEFAULT: CRAWL (if --crawl given or no mode flag at all) ===
    // If user passes neither --reset nor --help, default to crawl
    if (args.crawl || (!args.reset && !args.help)) {
        // BFS crawl
        const servers = new Map();
        const visited = new Set(["home"]);
        const queue = ["home"];
        while (queue.length > 0) {
            const current = queue.shift();
            const neighbors = ns.scan(current);
            servers.set(current, neighbors);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        // Write to file
        const lines = [];
        for (const [host, connections] of servers.entries()) {
            lines.push(`${host}: ${connections.join(", ")}`);
        }
        ns.write(knownServersFile, lines.join("\n"), "w");
        outBuffer.push(BIOS("init", "CRAWL", `Discovered ${lines.length} servers.`, CHECK));
        print();
        return;
    }
    // === FALLBACK ===
    outBuffer.push(BIOS("error", "ERROR", `Unknown or missing flag. Use --help for usage.`, ERROR));
    print();
}
