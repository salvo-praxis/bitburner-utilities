/**
 * cleanup.js
 * Modern BIOS-format output, perfect alignment, PRAAXIS_ALPHA standards.
 * v2.9.1 | 2025-07-24 | SALVO PRAXIS | PRAAXIS_ALPHA
 */

/** @param {NS} ns **/
export async function main(ns) {
    const KNOWN_SERVERS_FILE = "/data/known-servers.txt";
    const NATIVE_TXT = ["readme.txt", "welcome.txt", "instructions.txt"];
    const H_GW_PATTERNS = [/hgw/i, /hack-grow-weaken/i];

    const args = ns.flags([
        ["home", false],
        ["remote", false],
        ["purchased", false],
        ["killall", false],
        ["dry-run", false],
        ["quiet", false],
        ["silent", false],
        ["help", false],
    ]);
    const c = {
        reset: "\u001b[0m",
        white: "\u001b[37m",
        red: "\u001b[31m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        cyan: "\u001b[36m",
        bold: "\u001b[1m",
        lgreen: "\u001b[92m",
        lcyan: "\u001b[96m"
    };
    const arrowCyan = c.cyan + "→" + c.reset;

    function biosMsg(type, msg, server = null, always = false) {
        if (args.silent && !always) return;
        let icon = arrowCyan;
        let colorType = "";
        if (type === "INIT") colorType = c.cyan;
        else if (type === "SUCCESS") colorType = c.lgreen;
        else if (type === "SUMMARY") colorType = c.cyan;
        else if (type === "TERMINATE") colorType = c.red;

        // Bracket order: [TYPE][SERVER] instead of [SERVER][TYPE]
        let tags = [];
        tags.push(
            c.white + "[" + colorType + type + c.reset + c.white + "]" + c.reset
        );
        if (server) {
            tags.push(c.white + "[" + server + "]" + c.reset);
        }
        ns.tprint(`${icon} ${tags.join("")} ${c.white}${msg}${c.reset}`);
    }

    // --- HELP ---
    if (args.help) return showHelp(ns, c);

    biosHeader(ns, c, args);

    // Load known servers from file
    let servers = [];
    try {
        const fileContent = ns.read(KNOWN_SERVERS_FILE);
        if (!fileContent) throw "empty or missing";
        servers = fileContent.trim().split("\n")
            .filter(s => s.trim())
            .map(line => {
                const [name, path] = line.split(": ").map(part => part.trim());
                return { name, path };
            });
    } catch (e) {
        biosMsg("TERMINATE", `Failed to read ${KNOWN_SERVERS_FILE}: ${e}`, null, true);
        return;
    }

    // Identify server classes
    const purchased = servers.filter(s => s.name && s.name.startsWith("pserv-"));
    const home = servers.find(s => s.name === "home");
    const remotes = servers.filter(s =>
        s.name && s.name !== "home" && !s.name.startsWith("pserv-") && ns.getServerMaxRam(s.name) > 0
    );

    let targetSets = [];
    if (args.home) targetSets.push({ label: "home", servers: [home] });
    if (args.remote || (!args.home && !args.purchased)) targetSets.push({ label: "remote", servers: remotes });
    if (args.purchased) targetSets.push({ label: "purchased", servers: purchased });

    let processedServers = 0;
    let totalKilled = 0;
    let totalDeleted = 0;

    for (const { label, servers: set } of targetSets) {
        if (!set || set.length === 0) continue;
        for (const srv of set) {
            if (!srv) continue;
            if (!ns.hasRootAccess(srv.name)) continue;
            processedServers++;
            biosMsg("INIT", `cleaning ${srv.name}...`, srv.name);
            let killed = 0, deleted = 0;
            // -- HOME LOGIC --
            if (label === "home") {
                let processes = ns.ps(srv.name);
                if (args.killall) {
                    for (const proc of processes) {
                        if (!args["dry-run"]) ns.kill(proc.pid, srv.name);
                        killed++;
                    }
                } else {
                    for (const proc of processes) {
                        if (H_GW_PATTERNS.some(pat => pat.test(proc.filename))) {
                            if (!args["dry-run"]) ns.kill(proc.pid, srv.name);
                            killed++;
                        }
                    }
                }
                biosMsg("SUCCESS", `killed ${killed} scripts, deleted 0 files.`, srv.name);
                totalKilled += killed;
                continue;
            }
            // -- REMOTE & PURCHASED LOGIC --
            let processes = ns.ps(srv.name);
            for (const proc of processes) {
                if (!args["dry-run"]) ns.kill(proc.pid, srv.name);
                killed++;
            }
            const files = ns.ls(srv.name);
            const toDelete = files.filter(file => {
                if (file.endsWith(".lit") || file.endsWith(".msg")) return false;
                if (file.endsWith(".txt")) {
                    if (!file.includes("/")) {
                        const fname = file.split("/").pop();
                        if (NATIVE_TXT.includes(fname)) return false;
                    }
                    return true;
                }
                if (file.endsWith(".js") || file.endsWith(".script")) return true;
                if (file.startsWith("/scripts/") || file.startsWith("/logs/")) return true;
                return false;
            });
            for (const file of toDelete) {
                if (!args["dry-run"]) ns.rm(file, srv.name);
                deleted++;
            }
            biosMsg("SUCCESS", `killed ${killed} scripts, deleted ${deleted} files.`, srv.name);
            totalKilled += killed;
            totalDeleted += deleted;
        }
    }
    biosMsg("SUMMARY", `✅ ${processedServers} servers processed, ${totalKilled} scripts killed, ${totalDeleted} files deleted.`);
    biosMsg("TERMINATE", "🛑 Cleanup complete.");
}

// --- Helpers ---
function biosHeader(ns, c, args) {
    if (args.silent) return;
    ns.tprint(
        c.yellow + "→ cleanup.js: CLEANUP ─ MODULAR UTILITY" + c.reset
    );
    ns.tprint(
        c.cyan + "→ Automated server process & file cleanup tool." + c.reset
    );
}
function showHelp(ns, c) {
    ns.tprint(
        `${c.bold + c.green}cleanup.js${c.reset} ${c.white}| Modular server cleanup utility${c.reset}\n\n` +
        `${c.cyan}--home${c.reset}        ${c.yellow}Clean up home (kill only hgw* scripts; with --killall, kills all)${c.reset}\n` +
        `${c.cyan}--remote${c.reset}      ${c.yellow}Clean all remote servers (not home/purchased)${c.reset}\n` +
        `${c.cyan}--purchased${c.reset}   ${c.yellow}Clean all purchased servers (not home/remote)${c.reset}\n` +
        `${c.cyan}--killall${c.reset}     ${c.yellow}On home, kill all scripts (not just hgw*)${c.reset}\n` +
        `${c.cyan}--dry-run${c.reset}     ${c.yellow}Simulate only, make no changes${c.reset}\n` +
        `${c.cyan}--quiet${c.reset}       ${c.yellow}Suppress notice messages${c.reset}\n` +
        `${c.cyan}--silent${c.reset}      ${c.yellow}Suppress all except errors/fatal${c.reset}\n` +
        `${c.cyan}--help${c.reset}        ${c.yellow}Show this help screen${c.reset}\n`
    );
}
