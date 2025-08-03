/** @param {NS} ns **/
export async function main(ns) {
    const logFile = "/logs/network-report.txt";

    // Parse flags
    const args = ns.flags([
        ["min-income", 0],      // Minimum income per minute in dollars
        ["require-root", false], // Only show servers with root access
        ["max-level", Infinity], // Maximum required hacking level
        ["top-n", 10],          // Number of top servers to list individually
        ["help", false]         // Display usage information
    ]);

    // Help message
    if (args.help) {
        ns.tprint(`
=== network-report.js Help ===
Usage: run network-report.js [options]

This script generates a detailed report of your network's server statistics, including
estimated income, hack times, and more. Use filters to customize the output.

Options:
  --min-income N        Minimum income per minute in dollars to include a server (default: 0)
  --require-root true   Show only servers with root access (default: false)
  --max-level N         Maximum required hacking level to include a server (default: Infinity)
  --top-n N             Number of top income servers to list individually (default: 10)
  --help                Display this help message

Examples:
  - Default report: run network-report.js
  - Top 5 servers with root access and income > $1M: run network-report.js --top-n 5 --require-root true --min-income 1000000
  - Servers up to level 500: run network-report.js --max-level 500

Output is saved to /logs/network-report.txt and displayed in the terminal.
        `.trim());
        return;
    }

    // Logging setup with buffering
    const logBuffer = [];
    const log = (msg) => logBuffer.push(msg);
    const flushLogs = () => {
        const ts = new Date().toISOString();
        const output = logBuffer.map(line => `[${ts}] > ${line}`).join("\n");
        ns.tprint(output);
        ns.write(logFile, output + "\n", "w");
    };

    log("Generating network report...");

    // Crawl network using BFS
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

    // Collect server statistics
    const stats = [];
    let totalIncomePerMinute = 0;
    for (const host of servers.keys()) {
        if (host === "home") continue;

        const hasRoot = ns.hasRootAccess(host);
        const reqLevel = ns.getServerRequiredHackingLevel(host);
        const maxMoney = ns.getServerMaxMoney(host);
        const minSecurity = ns.getServerMinSecurityLevel(host);
        const security = ns.getServerSecurityLevel(host);
        const growth = ns.getServerGrowth(host);
        const chance = ns.hackAnalyzeChance(host);
        const hackTime = ns.getHackTime(host) / 1000; // Convert to seconds

        // Estimate income per hack and per minute
        let incomePerHack = 0;
        let hacksPerMinute = 0;
        let hackThreads = 0;
        if (maxMoney > 0 && chance > 0) {
            incomePerHack = maxMoney * chance;
            hacksPerMinute = 60 / hackTime;
            hackThreads = Math.ceil(ns.hackAnalyzeThreads(host, maxMoney) || (maxMoney / ns.hackAnalyze(host)));
        }
        const incomePerMinute = incomePerHack * hacksPerMinute;

        totalIncomePerMinute += incomePerMinute;
        if (incomePerMinute >= args["min-income"] && (!args["require-root"] || hasRoot) && reqLevel <= args["max-level"]) {
            stats.push({
                host,
                hasRoot,
                reqLevel,
                maxMoney,
                securityDelta: security - minSecurity,
                growth,
                chance: chance * 100,
                hackTime,
                incomePerHack,
                incomePerMinute,
                hackThreads
            });
        }
    }

    // Sort by income per minute (descending)
    stats.sort((a, b) => b.incomePerMinute - a.incomePerMinute);

    // Format numbers using Intl.NumberFormat
    const formatCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    const formatPercent = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 2 });

    // Build report
    log("=== Network Report ===");
    log(`Total Servers: ${visited.size - 1}`);
    log(`Filtered Servers: ${stats.length}`);
    log(`Estimated Total Income Per Minute: ${formatCurrency.format(totalIncomePerMinute)}`);
    log("Top Income Sources (up to " + args["top-n"] + "):");
    stats.slice(0, args["top-n"]).forEach(s => {
        log(`  - ${s.host}:`);
        log(`    Income/Min: ${formatCurrency.format(s.incomePerMinute)}`);
        log(`    Income/Hack: ${formatCurrency.format(s.incomePerHack)}`);
        log(`    Chance: ${formatPercent.format(s.chance / 100)}`);
        log(`    Time: ${s.hackTime.toFixed(1)}s`);
        log(`    Threads: ${s.hackThreads > 0 ? s.hackThreads : "N/A"}`);
    });

    // Collapse remaining servers into ranges
    const remainingStats = stats.slice(args["top-n"]);
    const incomeRanges = {};
    remainingStats.forEach(s => {
        const range = Math.floor(s.incomePerMinute / 1000000); // Group by $1M increments
        incomeRanges[range] = (incomeRanges[range] || 0) + 1;
    });
    if (Object.keys(incomeRanges).length > 0) {
        log("Remaining Servers (by Income Range, $M/min):");
        for (const [range, count] of Object.entries(incomeRanges).sort((a, b) => b[0] - a[0])) {
            log(`  - $${range}M - $${range + 1}M: ${count} servers`);
        }
    }

    log(`Network Strength (Avg Hack Time): ${(stats.reduce((sum, s) => sum + (s.hackTime || 0), 0) / stats.length || 0).toFixed(1)}s`);
    log("=== End Report ===");

    flushLogs();
}