/** @param {NS} ns **/
export async function main(ns) {
    const color = {
        reset: "\u001b[0m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        red: "\u001b[31m",
        cyan: "\u001b[36m",
        magenta: "\u001b[35m",
        gray: "\u001b[90m",
        white: "\u001b[37m"
    };

    function pad(str, w, r = false) {
        str = String(str);
        let strRaw = str.replace(/\u001b\[[0-9;]*m/g, '');
        if (strRaw.length > w) return strRaw.slice(0, w - 2) + "… ";
        let padding = " ".repeat(w - strRaw.length);
        return r ? padding + str : str + padding;
    }

    const player = ns.getPlayer();
    const reset = ns.getResetInfo();
    const bitnode = reset.currentNode;
    const playtimeBN = ns.tFormat(Date.now() - reset.lastNodeReset);
    const playtimeAug = ns.tFormat(Date.now() - reset.lastAugReset);
    const money = ns.getServerMoneyAvailable("home");
    const city = player.city;
    const kills = player.numPeopleKilled;
    const karma = ns.heart.break();
    const notoriety = player.notoriety || 0;
    const pname = player.name || "Player";

    // Stats
    const statTable = [
        ["Hacking", player.skills.hacking, player.exp.hacking, player.mults.hacking],
        ["Strength", player.skills.strength, player.exp.strength, player.mults.strength],
        ["Defense", player.skills.defense, player.exp.defense, player.mults.defense],
        ["Dexterity", player.skills.dexterity, player.exp.dexterity, player.mults.dexterity],
        ["Agility", player.skills.agility, player.exp.agility, player.mults.agility],
        ["Charisma", player.skills.charisma, player.exp.charisma, player.mults.charisma]
    ];

    // Augs
    const augs = ns.singularity.getOwnedAugmentations(true);
    function augColor(aug) {
        if (/NeuroFlux/.test(aug)) return color.red;
        if (/Daedalus|Red Pill/.test(aug)) return color.magenta;
        if (/Cranial|Neural|Signal/.test(aug)) return color.cyan;
        if (/gang|crime|bladeburner/i.test(aug)) return color.yellow;
        return color.white;
    }
    let augCounts = {};
    for (const a of augs) augCounts[a] = (augCounts[a] || 0) + 1;

    // Source-Files
    const sf = ns.getOwnedSourceFiles ? ns.getOwnedSourceFiles() : [];
    let sfStr = sf.length
        ? sf.map(s => {
            let lev = s.level > 1 ? `(${s.level})` : "";
            let c = (s.n === bitnode) ? color.green : (s.level > 1 ? color.yellow : color.gray);
            return c + `SF${s.n}${lev}` + color.reset;
        }).join(", ")
        : color.gray + "None" + color.reset;

    // Factions/companies
    let factions = player.factions.map(f =>
        color.yellow + f + color.reset +
        (ns.singularity.getFactionRep(f) > 0 ? color.green + ` (${ns.nFormat(ns.singularity.getFactionRep(f), "0.0a")} rep)` + color.reset : "")
    ).join(", ");

    let companies = Object.keys(player.jobs)
        .map(c =>
            `${color.cyan}${c}${color.reset} (${player.jobs[c]}, ${color.gray}${ns.nFormat(ns.singularity.getCompanyRep(c), "0.0a")} rep${color.reset})`
        ).join(", ");

    // Gang
    let gang = (ns.gang && ns.gang.inGang && ns.gang.inGang())
        ? ns.gang.getGangInformation()
        : null;

    // NeuroFlux count
    let nfgCount = augs.filter(a => a === "NeuroFlux Governor").length;

    // 1. Header / Position
    let out = [];
    out.push(
        `${color.cyan}${pname}${color.reset}   ` +
        `BitNode: ${color.green}${bitnode}${color.reset}   ` +
        `Playtime(BN): ${color.white}${playtimeBN}${color.reset}   ` +
        `Playtime(Aug): ${color.white}${playtimeAug}${color.reset}   ` +
        `Money: ${color.green}${ns.nFormat(money, "$0.00a")}${color.reset}   ` +
        `City: ${color.yellow}${city}${color.reset}`
    );
    out.push("");

    // 2. Stats
    out.push("Stats:");
    for (const [stat, lvl, exp, mult] of statTable) {
        out.push(` ${pad(stat + ":", 10)}${color.green}${pad(lvl, 6, true)}${color.reset}` +
            ` (exp: ${color.gray}${ns.nFormat(exp, "0.00a")}${color.reset}, mult: ${color.yellow}x${mult.toFixed(2)}${color.reset})`);
    }
    out.push("");

    // 3. Augs
    out.push(`Augs Installed:`);
    out.push(" " + augs.map(a =>
        augColor(a) + a + (augCounts[a] > 1 && a === "NeuroFlux Governor" ? ` x${augCounts[a]}` : "") + color.reset
    ).join(", "));
    out.push("");

    // 4. Source-Files
    out.push(`Source-Files: ${sfStr}`);
    out.push("");

    // 5. Factions / Companies
    out.push(`Factions: ${factions}`);
    if (companies) out.push(`Companies: ${companies}`);
    out.push("");

    // 6. Gang (if applicable)
    if (gang) {
        out.push(
            `Gang: ${color.cyan}${gang.faction}${color.reset}  Power: ${color.green}${ns.nFormat(gang.power, "0.00a")}${color.reset}  ` +
            `Members: ${gang.numGangMembers}/12  Money: ${color.green}${ns.nFormat(gang.money, "$0.00a")}${color.reset}  Territory: ${color.yellow}${gang.territory.toFixed(1)}%${color.reset}`
        );
        out.push("");
    }

    // 7. Other
    out.push(`Kills: ${color.red}${kills}${color.reset}    Karma: ${color.red}${ns.nFormat(karma, "0.0a")}${color.reset}`);
    if (notoriety > 0) out.push(`Notoriety: ${color.magenta}${notoriety}${color.reset}`);
    out.push("");

    // 8. Tips (expanded for demo)
    out.push("Tips:");
    if (karma <= -54000 && !gang) out.push(color.green + "Eligible to create a gang!" + color.reset);
    if (augs.includes("NeuroFlux Governor")) out.push(color.yellow + `You have purchased NeuroFlux Governor x${nfgCount}.` + color.reset);
    // Show tip if any faction rep > 25k and not in Daedalus
    if (!player.factions.includes("Daedalus") && player.factions.some(f => ns.singularity.getFactionRep(f) > 25000))
        out.push(color.cyan + "You may soon be invited to Daedalus. Stay above 250k money!" + color.reset);
    // You have enough rep for an aug at any faction
    let augsAvail = [];
    for (let f of player.factions) {
        let rep = ns.singularity.getFactionRep(f);
        let fa = ns.singularity.getAugmentationsFromFaction(f).filter(a => !augs.includes(a));
        for (let a of fa) {
            let r = ns.singularity.getAugmentationRepReq(a);
            if (rep >= r && !augsAvail.includes(a)) augsAvail.push(a);
        }
    }
    if (augsAvail.length > 0) out.push(color.green + `You can purchase new augmentations: ${augsAvail.join(", ")}` + color.reset);

    ns.tprint("\n" + out.join("\n"));
}
