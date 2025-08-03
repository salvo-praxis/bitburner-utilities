/** @param {NS} ns */
export async function main(ns) {
    const flags = ns.flags([
        ["mode", ""], // Required mode flag
        ["faction", ""], // Optional faction for rep/enemies modes
    ]);
    const mode = flags.mode;
    const faction = flags.faction;

    // Help mode
    if (mode === "help") {
        ns.tprint("=== Singularity API Script Help ===");
        ns.tprint("Purpose: Manage faction and augmentation tasks using Singularity API.");
        ns.tprint("Usage: run singularity.js --mode <mode> [--faction <faction>]");
        ns.tprint("Requires: Singularity API (Source-File 4 or 128GB home RAM).");
        ns.tprint("\nAvailable Modes:");
        ns.tprint("- invites: List pending faction invitations.");
        ns.tprint("  Example: run singularity.js --mode invites");
        ns.tprint("- augs: List unowned augmentations from joined factions.");
        ns.tprint("  Example: run singularity.js --mode augs");
        ns.tprint("- enemies: List enemies of a specified faction.");
        ns.tprint("  Example: run singularity.js --mode enemies --faction The Syndicate");
        ns.tprint("- rep: Grind reputation for a specified faction via contracts or donations.");
        ns.tprint("  Example: run singularity.js --mode rep --faction BitRunners");
        ns.tprint("- gym: Train combat stats to 300+ at Powerhouse Gym.");
        ns.tprint("  Example: run singularity.js --mode gym");
        ns.tprint("- karma: Commit crimes to lower karma to -90.");
        ns.tprint("  Example: run singularity.js --mode karma");
        ns.tprint("- help: Show this help message.");
        ns.tprint("  Example: run singularity.js --mode help");
        ns.tprint("\nNotes:");
        ns.tprint("- Use --faction for modes requiring a faction (enemies, rep).");
        ns.tprint("- Script stops when goals are met (e.g., karma <= -90).");
        ns.tprint("- Run alongside stock trading scripts for funds.");
        return;
    }

    // Validate mode
    if (!mode) {
        ns.tprint("ERROR: Specify --mode (invites, augs, enemies, rep, gym, karma, help)");
        return;
    }

    // Check Singularity API availability
    const hasSingularity = ns.singularity.getOwnedSourceFiles().some(sf => sf.n === 4) || ns.getServerMaxRam("home") >= 128;
    if (!hasSingularity) {
        ns.tprint("ERROR: Singularity API unavailable. Need Source-File 4 or 128GB home RAM.");
        return;
    }

    switch (mode) {
        case "invites":
            const invites = ns.singularity.getFactionInvitations();
            if (invites.length === 0) {
                ns.tprint("No pending faction invitations.");
            } else {
                ns.tprint(`Pending invitations: ${invites.join(", ")}`);
                invites.forEach(f => {
                    ns.tprint(`- ${f}: Requirements met, join via faction menu.`);
                });
            }
            break;

        case "augs":
            const ownedAugs = ns.singularity.getOwnedAugmentations(true);
            const joinedFactions = ns.getPlayer().factions;
            let unownedAugs = [];
            for (const f of joinedFactions) {
                const augs = ns.singularity.getAugmentationsFromFaction(f);
                const unowned = augs.filter(aug => !ownedAugs.includes(aug));
                if (unowned.length > 0) {
                    unownedAugs.push(`Faction ${f}: ${unowned.join(", ")}`);
                }
            }
            if (unownedAugs.length === 0) {
                ns.tprint("No unowned augmentations from joined factions.");
            } else {
                ns.tprint("Unowned augmentations:");
                unownedAugs.forEach(line => ns.tprint(`- ${line}`));
            }
            break;

        case "enemies":
            if (!faction) {
                ns.tprint("ERROR: Specify --faction for enemies mode.");
                return;
            }
            const enemies = ns.singularity.getFactionEnemies(faction);
            if (enemies.length === 0) {
                ns.tprint(`${faction} has no enemies.`);
            } else {
                ns.tprint(`${faction} enemies: ${enemies.join(", ")}`);
            }
            break;

        case "rep":
            if (!faction) {
                ns.tprint("ERROR: Specify --faction for rep mode.");
                return;
            }
            if (!ns.getPlayer().factions.includes(faction)) {
                ns.tprint(`ERROR: Not a member of ${faction}.`);
                return;
            }
            ns.tprint(`Grinding rep for ${faction}...`);
            while (true) {
                if (ns.singularity.workForFaction(faction, "hacking", false)) {
                    await ns.sleep(60000);
                } else if (ns.getPlayer().money > 1e9) {
                    ns.singularity.donateToFaction(faction, 1e9);
                    ns.tprint(`Donated $1B to ${faction}.`);
                } else {
                    ns.tprint(`No contracts or funds to donate for ${faction}.`);
                    break;
                }
                const rep = ns.singularity.getFactionRep(faction);
                ns.tprint(`${faction} rep: ${rep.toFixed(2)}`);
                await ns.sleep(1000);
            }
            break;

        case "gym":
            ns.tprint("Training combat stats at Powerhouse Gym...");
            ns.singularity.travelToCity("Sector-12");
            ns.singularity.gymWorkout("Powerhouse Gym", "strength", false);
            while (true) {
                const stats = ns.getPlayer();
                ns.tprint(`Str: ${stats.strength.toFixed(0)}, Def: ${stats.defense.toFixed(0)}, Dex: ${stats.dexterity.toFixed(0)}, Agi: ${stats.agility.toFixed(0)}`);
                await ns.sleep(60000);
                if (stats.strength >= 300 && stats.defense >= 300 && stats.dexterity >= 300 && stats.agility >= 300) {
                    ns.tprint("Combat stats >= 300, stopping gym training.");
                    ns.singularity.stopAction();
                    break;
                }
            }
            break;

        case "karma":
            ns.tprint("Committing crimes to lower karma...");
            while (true) {
                ns.singularity.commitCrime("mug", false);
                await ns.sleep(60000);
                const karma = ns.getPlayer().karma;
                ns.tprint(`Karma: ${karma.toFixed(2)}`);
                if (karma <= -90) {
                    ns.tprint("Karma <= -90, stopping crimes.");
                    ns.singularity.stopAction();
                    break;
                }
            }
            break;

        default:
            ns.tprint(`ERROR: Invalid mode. Use: invites, augs, enemies, rep, gym, karma, help`);
            break;
    }
}