/** @param {NS} ns */
export async function main(ns) {
    const depth = ns.args[0] || 5; // Default depth 5
    const showAll = ns.args[1] === "all"; // Show all servers if "all" is passed
    const servers = new Map();
    const visited = new Set();

    // Player info
    const playerHackingLevel = ns.getHackingLevel();
    const portOpeners = [
        ns.fileExists("BruteSSH.exe", "home") ? 1 : 0,
        ns.fileExists("FTPCrack.exe", "home") ? 1 : 0,
        ns.fileExists("relaySMTP.exe", "home") ? 1 : 0,
        ns.fileExists("HTTPWorm.exe", "home") ? 1 : 0,
        ns.fileExists("SQLInject.exe", "home") ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    // BFS to scan servers
    const queue = [{ host: "home", path: [] }];
    const seen = new Set(["home"]);
    let currentDepth = 0;

    while (queue.length > 0 && currentDepth <= depth) {
        const levelSize = queue.length;
        for (let i = 0; i < levelSize; i++) {
            const { host, path } = queue.shift();
            if (servers.has(host)) continue;

            const serverInfo = {
                name: host,
                path: path.join(" > ") || "-",
                hackLevel: ns.getServerRequiredHackingLevel(host),
                ports: ns.getServerNumPortsRequired(host),
                root: ns.hasRootAccess(host),
                backdoor: ns.getServer(host).backdoorInstalled,
            };

            servers.set(host, serverInfo);

            const connected = ns.scan(host);
            for (const nextHost of connected) {
                if (!seen.has(nextHost)) {
                    seen.add(nextHost);
                    queue.push({ host: nextHost, path: [...path, host] });
                }
            }
        }
        currentDepth++;
    }

    // Group servers
    const backdoorInstalled = [];
    const canInstallBackdoor = [];
    const canRootToBackdoor = [];
    const outOfReach = [];

    for (const server of servers.values()) {
        if (server.backdoor) {
            backdoorInstalled.push(server);
        } else if (server.root && server.hackLevel <= playerHackingLevel) {
            canInstallBackdoor.push(server);
        } else if (!server.root && server.ports <= portOpeners && server.hackLevel <= playerHackingLevel) {
            canRootToBackdoor.push(server);
        } else {
            outOfReach.push(server);
        }
    }

    // Sort each group by hackLevel
    backdoorInstalled.sort((a, b) => a.hackLevel - b.hackLevel);
    canInstallBackdoor.sort((a, b) => a.hackLevel - b.hackLevel);
    canRootToBackdoor.sort((a, b) => a.hackLevel - b.hackLevel);
    outOfReach.sort((a, b) => a.hackLevel - b.hackLevel);

    // Print grouped list
    ns.tprint("=== Backdoors Installed ===");
    if (backdoorInstalled.length === 0) {
        ns.tprint("None");
    } else {
        for (const server of backdoorInstalled) {
            ns.tprint(`${server.name} (Path: ${server.path}, Hack Lvl: ${server.hackLevel})`);
        }
    }

    ns.tprint("\n=== Can Install Backdoor ===");
    if (canInstallBackdoor.length === 0) {
        ns.tprint("None");
    } else {
        for (const server of canInstallBackdoor) {
            ns.tprint(`${server.name} (Path: ${server.path}, Hack Lvl: ${server.hackLevel})`);
        }
    }

    ns.tprint("\n=== Can Root to Backdoor ===");
    if (canRootToBackdoor.length === 0) {
        ns.tprint("None");
    } else {
        for (const server of canRootToBackdoor) {
            ns.tprint(`${server.name} (Path: ${server.path}, Hack Lvl: ${server.hackLevel})`);
        }
    }

    if (showAll) {
        ns.tprint("\n=== Out of Reach ===");
        if (outOfReach.length === 0) {
            ns.tprint("None");
        } else {
            for (const server of outOfReach) {
                ns.tprint(`${server.name} (Path: ${server.path}, Hack Lvl: ${server.hackLevel})`);
            }
        }
    }
}