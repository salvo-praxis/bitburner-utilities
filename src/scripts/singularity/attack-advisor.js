/** @param {NS} ns **/
export async function main(ns) {
    const player = ns.getPlayer();
    const bitNode = player.bitNodeN;
    const hacking = player.hacking ?? player.skills?.hacking ?? 0;
    const strength = player.strength ?? player.skills?.strength ?? 0;
    const defense = player.defense ?? player.skills?.defense ?? 0;
    const dexterity = player.dexterity ?? player.skills?.dexterity ?? 0;
    const agility = player.agility ?? player.skills?.agility ?? 0;
    const combatStats = [strength, defense, dexterity, agility];
    const money = ns.getServerMoneyAvailable("home");
    const karma = player.karma ?? 0;
    const homeRam = ns.getServerMaxRam("home");
    const ownedAugs = player.augmentations ?? [];
    const factions = player.factions ?? [];
    const companies = player.jobs ? Object.keys(player.jobs) : [];
    const ownedPrograms = ns.ls("home").filter(f => f.endsWith(".exe"));
    const requiredPrograms = [
        "BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"
    ];
    const missingPrograms = requiredPrograms.filter(p => !ownedPrograms.includes(p));
    const hasTor = ownedPrograms.includes("tor.exe") || money >= 200000;
    let corpUnlocked = false, gangUnlocked = false, bladeUnlocked = false, hacknetUnlocked = ns.hacknet.numNodes() > 0;
    try { corpUnlocked = ns.corporation.hasCorporation(); } catch {}
    try { gangUnlocked = ns.gang.inGang(); } catch {}
    try { bladeUnlocked = !!ns.bladeburner.getRank(); } catch {}

    // ---- PHASE DETECTION ----
    let phase = "Early";
    if (corpUnlocked || gangUnlocked || bladeUnlocked || ownedAugs.length >= 1 || hacking >= 500) phase = "Mid";
    if (ownedAugs.length >= 10 || (corpUnlocked && ns.corporation.getCorporation().funds > 1e12) || hacking >= 1500) phase = "Late";

    // ---- HACKING TARGETS ----
    let bestMoneyServer = null, bestXpServer = null;
    let hackServers = [];
    try {
        hackServers = ns.scan("home")
            .map(s => s)
            .concat(ns.scan("home").flatMap(s => ns.scan(s)))
            .filter(s => s !== "home" && ns.hasRootAccess(s));
    } catch {}
    hackServers = [...new Set(hackServers)];
    // Filter for XP/money targets
    let xpScores = hackServers.map(s => ({
        server: s,
        score: ns.getServerRequiredHackingLevel(s) <= hacking ? ns.getHackTime(s) : 1e12
    })).sort((a,b)=>a.score-b.score);
    let moneyScores = hackServers.map(s => ({
        server: s,
        money: ns.getServerMaxMoney(s) || 0
    })).sort((a,b)=>b.money-a.money);

    bestXpServer = xpScores[0]?.server || "n00dles";
    bestMoneyServer = moneyScores.find(s => s.money > 0)?.server || "n00dles";

    // ---- PURCHASED SERVER ANALYSIS ----
    let psLimit = ns.getPurchasedServerLimit ? ns.getPurchasedServerLimit() : 25;
    let psOwned = ns.getPurchasedServers ? ns.getPurchasedServers() : [];
    let psBestRam = Math.max(0, ...psOwned.map(s=>ns.getServerMaxRam(s)));
    let psNextTier = [16,32,64,128,256,512,1024,2048,4096,8192,16384,32768,65536,131072,262144,524288,1048576].find(x => x > psBestRam) || null;
    let psNextTierCost = psNextTier ? ns.getPurchasedServerCost(psNextTier) : null;
    let psAdvice = "";
    if (psOwned.length < psLimit) {
        psAdvice = `You own ${psOwned.length}/${psLimit} purchased servers. Next RAM tier: ${psNextTier ?? "max"} (${psNextTierCost ? "$"+ns.nFormat(psNextTierCost, "0.0a") : "N/A"}).`;
    } else {
        psAdvice = `Purchased servers at max slots (${psLimit}); consider upgrading old servers to higher RAM.`;
    }

    // ---- FACTION/AUGMENT SHOPPING ----
    let augAdvice = "";
    try {
        let bestAug = "";
        let repNeeded = 0;
        for (const f of factions) {
            const augs = ns.getAugmentationsFromFaction(f);
            for (const aug of augs) {
                if (!ownedAugs.includes(aug) && ns.getAugmentationRepReq(aug) > repNeeded && ns.getAugmentationPrice(aug) < money) {
                    bestAug = aug;
                    repNeeded = ns.getAugmentationRepReq(aug);
                }
            }
        }
        if (bestAug) augAdvice = `You can afford '${bestAug}' if you reach ${ns.nFormat(repNeeded,"0.0a")} rep in a joined faction.`;
    } catch (e) {
        augAdvice = "(Faction aug analysis unavailable: need Singularity API access/SF4.)";
    }

    // ---- CORPORATION, GANG, BLADEBURNER STATUS ----
    let corpAdvice = "";
    if (corpUnlocked) {
        try {
            const corp = ns.corporation.getCorporation();
            corpAdvice = `Corp funds: $${ns.nFormat(corp.funds, "0.0a")}, Dividends: $${ns.nFormat(corp.dividendEarnings ?? 0, "0.0a")}`;
        } catch {}
    }
    let gangAdvice = "";
    if (gangUnlocked) {
        try {
            const gang = ns.gang.getGangInformation();
            gangAdvice = `Gang: ${gang.faction}, Members: ${gang.numMembers}, Wanted Level: ${gang.wantedLevel}`;
        } catch {}
    }
    let bladeAdvice = "";
    if (bladeUnlocked) {
        try {
            const bb = ns.bladeburner.getRank();
            bladeAdvice = `Bladeburner rank: ${bb}`;
        } catch {}
    }

    // ---- MAJOR UNLOCKS AND PROGRESS ----
    const gangPct = Math.max(0, Math.min(100, Math.abs(karma) / 54000 * 100));
    const allCombat100 = combatStats.every(x => x >= 100);
    // Backdoors
    const serverBackdoors = [
        {name: "CSEC", level: 50, faction: "CyberSec"},
        {name: "avmnite-02h", level: 175, faction: "NiteSec"},
        {name: "I.I.I.I", level: 230, faction: "The Black Hand"},
        {name: "run4theh111z", level: 300, faction: "BitRunners"},
        {name: "The-Cave", level: 500, faction: "Daedalus"},
    ];
    let backdoorSuggestions = [];
    for (const {name, level, faction} of serverBackdoors) {
        if (hacking >= level && !factions.includes(faction)) {
            backdoorSuggestions.push(`Backdoor ${name} (hacking ${level}) for '${faction}' invite.`);
        } else if (hacking < level && (level - hacking) <= 10) {
            backdoorSuggestions.push(`Only ${level-hacking} hacking from ${name} (${faction}) backdoor.`);
        }
    }

    // ---- PRIORITIZED NEXT ACTIONS ----
    let actions = [];
    if (phase === "Early") actions.push("Focus: unlock Corp/Gang, build Home RAM, buy all hack programs, backdoor servers for factions.");
    if (phase === "Mid") actions.push("Focus: buy augs, push corp/gang/Bladeburner growth, upgrade purchased servers, target key factions.");
    if (phase === "Late") actions.push("Focus: buy last augs, NeuroFlux grind, consider prestige/install augs.");

    // Major recommendations, prioritized
    if (!hasTor && money < 200000) actions.push(`Earn $${ns.nFormat(200000 - money, "0.0a")} for Tor router.`);
    else if (!hasTor) actions.push("Buy Tor router from terminal for $200k.");
    else if (missingPrograms.length > 0) actions.push(`Buy missing hack programs: ${missingPrograms.join(", ")}.`);
    if (hacking < 50) actions.push(`Level up hacking to 50+ for CSEC backdoor (now: ${hacking}).`);
    else if (hacking < 100) actions.push(`Raise hacking to 100+ for more servers (now: ${hacking}).`);
    if (homeRam < 32 && money > 1e6) actions.push(`Upgrade 'home' RAM (now ${homeRam}GB).`);
    if (!corpUnlocked && money >= 150e9) actions.push(`$${ns.nFormat(money, "0.0a")} (>$150B): Start Corporation for major passive income.`);
    else if (!corpUnlocked && money >= 150e6) actions.push(`$${ns.nFormat(money, "0.0a")} (>$150M): Start Corporation (slower, but valid).`);
    if (!gangUnlocked && hacking >= 100 && karma > -54000) actions.push(`Homicide crime to karma -54,000 (now: ${karma.toFixed(1)}, ${gangPct.toFixed(1)}%).`);
    else if (!gangUnlocked && karma <= -54000) actions.push(`Eligible for Gang (karma: ${karma.toFixed(1)}). Join in Slum City.`);
    if (!bladeUnlocked && allCombat100 && hacking >= 250) actions.push("You can join Bladeburner (combat 100+, hacking 250+).");
    else if (!bladeUnlocked && !allCombat100 && Math.max(...combatStats) > 0) {
        const needed = combatStats.map((s,i) => s >= 100 ? "" : ["Str", "Def", "Dex", "Agi"][i]).filter(Boolean).join(", ");
        actions.push(`Raise ${needed} to 100+ for Bladeburner unlock.`);
    }
    if (backdoorSuggestions.length > 0) actions.push(...backdoorSuggestions);
    if (augAdvice) actions.push(augAdvice);
    if (ownedAugs.length > 2 && money > 1e9) actions.push("Buy more augs from factions with enough rep/cash.");
    if (ownedAugs.length > 10) actions.push("10+ augs owned: consider installing/prestige soon.");
    if (!hacknetUnlocked) actions.push("Purchase a Hacknet node for passive income.");
    if (psAdvice) actions.push(psAdvice);

    // ---- OUTPUT ----
    ns.tprint(`
===================== Bitburner Total Strategy Advisor =====================
BitNode: ${bitNode} | SF Level: ${player.sourceFiles?.find(f => f.n === bitNode)?.lvl ?? 1} | Phase: ${phase}
-- Your Stats --
- Hacking: ${hacking}    - Karma: ${karma.toFixed(1)}    - Money: $${ns.nFormat(money, "0.0a")}
- Home RAM: ${homeRam}GB - Augs: ${ownedAugs.length}     - Factions: ${factions.length}
- Combat (Str/Def/Dex/Agi): ${combatStats.join(" / ")}
-- Hack Programs --
- Owned: ${ownedPrograms.length}/${requiredPrograms.length}   - Missing: ${missingPrograms.length ? missingPrograms.join(", ") : "None"}
-- Feature Unlocks --
- Corp: ${corpUnlocked ? "YES" : "no"}   - Gang: ${gangUnlocked ? "YES" : "no"}   - Blade: ${bladeUnlocked ? "YES" : "no"}   - Hacknet: ${hacknetUnlocked ? "YES" : "no"}
-- Backdoor Opportunities --
${backdoorSuggestions.length ? backdoorSuggestions.join("\n") : "None currently (raise hacking for next one)."}
-- Purchased Servers --
${psAdvice}
-- Faction/Aug Shopping --
${augAdvice}
-- Corp/Gang/Bladeburner Status --
${corpAdvice ? "- Corp: " + corpAdvice : ""}
${gangAdvice ? "- Gang: " + gangAdvice : ""}
${bladeAdvice ? "- Bladeburner: " + bladeAdvice : ""}
-- Hacking Recommendations --
- Best money target: ${bestMoneyServer}    - Best XP target: ${bestXpServer}
-- Next Recommended Steps --
${actions.map((s,i)=>`${i+1}. ${s}`).join("\n")}
===========================================================================
`);
}
