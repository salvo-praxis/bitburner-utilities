/** 
 * tor-purchase.js
 * Buys Tor Router & all port hacking programs, waits for funds, then self-terminates.
 * v1.1 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage: run tor-purchase.js [--quiet] [--silent]
 */

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        ["quiet", false],
        ["silent", false],
        ["help", false]
    ]);

    // Color codes
    const c = {
        reset: "\u001b[0m",
        cyan: "\u001b[36m",
        yellow: "\u001b[33m",
        green: "\u001b[32m",
        red: "\u001b[31m",
        white: "\u001b[37m"
    };

    // Helper: message printer
    function msg(message, level = "info") {
        if (args.silent) return;
        if (args.quiet && level === "status") return;
        ns.tprint(message);
    }

    if (args.help) {
        ns.tprint(`
${c.cyan}tor-purchase.js${c.reset} - Auto-buy Tor & all port hacking programs.

${c.yellow}Usage:${c.reset}
  run tor-purchase.js [--quiet] [--silent]

${c.yellow}Flags:${c.reset}
  --quiet    Only show init and exit/summary messages
  --silent   Suppress all output (overrides --quiet)
  --help     Show this message
        `);
        return;
    }

    const programs = [
        { name: "BruteSSH.exe",     buy: () => ns.singularity.purchaseProgram("BruteSSH.exe"),     cost: 500000 },
        { name: "FTPCrack.exe",     buy: () => ns.singularity.purchaseProgram("FTPCrack.exe"),     cost: 1500000 },
        { name: "relaySMTP.exe",    buy: () => ns.singularity.purchaseProgram("relaySMTP.exe"),    cost: 5000000 },
        { name: "HTTPWorm.exe",     buy: () => ns.singularity.purchaseProgram("HTTPWorm.exe"),     cost: 30000000 },
        { name: "SQLInject.exe",    buy: () => ns.singularity.purchaseProgram("SQLInject.exe"),    cost: 250000000 },
    ];

    msg(`${c.cyan}[tor-purchase.js]${c.reset} Starting: Auto-buying Tor Router & port hacking programs...`, "init");

    // Buy Tor Router first if not owned
    if (!ns.singularity.purchaseTor()) {
        if (!ns.getPlayer().tor) {
            // Wait for enough funds to buy Tor
            const torCost = 200000;
            while (ns.getPlayer().money < torCost) {
                await ns.sleep(2500);
            }
            if (ns.singularity.purchaseTor()) {
                msg(`${c.green}[tor-purchase.js]${c.reset} Purchased Tor Router!`, "status");
            } else {
                msg(`${c.red}[tor-purchase.js]${c.reset} Failed to buy Tor Router (unexpected).`, "status");
                return;
            }
        }
    } else {
        msg(`${c.yellow}[tor-purchase.js]${c.reset} Tor Router already owned.`, "status");
    }

    // Buy missing programs one by one
    for (const prog of programs) {
        if (ns.fileExists(prog.name, "home")) {
            msg(`${c.yellow}[tor-purchase.js]${c.reset} Already have ${prog.name}`, "status");
            continue;
        }
        while (ns.getPlayer().money < prog.cost) {
            await ns.sleep(2500);
        }
        if (prog.buy()) {
            msg(`${c.green}[tor-purchase.js]${c.reset} Purchased ${prog.name} for \$${ns.formatNumber(prog.cost)}`, "status");
        } else {
            msg(`${c.red}[tor-purchase.js]${c.reset} Failed to buy ${prog.name} (may not have Tor?)`, "status");
            break;
        }
    }

    // Check if all are owned
    const missing = programs.filter(p => !ns.fileExists(p.name, "home"));
    if (missing.length === 0) {
        msg(`${c.green}[tor-purchase.js]${c.reset} All port hacking programs acquired! Exiting.`, "term");
    } else {
        msg(`${c.red}[tor-purchase.js]${c.reset} Did not acquire all programs. See above for errors.`, "term");
    }
}
