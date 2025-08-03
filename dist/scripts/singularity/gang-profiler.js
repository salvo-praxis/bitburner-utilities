/** @param {NS} ns **/
export async function main(ns) {
    // Color codes
    const color = {
        reset: "\u001b[0m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        red: "\u001b[31m",
        cyan: "\u001b[36m",
        magenta: "\u001b[35m",
        gray: "\u001b[90m"
    };
    if (!ns.gang.inGang()) {
        ns.tprint(color.red + "You are not in a gang!" + color.reset);
        return;
    }
    const gangInfo = ns.gang.getGangInformation();
    const memberNames = ns.gang.getMemberNames();
    const memberInfos = memberNames.map(name => ({
        name,
        ...ns.gang.getMemberInformation(name)
    }));
    // 1. Overall Gang Status
    let out = [];
    out.push(`${color.cyan}Gang: ${gangInfo.faction}   Respect: ${ns.nFormat(gangInfo.respect, "0.0a")}   Wanted: ${gangInfo.wantedLevel.toFixed(2)}   Money: ${ns.nFormat(ns.getServerMoneyAvailable("home"), "$0.0a")}   Territory: ${(gangInfo.territory * 100).toFixed(1)}%   Warfare: ${gangInfo.territoryWarfareEngaged ? "ON" : "OFF"}${color.reset}\n`);
    // 2. Suggest recruit
    if (ns.gang.canRecruitMember()) {
        out.push(`${color.green}[Recruit]: You can recruit a new member!${color.reset}\n`);
    }
    // 3. Table Header
    const nameW = 10, statW = 5, ascW = 5, taskW = 12, bestW = 13, ascSW = 14, gearW = 15;
    out.push(`${pad("Name", nameW)}${pad("Str", statW)}${pad("Dex", statW)}${pad("Agi", statW)}${pad("Cha", statW)}${pad("AscM", ascW)}${pad("Task", taskW)}${pad("Best Crime", bestW)}${pad("Can Ascend?", ascSW)}${pad("Missing Gear", gearW)}`);
    out.push("-".repeat(nameW + statW * 4 + ascW + taskW + bestW + ascSW + gearW));
    // 4. For each member
    for (const m of memberInfos) {
        // Stats
        const { name, strength, defense, dexterity, agility, charisma, ascensionResult, ascensionMult, task, upgrades } = m;
        const mainAsc = Math.max(ascensionResult?.strength || 1, ascensionResult?.defense || 1, ascensionResult?.dexterity || 1, ascensionResult?.agility || 1);
        const ascMultStr = "x" + (Math.max(m.str_asc_mult, m.def_asc_mult, m.dex_asc_mult, m.agi_asc_mult)).toFixed(1);
        // Ascend suggestion
        let canAscend = (ascensionResult && mainAsc > 1.5);
        let ascendStr = canAscend
            ? color.green + "YES (x" + mainAsc.toFixed(1) + ")" + color.reset
            : color.gray + "No" + color.reset;
        // Task
        let bestCrime = getBestCrimeForStats(ns, m);
        // Gear
        let missing = getMissingUpgrades(ns, m);
        out.push(`${pad(name, nameW)}${pad(strength, statW)}${pad(dexterity, statW)}${pad(agility, statW)}${pad(charisma, statW)}${pad(ascMultStr, ascW)}${pad(task, taskW)}${pad(bestCrime, bestW)}${pad(ascendStr, ascSW)}${pad(missing, gearW)}`);
    }
    // 5. Global suggestions (expand as needed)
    let suggestions = [];
    // Ascend advice
    let ascenders = memberInfos.filter(m => {
        let res = ns.gang.getAscensionResult(m.name);
        return res && Math.max(...Object.values(res)) > 1.5;
    });
    if (ascenders.length > 0) {
        suggestions.push(`${color.green}- Ascend: ${ascenders.map(m => m.name).join(", ")} now for major multiplier gain.${color.reset}`);
    }
    // Gear advice (simplified)
    let gearAdvised = memberInfos.map(m => ({ name: m.name, miss: getMissingUpgrades(ns, m) })).filter(x => x.miss);
    if (gearAdvised.length > 0) {
        suggestions.push(`${color.yellow}- Buy gear for: ${gearAdvised.map(x => x.name + " (" + x.miss + ")").join(", ")}${color.reset}`);
    }
    // Training/crime tasking
    let trainable = memberInfos.filter(m => m.strength < 75 || m.dexterity < 75 || m.agility < 75);
    if (trainable.length > 0) {
        suggestions.push(`${color.cyan}- Consider training: ${trainable.map(m => m.name).join(", ")} (stats <75).${color.reset}`);
    }
    // Territory warning
    if (gangInfo.territoryWarfareEngaged && gangInfo.territory < 0.85) {
        suggestions.push(`${color.red}- Territory war ON with low control. Risk of losing members!${color.reset}`);
    }
    out.push("-".repeat(nameW + statW * 4 + ascW + taskW + bestW + ascSW + gearW));
    out.push("Suggestions:");
    out.push(...suggestions);
    // 6. Print all at once
    ns.tprint("\n" + out.join("\n"));
    // --- Utility functions ---
    function pad(str, len) { str = String(str); return str.length >= len ? str.slice(0, len - 1) + "…" : str + " ".repeat(len - str.length); }
    function getBestCrimeForStats(ns, member) {
        // Basic version: pick best crime based on average stats
        // Replace with a true lookup table for max precision
        let s = member.strength, d = member.dexterity, a = member.agility, ch = member.charisma;
        if (s > 100 && d > 100 && a > 100)
            return "Arms Traffic";
        if (s > 60 && d > 60)
            return "Mug People";
        if (ch > 90)
            return "Human Traffick";
        return "Train";
    }
    function getMissingUpgrades(ns, member) {
        // List missing upgrades (equipment)
        let allUpgs = ns.gang.getEquipmentNames();
        let missing = allUpgs.filter(u => !member.upgrades.includes(u));
        return missing.length > 0 ? missing.join(", ") : "";
    }
}
