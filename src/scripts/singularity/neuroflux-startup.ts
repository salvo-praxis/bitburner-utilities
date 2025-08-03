/**
 * neuroflux-startup.ts
 * Automated INT XP & NeuroFlux Governor farmer for startup.ts workflows.
 * Now PRAAXIS_ALPHA compliant with explicit --delay and update/removal in /data/startup.txt.
 * v1.5.0 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage:
 *   run scripts/singularity/neuroflux-startup.ts --setup --min=3 --delay=4000
 *   run scripts/singularity/neuroflux-startup.ts --update --min=5 --delay=8000
 *   run scripts/singularity/neuroflux-startup.ts --remove
 *   run scripts/singularity/neuroflux-startup.ts --suggest
 *   run scripts/singularity/neuroflux-startup.ts --help
 *
 * Flags:
 *   --setup        Add or update this script in /data/startup.txt with provided flags (--delay, --min, etc.)
 *   --update       Update existing line(s) in /data/startup.txt (by basename) with provided flags
 *   --remove       Remove this script from /data/startup.txt and cycles config
 *   --min=N        Minimum NFGs per reset (default: 1)
 *   --max-cycles=N Maximum cycles before removing self (default: unlimited)
 *   --delay=ms     Explicit delay between boot script launches (default: 4000)
 *   --suggest      Output XP/hr and cost table (sample mode)
 *   --help         Show help
 */

