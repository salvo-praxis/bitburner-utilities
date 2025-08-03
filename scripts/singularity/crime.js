/** @param {NS} ns **/
export async function main(ns) {
    // ==== Usage Message ====
    const usage = `
Usage: run crime.js [--mode profit|karma|list] [--commit N] [--help]

Modes:
  --mode profit   : Auto-commit crimes for max expected $/s (default)
  --mode karma    : Start Homicide once if 99%+ success, else warn & exit
  --mode list     : List all crimes, your stats, success %, profit/s, karma/s
  --commit N      : Commit a specific crime by number from the list
  --help          : Show this help message

Examples:
  run crime.js --mode list
  run crime.js --mode karma
  run crime.js --commit 5
`.trim();

    // ==== Parse Flags ====
    const args = ns.flags([
        ["mode", "profit"],
        ["commit", 0],
        ["help", false],
    ]);
    if (args.help) {
        ns.tprint(usage);
        return;
    }

    // ==== Get the Correct Crime API ====
    const crimeAPI = ns.singularity || ns;
    if (!crimeAPI.getCrimeStats || !crimeAPI.getCrimeChance) {
        ns.tprint("ERROR: Crime API unavailable. Make sure you have SF4 and are running on home.");
        return;
    }

    // ==== Crimes List (Bitburner Standard Order) ====
    const crimeList = [
        "Shoplift", "Rob store", "Mug someone", "Larceny",
        "Deal Drugs", "Bond Forgery", "Traffick Arms", "Homicide",
        "Grand theft auto", "Kidnap", "Assassination", "Heist"
    ];

    // ==== Formatting Helpers ====
    function formatMoney(n) {
        if (n > 1e9) return (n/1e9).toFixed(2)+'b';
        if (n > 1e6) return (n/1e6).toFixed(2)+'m';
        if (n > 1e3) return (n/1e3).toFixed(2)+'k';
        return n.toFixed(0);
    }
    function toTitleCase(str) {
        return str.replace(/\w\S*/g, txt => txt[0].toUpperCase() + txt.slice(1).toLowerCase());
    }
    function colorCyan(str) { return `\x1b[36m${str}\x1b[0m`; }

    // ==== List Mode ====
    if (args.mode === "list") {
        const col = { num: 3, crime: 18, time: 7, success: 8, profit: 7, karma: 8 };
        let out = [];
        out.push(""); // Blank line before
        out.push("==== CRIME LIST ====\n");
        out.push(
            "#".padEnd(col.num) + " " +
            "Crime".padEnd(col.crime) + " " +
            "Time".padStart(col.time) + " " +
            "Success".padStart(col.success) + " " +
            "$/s".padStart(col.profit) + " " +
            "Karma/s".padStart(col.karma)
        );
        out.push("-".repeat(col.num + col.crime + col.time + col.success + col.profit + col.karma + 5));

        crimeList.forEach((crime, i) => {
            const stats = crimeAPI.getCrimeStats ? crimeAPI.getCrimeStats(crime) : null;
            const chance = crimeAPI.getCrimeChance ? crimeAPI.getCrimeChance(crime) : 0;
            let name = toTitleCase(crime).padEnd(col.crime);
            let timeStr = stats ? (stats.time/1000).toFixed(1).padStart(col.time) : " N/A".padStart(col.time);
            let succStr = chance > 0 ? (chance*100).toFixed(1).padStart(col.success-1) + "%" : " N/A".padStart(col.success);
            let exp = (stats && stats.money && stats.time && chance) ? (stats.money / stats.time) * chance : 0;
            let profStr = exp ? formatMoney(exp).padStart(col.profit) : "  0".padStart(col.profit);
            let karmaPerSec = (stats && typeof stats.karma === "number" && stats.time && chance) ? (stats.karma / stats.time) * chance : 0;
            let karmaStr = karmaPerSec ? karmaPerSec.toFixed(4).padStart(col.karma) : " 0.0000".padStart(col.karma);

            // Cyan highlight for 100% success
            if (chance >= 1) name = colorCyan(name);

            out.push(
                `${(i+1).toString().padStart(col.num-1)}. ${name}${timeStr} ${succStr}${profStr}${karmaStr}`
            );
        });

        out.push(""); // Blank line after
        ns.tprint(out.join('\n'));
        return;
    }

    // ==== Karma Mode (Only Homicide, One-Off) ====
    if (args.mode === "karma") {
        const homicideChance = crimeAPI.getCrimeChance("Homicide");
        if (homicideChance < 0.99) {
            ns.tprint("[Crime] WARNING: Homicide success <99%. Train combat stats for efficient karma grind! (Aim for 100+ in Str/Def/Dex/Agi)");
            return;
        }
        ns.tprint("[Crime] Starting Homicide in background for max karma reduction...");
        await crimeAPI.commitCrime("Homicide");
        ns.tprint("[Crime] Homicide crime started. Script exiting—work will continue in background.");
        return;
    }

    // ==== Commit by Number Mode ====
    if (args.commit > 0) {
        let idx = args.commit - 1;
        if (idx < 0 || idx >= crimeList.length) {
            ns.tprint(`Invalid crime number. Use --mode list to see valid numbers.`);
            return;
        }
        let crime = crimeList[idx];
        ns.tprint(`Committing: ${crime}`);
        while (true) {
            await crimeAPI.commitCrime(crime);
            await ns.sleep(crimeAPI.getCrimeStats(crime).time + 200);
        }
    }

    // ==== Main Crime-Automation Mode (Profit) ====
    while (true) {
        let best = null;
        let bestScore = -Infinity;
        for (const crime of crimeList) {
            const stats = crimeAPI.getCrimeStats ? crimeAPI.getCrimeStats(crime) : null;
            const chance = crimeAPI.getCrimeChance ? crimeAPI.getCrimeChance(crime) : 0;
            if (!stats) continue;
            // Maximize expected profit per second
            const mps = (stats.money / stats.time) * chance;
            if (mps > bestScore) {
                bestScore = mps;
                best = crime;
            }
        }
        if (!best) {
            ns.tprint("No valid crimes found for your current stats!");
            return;
        }
        let out = `[Crime] Committing: ${best} (Expected $/sec: ${formatMoney(bestScore)})`;
        ns.tprint(out);
        await crimeAPI.commitCrime(best);
        await ns.sleep(crimeAPI.getCrimeStats(best).time + 200);
    }
}
