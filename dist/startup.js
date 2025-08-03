/**
 * startup.js (BIOS Boot Sequence)
 * PRAAXIS_ALPHA vanilla Bitburner startup orchestrator. Launches all scripts in /data/startup.txt with per-script delays and dynamic updates.
 * BIOS-style output, quiet/silent flags, dynamic delay and update support, ultra-minimal RAM, no SF dependencies.
 * v2.0.0 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage:
 *   run startup.js                     # Launch all scripts in /data/startup.txt (per-line delays)
 *   run startup.js --add foo.js ...    # Add script line to startup.txt (with optional --delay, flags)
 *   run startup.js --update bar.js ... # Update params/flags for all lines matching bar.js (by basename)
 *   run startup.js --remove baz.js     # Remove all lines matching baz.js (by basename or index)
 *   run startup.js --force bar.js ...  # Immediately run script(s) matching bar.js (now, not boot order)
 *   run startup.js --help              # Show full help/flag summary
 *
 * Startup.txt line format:
 *   /path/to/script.js --delay=5000 --mode foo [other flags] [--force]
 *
 * Flags:
 *   --quiet      : Suppress update/notices during boot.
 *   --silent     : Suppress all except errors/fatal during boot.
 *   --add        : Add a new entry. Params after script name.
 *   --update     : Update existing entry by basename (or index if integer).
 *   --remove     : Remove entry by basename (or index).
 *   --force      : Immediately run script(s) by basename, now, skipping all delays.
 *   --help       : Show usage table.
 *
 * PRAAXIS_ALPHA: All output, formatting, and error handling per project standards.
 */