const STARTUP_LIST = "/data/startup.txt";
const SCRIPT_PATH = "scripts/singularity/neuroflux-startup.ts";
const CONFIG_FILE = "/data/nfg-cycles.txt";
const DEFAULT_DELAY = 4000;

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        ["setup", false],
        ["remove", false],
        ["update", false],
        ["min", 1],
        ["max-cycles", 0],
        ["delay", DEFAULT_DELAY],
        ["suggest", false],
        ["help", false],
    ]);
    const c = {
        reset: "\u001b[0m",
        bold: "\u001b[1m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        cyan: "\u001b[36m",
        red: "\u001b[31m",
        magenta: "\u001b[35m",
        white: "\u001b[37m"
    };

    // === HELP ===
    if (args.help) {
        ns.tprint(
            `\n${c.bold + c.green}neuroflux-startup.js${c.reset} ${c.white}|${c.reset} ${c.cyan}INT XP + NFG Automated Startup${c.reset}\n\n`
            + `${c.cyan}--setup${c.reset}        ${c.yellow}Add/update this script in /data/startup.txt (boot auto-loop)${c.reset}\n`
            + `${c.cyan}--update${c.reset}       ${c.yellow}Update flags (delay, min, etc.) for all entries of this script${c.reset}\n`
            + `${c.cyan}--remove${c.reset}       ${c.yellow}Remove this script from /data/startup.txt${c.reset}\n`
            + `${c.cyan}--min=N${c.reset}        ${c.yellow}Require at least N NFGs per reset (default: 1)${c.reset}\n`
            + `${c.cyan}--max-cycles=N${c.reset} ${c.yellow}Limit to N cycles before self-removal${c.reset}\n`
            + `${c.cyan}--delay=ms${c.reset}     ${c.yellow}Delay before next boot script launches (ms)${c.reset}\n`
            + `${c.cyan}--suggest${c.reset}      ${c.yellow}Sample XP/hr table${c.reset}\n`
            + `${c.cyan}--help${c.reset}         ${c.yellow}Show this help screen${c.reset}\n\n`
            + `${c.cyan}Usage:${c.reset} run scripts/singularity/neuroflux-startup.js --setup --min=4 --delay=4000\n`
            + `${c.white}PRAAXIS_ALPHA startup.txt ready!${c.reset}\n`
        );
        return;
    }

    // === SUGGEST TABLE ===
    if (args.suggest) {
        await suggestTable(ns, c);
        return;
    }

    // === SETUP MODE: Add or update this script in /data/startup.txt ===
    if (args.setup) {
        const paramList = [
            `--min=${args.min}`,
            args["max-cycles"] > 0 ? `--max-cycles=${args["max-cycles"]}` : null,
            `--delay=${args.delay}`
        ].filter(Boolean);
        await addOrUpdateStartup(ns, SCRIPT_PATH, paramList, c);
        ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Registered/updated in /data/startup.txt with: ${paramList.join(" ")}`);
        // Init/clear cycles config
        if (ns.fileExists(CONFIG_FILE, "home")) ns.rm(CONFIG_FILE, "home");
        if (args["max-cycles"] > 0) {
            await ns.write(CONFIG_FILE, args["max-cycles"].toString(), "w");
        }
        return;
    }

    // === UPDATE MODE: Update flags for existing line(s) in /data/startup.txt ===
    if (args.update) {
        const paramList = [
            `--min=${args.min}`,
            args["max-cycles"] > 0 ? `--max-cycles=${args["max-cycles"]}` : null,
            args["delay"] !== undefined ? `--delay=${args.delay}` : null
        ].filter(Boolean);
        await updateStartupEntry(ns, SCRIPT_PATH, paramList, c);
        ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Updated /data/startup.txt entry for this script.`);
        return;
    }

    // === REMOVE MODE: Remove this script from /data/startup.txt ===
    if (args.remove) {
        await removeStartupEntry(ns, SCRIPT_PATH, c);
        if (ns.fileExists(CONFIG_FILE, "home")) ns.rm(CONFIG_FILE, "home");
        ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Removed from /data/startup.txt and deleted cycles config.`);
        return;
    }

    // === CYCLE LOGIC ===
    // Core: Automates NFG buy + INT XP loop, self-removes after cycles
    let maxCycles = Infinity, cyclesLeft = Infinity;
    if (ns.fileExists(CONFIG_FILE, "home")) {
        try {
            cyclesLeft = parseInt(ns.read(CONFIG_FILE).trim()) || 1;
        } catch {
            cyclesLeft = 1;
        }
        maxCycles = cyclesLeft;
    }
    if (cyclesLeft <= 0) {
        ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Cycles complete. Removing from startup.txt.`);
        await removeStartupEntry(ns, SCRIPT_PATH, c);
        if (ns.fileExists(CONFIG_FILE, "home")) ns.rm(CONFIG_FILE, "home");
        return;
    }

    // Main INT/NFG farming loop
    const NFG = "NeuroFlux Governor";
    let minNFG = Math.max(1, parseInt(args["min"]) || 1);
    let cycles = 0;
    while (cycles < maxCycles && cyclesLeft > 0) {
        cycles++;
        ns.singularity.stopAction();
        let maxJoinAttempts = 10;
        while (!ns.getPlayer().factions.includes("Sector-12") && maxJoinAttempts-- > 0) {
            const invites = ns.singularity.checkFactionInvitations();
            if (invites.includes("Sector-12")) {
                let joined = ns.singularity.joinFaction("Sector-12");
                if (joined) {
                    ns.tprint(`${c.cyan}[neuroflux-startup.js]${c.reset} Joined Sector-12.`);
                } else {
                    ns.tprint(`${c.yellow}[neuroflux-startup.js]${c.reset} Join failed, retrying...`);
                }
            } else {
                ns.tprint(`${c.yellow}[neuroflux-startup.js]${c.reset} No Sector-12 invite detected (waiting)...`);
            }
            await ns.sleep(1000);
        }
        if (!ns.getPlayer().factions.includes("Sector-12")) {
            ns.tprint(`${c.red}[neuroflux-startup.js]${c.reset} ERROR: Could not join Sector-12 after multiple attempts.`);
            return;
        }

        let nfgToBuy = minNFG;
        let bought = 0;
        while (true) {
            let purchases = nfgBuySome(ns, c, nfgToBuy - bought);
            bought += purchases;
            if (bought >= minNFG) break;

            let neededMoney = ns.singularity.getAugmentationPrice(NFG) * Math.pow(1.14, nfgOwned(ns) + bought);
            let neededRep = ns.singularity.getAugmentationRepReq(NFG) * Math.pow(1.14, nfgOwned(ns) + bought);
            let s12rep = ns.singularity.getFactionRep("Sector-12");

            if (s12rep < neededRep) {
                ns.tprint(`${c.cyan}[neuroflux-startup.js]${c.reset} Grinding Sector-12 rep for NFG #${bought + 1}...`);
                let working = ns.singularity.workForFaction("Sector-12", "Hacking Contracts", false);
                if (!working) ns.singularity.workForFaction("Sector-12", "Security Work", false);
                while (ns.singularity.getFactionRep("Sector-12") < neededRep) {
                    await ns.sleep(5000);
                }
                ns.singularity.stopAction();
            }
            if (ns.getPlayer().money < neededMoney) {
                ns.tprint(`${c.cyan}[neuroflux-startup.js]${c.reset} Waiting for enough money (${ns.formatNumber(neededMoney)}) for NFG #${bought + 1}...`);
                while (ns.getPlayer().money < neededMoney) {
                    await ns.sleep(5000);
                }
            }
        }
        // After buying minNFG, buy any extras possible before reset
        let extras = nfgBuyAll(ns, c);
        ns.tprint(`${c.cyan}[neuroflux-startup.js]${c.reset} Bought ${bought + extras} NFG(s) this cycle.`);
        ns.tprint(`${c.yellow}[neuroflux-startup.js]${c.reset} Installing augmentations (hard reset) for next cycle...`);
        // Handle cycles config
        if (ns.fileExists(CONFIG_FILE, "home")) {
            cyclesLeft = parseInt(ns.read(CONFIG_FILE).trim()) || 1;
            cyclesLeft--;
            await ns.write(CONFIG_FILE, cyclesLeft.toString(), "w");
            ns.tprint(`${c.cyan}[neuroflux-startup.js]${c.reset} Cycles left after this install: ${cyclesLeft}`);
        }
        await ns.sleep(3000);
        ns.singularity.installAugmentations("startup.ts");
        // Script will terminate/reset here
    }
    // Clean up after last cycle
    if (ns.fileExists(CONFIG_FILE, "home")) ns.rm(CONFIG_FILE, "home");
    await removeStartupEntry(ns, SCRIPT_PATH, c);
    ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Finished ${cycles} cycles! Exiting.`);
}

// --- Helpers ---

function nfgOwned(ns) {
    return ns.singularity.getOwnedAugmentations(true).filter(a => a === "NeuroFlux Governor").length;
}
function nfgBuyAll(ns, c) {
    const NFG = "NeuroFlux Governor";
    let player = ns.getPlayer();
    const factions = player.factions.filter(f => ns.singularity.getAugmentationsFromFaction(f).includes(NFG));
    let n = nfgOwned(ns);
    let purchases = 0;
    while (true) {
        let bought = false;
        for (let f of factions) {
            let price = ns.singularity.getAugmentationPrice(NFG) * Math.pow(1.14, n);
            let rep = ns.singularity.getAugmentationRepReq(NFG) * Math.pow(1.14, n);
            let factionRep = ns.singularity.getFactionRep(f);
            if (ns.getPlayer().money >= price && factionRep >= rep) {
                let ok = ns.singularity.purchaseAugmentation(f, NFG);
                if (ok) {
                    n++;
                    purchases++;
                    ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Purchased NFG #${n} from ${f} (Cost: ${ns.formatNumber(price)}, Rep: ${ns.formatNumber(rep)})`);
                    bought = true;
                }
            }
        }
        if (!bought) break;
    }
    return purchases;
}
function nfgBuySome(ns, c, count) {
    if (count <= 0) return 0;
    const NFG = "NeuroFlux Governor";
    let player = ns.getPlayer();
    const factions = player.factions.filter(f => ns.singularity.getAugmentationsFromFaction(f).includes(NFG));
    let n = nfgOwned(ns);
    let purchases = 0;
    while (purchases < count) {
        let bought = false;
        for (let f of factions) {
            let price = ns.singularity.getAugmentationPrice(NFG) * Math.pow(1.14, n);
            let rep = ns.singularity.getAugmentationRepReq(NFG) * Math.pow(1.14, n);
            let factionRep = ns.singularity.getFactionRep(f);
            if (ns.getPlayer().money >= price && factionRep >= rep) {
                let ok = ns.singularity.purchaseAugmentation(f, NFG);
                if (ok) {
                    n++;
                    purchases++;
                    ns.tprint(`${c.green}[neuroflux-startup.js]${c.reset} Purchased NFG #${n} from ${f} (Cost: ${ns.formatNumber(price)}, Rep: ${ns.formatNumber(rep)})`);
                    bought = true;
                }
            }
        }
        if (!bought) break;
    }
    return purchases;
}
async function addOrUpdateStartup(ns, script, params, c) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    const base = basename(script);
    list = list.filter(line => basename(line.split(/\s+/)[0]) !== base);
    list.unshift([script, ...params].join(" "));
    await ns.write(STARTUP_LIST, list.filter(x => x.length).join('\n') + '\n', "w");
}
async function updateStartupEntry(ns, targetScript, params, c) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    const base = basename(targetScript);
    let updated = false;
    for (let i = 0; i < list.length; ++i) {
        let tokens = list[i].split(/\s+/);
        let script = tokens[0];
        if (basename(script) === base) {
            for (const param of params) {
                let [flag, value] = param.split("=");
                if (!flag.startsWith("--")) continue;
                let idx = tokens.findIndex(x => x.startsWith(flag + "="));
                if (idx !== -1) tokens[idx] = param;
                else tokens.push(param);
            }
            list[i] = tokens.join(" ");
            updated = true;
        }
    }
    if (updated) {
        await ns.write(STARTUP_LIST, list.filter(x => x.length).join('\n') + '\n', "w");
    }
}
async function removeStartupEntry(ns, targetScript, c) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    const base = basename(targetScript);
    list = list.filter(line => basename(line.split(/\s+/)[0]) !== base);
    await ns.write(STARTUP_LIST, list.filter(x => x.length).join('\n') + '\n', "w");
}
function basename(path) {
    return path.split("/").pop();
}

