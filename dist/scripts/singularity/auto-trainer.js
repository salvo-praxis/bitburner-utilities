/** @param {NS} ns **/
export async function main(ns) {
    const usage = `
Usage: run auto-trainer.js [--all N] [--strength N] [--defense N] [--dexterity N] [--agility N] [--charisma N] [--help]

- Trains your stats to the specified target value(s) using Singularity (SF4).
- Will only issue training command ONCE per stat (minimizing window popups).

Examples:
  run auto-trainer.js --all 100
  run auto-trainer.js --strength 110 --defense 105 --dexterity 107 --agility 109 --charisma 115
  run auto-trainer.js --help
    `.trim();
    const gymCity = "Sector-12";
    const gymName = "Powerhouse Gym";
    const uniName = "Rothman University";
    const args = ns.flags([
        ["all", 0], ["strength", 0], ["defense", 0], ["dexterity", 0], ["agility", 0], ["charisma", 0], ["help", false]
    ]);
    if (args.help || (args._.length === 0 && !Object.values(args).some(v => v > 0))) {
        ns.tprint(usage);
        return;
    }
    // API compatibility check
    const gymWorkout = ns.gymWorkout ? ns.gymWorkout : (ns.singularity?.gymWorkout ?? null);
    const universityCourse = ns.universityCourse ? ns.universityCourse : (ns.singularity?.universityCourse ?? null);
    const travelToCity = ns.travelToCity ? ns.travelToCity : (ns.singularity?.travelToCity ?? null);
    const stopAction = ns.stopAction ? ns.stopAction : (ns.singularity?.stopAction ?? null);
    if (!gymWorkout || !universityCourse || !travelToCity || !stopAction) {
        ns.tprint("ERROR: Singularity API missing! Are you sure you have SF4 unlocked?");
        return;
    }
    // Build targets object
    let targets = {};
    if (args.all > 0)
        ["strength", "defense", "dexterity", "agility", "charisma"].forEach(stat => targets[stat] = args.all);
    for (const stat of ["strength", "defense", "dexterity", "agility", "charisma"]) {
        if (args[stat] > 0)
            targets[stat] = args[stat];
    }
    const orderedStats = ["strength", "defense", "dexterity", "agility", "charisma"].filter(s => targets[s] > 0);
    ns.tprint("Auto-training the following stats:");
    for (const stat of orderedStats) {
        ns.tprint(` - ${stat.padEnd(9)} to ${targets[stat]}`);
    }
    // Move to city if needed
    if (ns.getPlayer().city !== gymCity) {
        travelToCity(gymCity);
        await ns.sleep(2000);
    }
    // Only issue train command once per stat
    for (const stat of orderedStats) {
        let label = stat[0].toUpperCase() + stat.slice(1);
        let action = (stat === "charisma") ? () => universityCourse(uniName, "Leadership") : () => gymWorkout(gymName, label);
        let value = ns.getPlayer().skills[stat];
        let target = targets[stat];
        ns.tprint(`\n[${label}] Training from ${value} to ${target}...`);
        // Start the work/training action ONCE for this stat
        action();
        let last = -1;
        while (value < target) {
            await ns.sleep(8000); // Check progress every 8 seconds
            value = ns.getPlayer().skills[stat];
            let percent = Math.min(100, ((value / target) * 100)).toFixed(1);
            if (value !== last) {
                ns.tprint(`[${label}] ${value} / ${target} (${percent}%)`);
                last = value;
            }
        }
        stopAction();
        ns.tprint(`[${label}] Reached target: ${target}!`);
    }
    ns.tprint("\nAll target stats reached! 🎉");
}
