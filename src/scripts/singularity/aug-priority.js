/** @param {NS} ns **/
const nameW = 21, srcW = 13, priceW = 10, repW = 10, stW = 8, whyW = 12;

export async function main(ns) {
    const args = ns.flags([
        ["mode", "hacking"],
        ["top", 10],
        ["help", false]
    ]);
    if (args.help) return ns.tprint("Usage: run aug-priority.js --mode hacking --top 10");

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

    const player = ns.getPlayer();
    const factions = player.factions;
    const owned = ns.singularity.getOwnedAugmentations(true);
    const money = ns.getServerMoneyAvailable("home");

    // 1. Gather augmentations
    let augList = [];
    const joinedFactionReps = Object.fromEntries(factions.map(f => [f, ns.singularity.getFactionRep(f)]));
    let allAugs = new Set(), augSources = {};
    for (const fac of factions) {
        for (const aug of ns.singularity.getAugmentationsFromFaction(fac)) {
            allAugs.add(aug);
            if (!augSources[aug]) augSources[aug] = [];
            augSources[aug].push(fac);
        }
    }
    for (const aug of allAugs) {
        if (owned.includes(aug)) continue;
        const stats = ns.singularity.getAugmentationStats(aug);
        let type = getShortType(stats, args.mode);
        if (!type) continue;
        const price = ns.singularity.getAugmentationPrice(aug);
        const rep = ns.singularity.getAugmentationRepReq(aug);
        const prereqs = ns.singularity.getAugmentationPrereq(aug);
        const sources = augSources[aug] || [];
        let bestRep = 0, bestFaction = "";
        for (const fac of sources) {
            if ((joinedFactionReps[fac] || 0) > bestRep) {
                bestRep = joinedFactionReps[fac];
                bestFaction = fac;
            }
        }
        let repPercent = rep > 0 ? Math.min(100, (bestRep / rep) * 100) : 100;
        let status, statusRaw;
        if (repPercent === 100 && price <= money) {
            status = color.green + "NOW" + color.reset;
            statusRaw = "NOW";
        } else if (repPercent > 75) {
            status = color.yellow + "SOON" + color.reset;
            statusRaw = "SOON";
        } else {
            status = color.red + "FAR" + color.reset;
            statusRaw = "FAR";
        }
        // Build chain for display if needed
        const chain = prereqs.length ? buildChain(ns, prereqs, owned, augSources, joinedFactionReps, money) : [];
        augList.push({
            name: aug,
            price,
            rep,
            repPercent,
            bestFaction,
            prereqs,
            chain,
            type,
            statusRaw,
            status,
            sources
        });
    }

    // 2. Prioritize: NOWs at top, then SOON, then FAR, then price
    augList.sort((a, b) => {
        const order = { "NOW": 0, "SOON": 1, "FAR": 2 };
        const aOrd = order[a.statusRaw] ?? 3;
        const bOrd = order[b.statusRaw] ?? 3;
        if (aOrd !== bOrd) return aOrd - bOrd;
        if (a.price !== b.price) return a.price - b.price;
        return a.name.localeCompare(b.name);
    });

    // Remove NeuroFlux Governor from priority recommendations, show it last if available
    let nfgIdx = augList.findIndex(a => a.name === "NeuroFlux Governor");
    let neuroflux = null;
    if (nfgIdx !== -1) {
        neuroflux = augList[nfgIdx];
        augList.splice(nfgIdx, 1); // Remove from normal priority listing
    }

    // Show only top N
    augList = augList.slice(0, args.top);

    // 3. Table Output
    function pad(str, w, r=false) {
        str = String(str);
        let strRaw = str.replace(/\u001b\[[0-9;]*m/g, '');
        if (strRaw.length > w) return strRaw.slice(0, w-2) + "… ";
        let padding = " ".repeat(w - strRaw.length);
        return r ? padding + str : str + padding;
    }
    let out = [
        `${pad("#", 3)} ${pad("Name", nameW)} ${pad("Source", srcW)} ${pad("Price", priceW, true)} ${pad("Rep", repW, true)} ${pad("Status", stW)} ${pad("Type", whyW)}`,
        `${"-".repeat(3)} ${"-".repeat(nameW)} ${"-".repeat(srcW)} ${"-".repeat(priceW)} ${"-".repeat(repW)} ${"-".repeat(stW)} ${"-".repeat(whyW)}`
    ];
    let rank = 1;
    for (const a of augList) {
        let src = a.sources.length ? a.sources.join(", ") : "-";
        out.push(`${pad(rank,3)} ${pad(a.name, nameW)} ${pad(src, srcW)} ${pad(ns.nFormat(a.price, "$0.0a"), priceW, true)} ${pad(ns.nFormat(a.rep, "0.0a"), repW, true)} ${pad(a.status, stW)} ${pad(a.type, whyW)}`);
        // Indent and list any chain (with price/rep/status for each chain entry)
        if (a.chain && a.chain.length) {
            for (const link of a.chain) {
                out.push(`${pad("",3)} ${pad("↳ " + link.name, nameW)} ${pad(link.source, srcW)} ${pad(ns.nFormat(link.price, "$0.0a"), priceW, true)} ${pad(ns.nFormat(link.rep, "0.0a"), repW, true)} ${pad(link.status, stW)} ${pad(link.type, whyW)}`);
            }
        }
        rank++;
    }
    // Optionally show NeuroFlux as a “bonus” line if available
    if (neuroflux) {
        let src = neuroflux.sources.length ? neuroflux.sources.join(", ") : "-";
        out.push(`   ${pad(color.magenta + neuroflux.name + color.reset, nameW)} ${pad(src, srcW)} ${pad(ns.nFormat(neuroflux.price, "$0.0a"), priceW, true)} ${pad(ns.nFormat(neuroflux.rep, "0.0a"), repW, true)} ${pad(neuroflux.status, stW)} ${pad("all stats", whyW)}`);
    }
    out.push(""); // blank line

    ns.tprint("\n" + out.join("\n"));

    // 4. Plan Output (buffered, minimal color)
    let planLines = [];
    planLines.push("Plan:");
    const buyList = augList.filter(a => a.statusRaw === "NOW");
    if (buyList.length === 0 && neuroflux && neuroflux.statusRaw === "NOW") {
        planLines.push(color.cyan + "Buy NeuroFlux Governor if you want a tiny stat boost, but no major augs are available yet." + color.reset);
    } else if (buyList.length > 0) {
        planLines.push(color.green + "Buy the following NOW:" + color.reset);
        for (let i = 0; i < buyList.length; ++i) {
            planLines.push(color.green + `#${i+1} (${buyList[i].name}) from ${buyList[i].bestFaction}.` + color.reset);
            // Show chain as sub-list in plan, indented, normal color
            if (buyList[i].chain && buyList[i].chain.length) {
                for (const link of buyList[i].chain) {
                    planLines.push("   ↳ " + link.name + ` (${link.type}) [${link.statusRaw}]`);
                }
            }
        }
        if (neuroflux && neuroflux.statusRaw === "NOW") {
            planLines.push(color.magenta + "Optional: Buy NeuroFlux Governor for incremental all-stat boost." + color.reset);
        }
    }
    const next = augList.find(a => a.statusRaw === "SOON");
    if (next) planLines.push(color.yellow + `Then grind rep for #${augList.indexOf(next)+1} (${next.name}) at ${next.bestFaction}.` + color.reset);

    // FAR augs: Only color name and any stat (money/rep) that is actually missing
    for (const far of augList.filter(a => a.statusRaw === "FAR")) {
        let needMoney = Math.max(0, far.price - money);
        let needRep = Math.max(0, far.rep - (joinedFactionReps[far.bestFaction] || 0));
        let moneyText = needMoney > 0 ? color.red + ns.nFormat(needMoney, "$0.0a") + color.reset : ns.nFormat(needMoney, "$0.0a");
        let repText = needRep > 0 ? color.red + ns.nFormat(needRep, "0.0a") + color.reset : ns.nFormat(needRep, "0.0a");
        planLines.push(
            color.red + `#${augList.indexOf(far)+1} (${far.name})` + color.reset +
            ` at ${far.bestFaction}: Need ${moneyText}, ${repText} rep`
        );
    }

    ns.tprint(planLines.join("\n"));
}

// --------- Helper: summarize stat type ---------
function getShortType(stats, mode) {
    let key = Object.entries(stats)
        .filter(([k,v])=>v !== 1 && v !== 0)
        .map(([k,v])=>[k.toLowerCase(),v])
        .filter(([k,v])=>{
            if (mode==="hacking") return k.includes("hack");
            if (mode==="crime") return k.includes("crime");
            if (mode==="company") return k.includes("company");
            if (mode==="faction") return k.includes("faction");
            return true;
        })
        .sort((a,b)=>Math.abs(b[1]-1)-Math.abs(a[1]-1))[0];
    if (!key) return "";
    let [k,v] = key;
    if (k.includes("chance")) return "chance";
    if (k.includes("exp")) return "exp";
    if (k.includes("money")) return "money";
    if (k.includes("speed")) return "speed";
    if (k.includes("mult")) return "mult";
    return k.replace(/_/g," ").slice(0,whyW-2);
}

// --------- Helper: recursively build prereq chain ---------
function buildChain(ns, chain, owned, augSources, joinedFactionReps, money, depth=1) {
    let arr = [];
    for (const aug of chain) {
        if (owned.includes(aug)) continue; // skip already-owned prereqs
        let stats = ns.singularity.getAugmentationStats(aug);
        let price = ns.singularity.getAugmentationPrice(aug);
        let rep = ns.singularity.getAugmentationRepReq(aug);
        let prereqs = ns.singularity.getAugmentationPrereq(aug);
        let sources = augSources[aug] || [];
        let bestRep = 0, bestFaction = "";
        for (const fac of sources) {
            if ((joinedFactionReps[fac] || 0) > bestRep) {
                bestRep = joinedFactionReps[fac];
                bestFaction = fac;
            }
        }
        let repPercent = rep > 0 ? Math.min(100, (bestRep / rep) * 100) : 100;
        let status, statusRaw;
        if (repPercent === 100 && price <= money) {
            status = "NOW"; statusRaw = "NOW";
        } else if (repPercent > 75) {
            status = "SOON"; statusRaw = "SOON";
        } else {
            status = "FAR"; statusRaw = "FAR";
        }
        let type = getShortType(stats, "hacking");
        arr.push({
            name: aug,
            price,
            rep,
            status,
            statusRaw,
            source: sources.join(", "),
            type
        });
        // Recursively expand chain for this prereq, if needed
        if (prereqs.length) {
            arr = arr.concat(buildChain(ns, prereqs, owned, augSources, joinedFactionReps, money, depth+1));
        }
    }
    return arr;
}
