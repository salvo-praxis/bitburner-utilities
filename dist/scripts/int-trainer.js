/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        ["help", false],
        ["mode", ""], // programs | university | config | reset
        ["max-ram", 0], // only for programs
        ["cycle-time", 0], // only for university; time per course in seconds; 0 = indefinite
    ]);
    if (args.help || !args.mode)
        return showHelp(ns);
    switch (args.mode) {
        case "programs":
            await trainPrograms(ns, args["max-ram"]);
            break;
        case "university":
            await trainUniversity(ns, args["cycle-time"]);
            break;
        case "config":
            await writeConfig(ns);
            break;
        case "reset":
            await resetConfig(ns);
            break;
        default:
            ns.tprint(`\u001b[31mERROR\u001b[0m: Unknown mode '${args.mode}'.`);
            showHelp(ns);
    }
}
function showHelp(ns) {
    let helpText = "";
    helpText += "int-trainer.js — Intelligence XP farming (note: manual actions required for true Int XP; automation farms skills only)\n";
    helpText += "Usage: run scripts/singularity/int-trainer.js --mode=<mode> [flags]\n";
    helpText += "Modes:\n";
    helpText += "  programs    Launch dummy scripts to consume RAM (customizable limit)\n";
    helpText += "  university  Start/cycle through configured university courses\n";
    helpText += "  config      Measure rates and write optimized /data/courses.json\n";
    helpText += "  reset      Clear /data/courses.json (fallback to measurement defaults)\n";
    helpText += "Flags:\n";
    helpText += "  --max-ram      [programs] Max total RAM (GB) to dedicate (0 = unlimited)\n";
    helpText += "  --cycle-time  [university] Seconds per course; 0 = indefinite on first (default: 0)\n";
    helpText += "Examples:\n";
    helpText += "  run scripts/singularity/int-trainer.js --mode=programs --max-ram=8\n";
    helpText += "  run scripts/singularity/int-trainer.js --mode=university --cycle-time=600\n";
    helpText += "  run scripts/singularity/int-trainer.js --mode=config\n";
    helpText += "  run scripts/singularity/int-trainer.js --mode=reset\n";
    ns.tprint(helpText);
}
/** MODE: programs */
async function trainPrograms(ns, maxRamGB) {
    const workerPath = "/tmp/int-trainer-worker.js";
    const workerSrc = `// DUMMY WORKER FOR RESOURCE CONSUMPTION\nwhile(true) {};\n`;
    await ns.write(workerPath, workerSrc, "w");
    const hosts = ["home", ...ns.getPurchasedServers()].filter(h => ns.hasRootAccess(h));
    const ramPerThread = ns.getScriptRam(workerPath, "home");
    const capRam = maxRamGB > 0 ? maxRamGB : Infinity;
    let usedRam = 0;
    for (const host of hosts) {
        const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (freeRam < ramPerThread)
            continue;
        const maxThreadsByFree = Math.floor(freeRam / ramPerThread);
        const maxThreadsByCap = Math.floor((capRam - usedRam) / ramPerThread);
        const threads = Math.min(maxThreadsByFree, maxThreadsByCap);
        if (threads > 0) {
            ns.exec(workerPath, host, threads);
            usedRam += threads * ramPerThread;
        }
        if (usedRam >= capRam)
            break;
    }
    if (usedRam === 0) {
        ns.tprint(`\u001b[33m[programs] No free RAM available for workers\u001b[0m`);
    }
    else {
        ns.tprint(`\u001b[32m[programs] Launched workers using ~${usedRam.toFixed(2)} GB\u001b[0m`);
    }
}
/** MODE: university */
async function trainUniversity(ns, cycleTime) {
    if (!ns.singularity?.universityCourse) {
        ns.tprint(`\u001b[31mERROR\u001b[0m: Singularity API required for university mode.`);
        return;
    }
    const configPath = "/data/courses.json";
    let courses;
    try {
        const raw = ns.read(configPath);
        courses = JSON.parse(raw);
        if (!Array.isArray(courses) || courses.length === 0)
            throw new Error("Invalid config");
    }
    catch {
        ns.tprint(`\u001b[33m[university] No valid config found; run config mode first\u001b[0m`);
        return;
    }
    ns.tprint(`\u001b[36m[university] Starting training loop with ${courses.length} courses (cycle time: ${cycleTime}s)\u001b[0m`);
    while (true) {
        for (const c of courses) {
            if (ns.getPlayer().city !== c.city) {
                await ns.singularity.travelToCity(c.city);
            }
            ns.singularity.universityCourse(c.university, c.name);
            ns.tprint(`\u001b[33m[university] Started ${c.name} at ${c.university} (${c.city})\u001b[0m`);
            if (cycleTime <= 0) {
                // Indefinite run; periodic status (these are real-time, so no buffering)
                while (true) {
                    await ns.sleep(60000);
                    ns.tprint(`\u001b[36m[university] Still running ${c.name} at ${c.city}\u001b[0m`);
                }
            }
            else {
                await ns.sleep(cycleTime * 1000);
            }
        }
    }
}
/** MODE: config */
async function writeConfig(ns) {
    if (!ns.singularity?.universityCourse) {
        ns.tprint(`\u001b[31mERROR\u001b[0m: Singularity API required for config mode.`);
        return;
    }
    const configPath = "/data/courses.json";
    const universityData = [
        { city: "Sector-12", university: "Rothman University" },
        { city: "Aevum", university: "Summit University" },
        { city: "Volhaven", university: "ZB Institute of Technology" },
    ];
    const courseData = [
        { name: "Study Computer Science", skill: "hacking" },
        { name: "Data Structures", skill: "hacking" },
        { name: "Networks", skill: "hacking" },
        { name: "Algorithms", skill: "hacking" },
        { name: "Management", skill: "charisma" },
        { name: "Leadership", skill: "charisma" },
    ];
    const rates = [];
    const currentCity = ns.getPlayer().city;
    ns.singularity.stopAction();
    for (const u of universityData) {
        if (ns.getPlayer().city !== u.city) {
            await ns.singularity.travelToCity(u.city);
        }
        for (const s of courseData) {
            const playerBefore = ns.getPlayer();
            const beforeExp = playerBefore.exp[s.skill];
            ns.singularity.universityCourse(u.university, s.name);
            await ns.sleep(10000); // 10s sample for better accuracy
            const playerAfter = ns.getPlayer();
            const afterExp = playerAfter.exp[s.skill];
            ns.singularity.stopAction();
            const rate = (afterExp - beforeExp) / 10;
            rates.push({ city: u.city, university: u.university, name: s.name, rate });
        }
    }
    // Restore original city
    if (ns.getPlayer().city !== currentCity) {
        await ns.singularity.travelToCity(currentCity);
    }
    // Select top 4 by rate, then sort by city to group and minimize switches
    rates.sort((a, b) => b.rate - a.rate);
    let top = rates.slice(0, 4);
    top.sort((a, b) => a.city.localeCompare(b.city) || b.rate - a.rate);
    await ns.write(configPath, JSON.stringify(top, null, 2), "w");
    ns.tprint(`\u001b[32m[config] Wrote ${top.length} optimized courses to ${configPath} (top rates: ${top.map(c => c.rate.toFixed(2)).join(', ')} exp/s)\u001b[0m`);
}
/** MODE: reset */
async function resetConfig(ns) {
    const configPath = "/data/courses.json";
    await ns.write(configPath, "", "w");
    ns.tprint(`\u001b[33m[reset] Cleared ${configPath}; university mode will require re-config\u001b[0m`);
}
