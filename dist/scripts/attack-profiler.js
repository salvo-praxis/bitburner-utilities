/** @param {NS} ns **/
export async function main(ns) {
    // Helper: human-format
    function fmt(n) {
        return n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' :
            n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' :
                n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n.toFixed(2);
    }
    const nodeProfiles = [
        {
            n: 1, name: "The World (Default)", best: "Hacking/Crime/Corp/Gangs",
            steps: [
                "1. Start with small hacking scripts for money until you reach at least $10M.",
                "2. Do crime (Homicide) for Karma (-54,000) if you want Gangs (optional, but strong).",
                "3. Farm company rep for factions you want (e.g., for augments).",
                "4. Unlock Corporation by buying Tor and then Corporation program.",
                "5. Run Corporation for cash and augment farming (with dividend focus).",
                "6. Use gangs, corp, and hacking to buy out all augments you can, then prestige.",
                "7. If late game, auto-loop augment purchase/install using Singularity."
            ],
            thresholds: [
                "Get hacking skill to ~200-250 ASAP for initial cash.",
                "Crime is best if you want gang unlocks/factions.",
                "Corporation snowballs after ~$150B banked, but can start at $150M (slow)."
            ],
            why: "Everything is open. Best is to combine hacking (for early money), corporation (for passive/late-game cash), and optionally gangs for rep and income."
        },
        {
            n: 2, name: "Companies (Corporation)", best: "Corporation/Companies",
            steps: [
                "1. Focus on reaching $150B for Corporation ASAP—crime for seed cash if necessary.",
                "2. Start a Corporation, rush to product creation, scale up for massive money.",
                "3. Use Company work for rep (especially MegaCorp, Blade Industries, KuaiGong, NWO, EC, Four Sigma, Omnitek, Bachman & Clarke, and Fulcrum Technologies).",
                "4. Buy out augments, prestige as soon as comfortable.",
                "5. Hacking is not as strong, but still good for early seed money."
            ],
            thresholds: [
                "Start Corporation as soon as you hit $150B, or $150M for slow start.",
                "Prioritize Corporation augments for faster ramp-up.",
                "Company rep targets: ~400k for most augs, more for NeuroFlux."
            ],
            why: "Corporation mechanics are supercharged—this is the fastest path."
        },
        {
            n: 3, name: "Servers", best: "Hacking + Servers",
            steps: [
                "1. Hacking is king. Start by hacking n00dles, then advance up the server list.",
                "2. Use cash to buy as many purchased servers as possible, maximize RAM.",
                "3. Upgrade home RAM early and often—Home is massively buffed.",
                "4. Avoid corp/crime focus unless you want fun variety.",
                "5. Prestige when you run out of affordable augments or diminishing returns."
            ],
            thresholds: [
                "Try to get Home RAM to 2TB+ ASAP.",
                "Purchased servers: buy up to limit, upgrade in steps (16GB, 32GB, ... 1TB+)."
            ],
            why: "Server-based hacking is the fastest path to cash and augs in this node."
        },
        {
            n: 4, name: "Singularity", best: "Full Automation (Singularity)",
            steps: [
                "1. Script everything! Use Singularity to automate work, rep, aug buy/install.",
                "2. Focus on hacking for early money, then automate corp/gang if desired.",
                "3. Set up full reset loops: buy augs, install, reboot, re-root, re-deploy—all by script.",
                "4. Minimize downtime by letting your script manage every phase (including post-reset).",
                "5. Prestige as soon as most augs bought (optional: leave NeuroFlux for ultra-late)."
            ],
            thresholds: [
                "Automate all progress: hacks, rep, purchases, resets.",
                "Script rep farming for factions/companies.",
                "Set a cash threshold for augment splurge (e.g., buy all below $1B, then install)."
            ],
            why: "Singularity is about speed via total automation—less about manual min-maxing, more about efficiency loops."
        },
        {
            n: 5, name: "Bladeburner", best: "Bladeburner",
            steps: [
                "1. Start in Bladeburner ASAP; hacking is much weaker.",
                "2. Farm contracts/operations for rank and skills.",
                "3. Purchase Bladeburner-specific augs early, use money for stamina upgrades.",
                "4. Replicate for SF as soon as you can afford all main augs.",
                "5. Use hacking only as a minor income booster."
            ],
            thresholds: [
                "Farm rank to unlock new cities/ops.",
                "Get Bladeburner augs before prestige."
            ],
            why: "Bladeburner division is the core mechanic here—lean into it."
        },
        {
            n: 6, name: "Hacknet", best: "Hacknet",
            steps: [
                "1. Buy as many Hacknet nodes as possible, upgrade cores/levels/memory.",
                "2. Prioritize Hacknet augs and spend most cash on upgrades.",
                "3. Hacknet income will snowball—use it to buy all other augs.",
                "4. Prestige once you hit diminishing returns."
            ],
            thresholds: [
                "Get 12+ Hacknet nodes, max out upgrades where possible.",
                "Buy all Hacknet augs each run."
            ],
            why: "Hacknet nodes are god-tier in this node; other routes are slow."
        },
        // Add more as desired...
    ];
    const player = ns.getPlayer();
    const bitNode = player.bitNodeN;
    // Robust SF detection:
    let sf = 1;
    if (player.sourceFiles && Array.isArray(player.sourceFiles)) {
        const file = player.sourceFiles.find(f => f.n === bitNode);
        if (file && file.lvl)
            sf = file.lvl;
    }
    // Only call getBitNodeMultipliers() if we have SF5
    let mults = {
        HackingLevel: 1,
        ServerMaxMoney: 1,
        CompanyRepGain: 1,
        CrimeSuccessRate: 1,
        HacknetNodeMoney: 1,
        CorporationValuation: 1,
        BladeburnerRank: 1
    };
    let canReadMults = false;
    if (player.sourceFiles && Array.isArray(player.sourceFiles)) {
        canReadMults = player.sourceFiles.some(f => f.n === 5);
    }
    if (canReadMults) {
        mults = ns.getBitNodeMultipliers();
    }
    const node = nodeProfiles.find(n => n.n === bitNode);
    ns.tprint(`
========== BitNode Attack Profile ==========
BitNode: ${bitNode} - ${node ? node.name : "Unknown"}
SF Level: ${sf}
---------------------------------------
Key Multipliers:
- Hacking: x${mults.HackingLevel?.toFixed(2) ?? "N/A"}
- Money: x${mults.ServerMaxMoney?.toFixed(2) ?? "N/A"}
- Company Rep: x${mults.CompanyRepGain?.toFixed(2) ?? "N/A"}
- Crime: x${mults.CrimeSuccessRate?.toFixed(2) ?? "N/A"}
- Hacknet: x${mults.HacknetNodeMoney?.toFixed(2) ?? "N/A"}
- Corp: x${mults.CorporationValuation?.toFixed(2) ?? "N/A"}
- Bladeburner: x${mults.BladeburnerRank?.toFixed(2) ?? "N/A"}

================= STRATEGY =================
Best Approach: ${node ? node.best : "Unknown"}

${node ? node.why : "No strategy available for this node."}

----------------- Step Plan ----------------
${node && node.steps ? node.steps.map(s => "- " + s).join('\n') : ""}

----------------- Thresholds ---------------
${node && node.thresholds ? node.thresholds.map(s => "- " + s).join('\n') : ""}

===========================================
`);
}