const STARTUP_LIST = "/data/startup.txt";
const DEFAULT_DELAY = 4000; // ms
/** @param {NS} ns **/
export async function main(ns) {
    // --- COLOR PALETTE ---
    const c = {
        reset: "\u001b[0m",
        white: "\u001b[37m",
        red: "\u001b[31m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        cyan: "\u001b[36m",
        magenta: "\u001b[35m",
        bold: "\u001b[1m",
        gray: "\u001b[90m"
    };
    // --- ARGUMENT PARSING ---
    const args = ns.flags([
        ["add", false],
        ["update", false],
        ["remove", false],
        ["force", false],
        ["quiet", false],
        ["silent", false],
        ["help", false],
    ]);
    // --- HELP OUTPUT ---
    if (args.help) {
        ns.tprint("\n" + c.bold + c.green + "startup.js" + c.reset + " " + c.white + "| BIOS-style Bootup Orchestrator\n" + c.reset);
        ns.tprint(c.cyan + "Launch, add, update, remove, or force scripts from /data/startup.txt, per PRAAXIS_ALPHA standards." + c.reset);
        printHelpTable(ns, c);
        return;
    }
    // --- FORCE MODE (manual override, run now, skip boot order/delay) ---
    if (args.force) {
        let forceTarget = getNextArg(args, "force");
        if (!forceTarget)
            return ns.tprint(c.red + "[startup.js]" + c.reset + " Must specify script basename for --force.");
        let scriptList = findScriptsByBasename(ns, forceTarget);
        if (!scriptList.length)
            return ns.tprint(c.red + "[startup.js]" + c.reset + ` No matching scripts for --force: ${forceTarget}`);
        for (const { script, params } of scriptList) {
            biosMsg(ns, c, script, "FORCE", `Launching immediately: ${script} ${params.join(" ")}`, "cyan", args);
            ns.run(script, 1, ...params);
        }
        return;
    }
    // --- ADD MODE ---
    if (args.add) {
        let script = getNextArg(args, "add");
        if (!script)
            return ns.tprint(c.red + "[startup.js]" + c.reset + " Must specify script path for --add.");
        let addParams = getParamsAfterFlag(ns, args, "add");
        let delay = getDelay(addParams);
        if (delay === null)
            delay = DEFAULT_DELAY;
        let line = [script, ...stripFlag(addParams, "add")].join(" ");
        if (!addParams.some(x => x.startsWith("--delay=")))
            line += ` --delay=${delay}`;
        await addStartupEntry(ns, script, line, args, c);
        return;
    }
    // --- UPDATE MODE ---
    if (args.update !== false) {
        let target = getNextArg(args, "update");
        if (!target)
            return ns.tprint(c.red + "[startup.js]" + c.reset + " Must specify script basename (or line #) for --update.");
        let params = getParamsAfterFlag(ns, args, "update");
        await updateStartupEntry(ns, target, params, c);
        return;
    }
    // --- REMOVE MODE ---
    if (args.remove !== false) {
        let target = getNextArg(args, "remove");
        if (!target)
            return ns.tprint(c.red + "[startup.js]" + c.reset + " Must specify script basename (or line #) for --remove.");
        await removeStartupEntry(ns, target, c);
        return;
    }
    // --- MAIN BOOT SEQUENCE ---
    if (!ns.fileExists(STARTUP_LIST, "home")) {
        ns.tprint(c.red + "[startup.js]" + c.reset + " No /data/startup.txt found; nothing to launch.");
        return;
    }
    let lines = ns.read(STARTUP_LIST).split("\n").map(x => x.trim()).filter(x => x && !x.startsWith("#"));
    if (!lines.length) {
        ns.tprint(c.yellow + "[startup.js]" + c.reset + " /data/startup.txt is empty; nothing to launch.");
        return;
    }
    biosHeader(ns, c, args);
    for (let idx = 0; idx < lines.length; ++idx) {
        let raw = lines[idx];
        let [script, ...params] = raw.split(/\s+/);
        let delay = getDelay(params);
        let force = params.some(x => x === "--force");
        if (delay === null)
            delay = DEFAULT_DELAY;
        // BIOS INIT MSG
        biosMsg(ns, c, script, "INIT", `Queued for launch [delay=${delay}ms]${force ? " [FORCE]" : ""}`, "white", args);
        if (!ns.fileExists(script, "home")) {
            biosMsg(ns, c, script, "ERROR", "Not found on home. Skipping.", "red", args);
            continue;
        }
        // Delay countdown (unless --force or first script)
        if (!force && idx > 0 && delay > 0) {
            for (let i = delay; i > 0; i -= 1000) {
                let s = Math.max(1, Math.ceil(i / 1000));
                biosMsg(ns, c, script, "UPDATE", `Launching in ${s}s...`, "cyan", args, true);
                await ns.sleep(Math.min(1000, i));
            }
        }
        // BIOS LAUNCH MSG
        biosMsg(ns, c, script, "UPDATE", `Launching: ${script} ${params.filter(x => !x.startsWith("--delay")).join(" ")}`, "green", args);
        ns.run(script, 1, ...params.filter(x => !x.startsWith("--delay") && x !== "--force"));
        biosMsg(ns, c, script, "NOTICE", "Launch issued.", "yellow", args);
    }
    biosMsg(ns, c, "startup.js", "TERMINATE", "Boot sequence complete.", "magenta", args);
}
// --- UTILITIES ---
function biosHeader(ns, c, args) {
    if (args.silent)
        return;
    let now = timestamp();
    let lines = [
        c.red + "=========================================" + c.reset,
        c.white + `[${now}] [startup.js] : BIOS POST -- PRAAXIS_ALPHA BOOTUP` + c.reset,
        c.gray + "Bitburner boot orchestrator, powered by PRAAXIS_ALPHA.\n" + c.reset
    ];
    lines.forEach(l => ns.tprint(l));
}
function biosMsg(ns, c, script, type, msg, color, args, updateOnly = false) {
    if (args.silent)
        return;
    if (args.quiet && ["UPDATE", "NOTICE"].includes(type))
        return;
    let now = timestamp();
    let out = `${c.gray}[${now}]${c.reset} ${c.white}[${basename(script)}]${c.reset} ${c[color]}${type}${c.reset}: ${c.white}${msg}${c.reset}`;
    ns.tprint(out);
}
function timestamp() {
    return new Date().toLocaleTimeString("en-US", { hour12: false });
}
function basename(path) {
    return path.split("/").pop();
}
function getDelay(params) {
    let delayParam = params.find(x => x.startsWith("--delay="));
    if (!delayParam)
        return null;
    let v = parseInt(delayParam.split("=")[1]);
    return isNaN(v) ? null : v;
}
function getNextArg(args, flag) {
    let idx = process.argv.indexOf("--" + flag);
    if (idx === -1 || idx + 1 >= process.argv.length)
        return null;
    let next = process.argv[idx + 1];
    return next && !next.startsWith("--") ? next : null;
}
function getParamsAfterFlag(ns, args, flag) {
    // All params after the flag, skipping subsequent flags
    let arr = [];
    let idx = process.argv.indexOf("--" + flag);
    for (let i = idx + 2; i < process.argv.length; ++i) {
        if (process.argv[i].startsWith("--") && arr.length)
            break;
        arr.push(process.argv[i]);
    }
    return arr;
}
function stripFlag(params, flag) {
    // Remove --add/--update/etc. from arg list
    return params.filter(x => !x.startsWith("--" + flag));
}
async function addStartupEntry(ns, script, line, args, c) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    // Remove any exact path duplicates
    list = list.filter(l => !l.startsWith(script + " "));
    list.push(line);
    await ns.write(STARTUP_LIST, list.filter(x => x.length).join('\n') + '\n', "w");
    ns.tprint(c.green + `[startup.js]` + c.reset + ` Added: ${line}`);
}
function findScriptsByBasename(ns, name) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    return list.filter(line => basename(line.split(/\s+/)[0]) === basename(name))
        .map(line => {
        let [script, ...params] = line.split(/\s+/);
        return { script, params };
    });
}
async function updateStartupEntry(ns, target, params, c) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    let updated = false;
    let isIndex = /^\d+$/.test(target);
    for (let i = 0; i < list.length; ++i) {
        let tokens = list[i].split(/\s+/);
        let script = tokens[0];
        if ((isIndex && parseInt(target) === i + 1) || (!isIndex && basename(script) === basename(target))) {
            // Only update flags provided (leave others untouched)
            for (const param of params) {
                let [flag, value] = param.split("=");
                if (!flag.startsWith("--"))
                    continue;
                // Update or add
                let idx = tokens.findIndex(x => x.startsWith(flag + "="));
                if (idx !== -1)
                    tokens[idx] = param;
                else
                    tokens.push(param);
            }
            list[i] = tokens.join(" ");
            updated = true;
        }
    }
    if (updated) {
        await ns.write(STARTUP_LIST, list.filter(x => x.length).join('\n') + '\n', "w");
        ns.tprint(c.green + `[startup.js]` + c.reset + ` Updated: ${target}`);
    }
    else {
        ns.tprint(c.yellow + `[startup.js]` + c.reset + ` No entry found for update: ${target}`);
    }
}
async function removeStartupEntry(ns, target, c) {
    let list = ns.fileExists(STARTUP_LIST, "home")
        ? ns.read(STARTUP_LIST).split('\n').map(x => x.trim())
        : [];
    let isIndex = /^\d+$/.test(target);
    let before = list.length;
    if (isIndex) {
        let idx = parseInt(target) - 1;
        if (idx >= 0 && idx < list.length)
            list.splice(idx, 1);
    }
    else {
        list = list.filter(line => basename(line.split(/\s+/)[0]) !== basename(target));
    }
    let after = list.length;
    await ns.write(STARTUP_LIST, list.filter(x => x.length).join('\n') + '\n', "w");
    if (after < before) {
        ns.tprint(c.green + `[startup.js]` + c.reset + ` Removed: ${target}`);
    }
    else {
        ns.tprint(c.yellow + `[startup.js]` + c.reset + ` No entry found to remove: ${target}`);
    }
}
function printHelpTable(ns, c) {
    let table = `
${c.cyan}Flag${c.reset}           ${c.yellow}Description${c.reset}
${c.cyan}--add foo.js ...${c.reset}    Add new entry to startup.txt (supports --delay=ms, other params)
${c.cyan}--update bar.js ...${c.reset} Update flags for all bar.js lines (by basename or index)
${c.cyan}--remove baz.js${c.reset}     Remove entry by basename or index
${c.cyan}--force qux.js${c.reset}      Immediately run matching script(s) now (outside boot order)
${c.cyan}--quiet${c.reset}             Suppress update/notices during boot
${c.cyan}--silent${c.reset}            Suppress all except errors/fatal
${c.cyan}--help${c.reset}              Show this help table

${c.white}Each entry in /data/startup.txt can have:${c.reset}
    /path/to/script.js --delay=ms [flags] [--force]
    (delay is ms, --force skips delay/countdown for that line)
`.trim();
    ns.tprint("\n" + table + "\n");
}