// --- SUGGEST TABLE (unchanged from prior versions) ---
async function suggestTable(ns, c) {
    const NFG = "NeuroFlux Governor";
    ns.tprint(`\n${c.cyan}[neuroflux-startup.js]${c.reset} Sampling money/sec and rep/sec for 30 seconds...`);
    let initialMoney = ns.getPlayer().money;
    let initialRep = ns.singularity.getFactionRep("Sector-12");
    await ns.sleep(30000);
    let moneyGain = ns.getPlayer().money - initialMoney;
    let repGain = ns.singularity.getFactionRep("Sector-12") - initialRep;
    let moneyPerSec = Math.max(0, moneyGain / 30);
    let repPerSec = Math.max(0, repGain / 30);
    if (repPerSec < 1) repPerSec = 250; // fallback

    const cols = [
        { name: "Min NFGs/Reset", width: 16 },
        { name: "Est. $ Needed", width: 16 },
        { name: "Est. Rep Needed", width: 18 },
        { name: "Est. Time (s)", width: 14 },
        { name: "Est. XP/Reset", width: 14 },
        { name: "Est. XP/hr", width: 12 }
    ];
    const pad = (str, len) => (str + " ".repeat(len)).slice(0, len);

    const tableWidth = cols.reduce((a, b) => a + b.width, 0) + (cols.length - 1);
    const title = " NeuroFlux XP/Reset Efficiency Table (Sampled: 30s) ";
    const padLen = Math.max(0, Math.floor((tableWidth - title.length) / 2));
    const titleLine = " ".repeat(padLen) + title + " ".repeat(tableWidth - title.length - padLen);

    let buffer = "\n\n";
    buffer += c.red + "╔" + "═".repeat(tableWidth) + "╗" + c.reset + "\n";
    buffer += c.red + "║" + c.white + titleLine + c.red + "║" + c.reset + "\n";
    buffer += c.red + "╠" + cols.map(col => "═".repeat(col.width)).join("╦") + "╣" + c.reset + "\n";
    buffer += c.red + "║" + cols.map(col => c.cyan + pad(col.name, col.width) + c.red).join("║") + "║" + c.reset + "\n";
    buffer += c.red + "╠" + cols.map(col => "═".repeat(col.width)).join("╬") + "╣" + c.reset + "\n";
    for (let min = 1; min <= 10; min++) {
        let money = 0, rep = 0, xp = 0;
        for (let i = 0; i < min; i++) {
            money += ns.singularity.getAugmentationPrice(NFG) * Math.pow(1.14, i);
            rep += ns.singularity.getAugmentationRepReq(NFG) * Math.pow(1.14, i);
            xp += Math.pow(i + 1, 0.9) * 1000;
        }
        let tMoney = moneyPerSec > 0 ? money / moneyPerSec : 0;
        let tRep = repPerSec > 0 ? rep / repPerSec : 0;
        let tSec = Math.max(tMoney, tRep);
        let xphr = xp / (tSec > 0 ? tSec : 1) * 3600;

        buffer += c.red + "║" +
            c.white + pad(min, cols[0].width) + c.red + "║" +
            c.white + pad(ns.formatNumber(money), cols[1].width) + c.red + "║" +
            c.white + pad(ns.formatNumber(rep), cols[2].width) + c.red + "║" +
            c.white + pad(Math.ceil(tSec), cols[3].width) + c.red + "║" +
            c.white + pad(Math.ceil(xp), cols[4].width) + c.red + "║" +
            c.white + pad(Math.ceil(xphr), cols[5].width) + c.red + "║" +
            c.reset + "\n";
    }
    buffer += c.red + "╚";
    for (let i = 0; i < cols.length; i++) {
        buffer += "═".repeat(cols[i].width);
        buffer += (i < cols.length - 1) ? "╩" : "╝";
    }
    buffer += c.reset + "\n";
    ns.tprint(buffer);
}
