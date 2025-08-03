/** @param {NS} ns */
export async function main(ns) {
    const depth = ns.args[0] || 5; // Default depth 5
    const servers = new Map(); // Map to store unique servers
    const visited = new Set(); // Track visited servers to avoid duplicates
    const paths = new Map(); // Store shortest path to each server

    // Player info for actionable notes
    const playerHackingLevel = ns.getHackingLevel();
    const portOpeners = [
        ns.fileExists("BruteSSH.exe", "home") ? 1 : 0,
        ns.fileExists("FTPCrack.exe", "home") ? 1 : 0,
        ns.fileExists("relaySMTP.exe", "home") ? 1 : 0,
        ns.fileExists("HTTPWorm.exe", "home") ? 1 : 0,
        ns.fileExists("SQLInject.exe", "home") ? 1 : 0,
    ].reduce((a, b) => a + b, 0); // Count available port openers

    // Breadth-First Search (BFS) to find shortest paths and collect server info
    const queue = [{ host: "home", path: [] }];
    const seen = new Set(["home"]);
    let currentDepth = 0;

    while (queue.length > 0 && currentDepth <= depth) {
        const levelSize = queue.length;
        for (let i = 0; i < levelSize; i++) {
            const { host, path } = queue.shift();
            
            // Skip if already processed with a shorter path
            if (servers.has(host)) continue;

            // Collect server info
            const serverInfo = {
                name: host,
                path: path.join(" > ") || "-",
                hackLevel: ns.getServerRequiredHackingLevel(host),
                ports: ns.getServerNumPortsRequired(host),
                root: ns.hasRootAccess(host) ? "Yes" : "No",
                ram: ns.getServerMaxRam(host),
                notes: ""
            };

            // Add notes based on player capabilities
            if (serverInfo.root === "Yes" && serverInfo.hackLevel <= playerHackingLevel) {
                serverInfo.notes = "Ready to hack";
            } else if (serverInfo.root === "No" && serverInfo.ports <= portOpeners && serverInfo.hackLevel <= playerHackingLevel) {
                serverInfo.notes = "Can root now";
            } else if (["CSEC", "avmnite-02h", "I.I.I.I"].includes(host)) {
                serverInfo.notes = "Faction server";
            } else if (serverInfo.ram === 0) {
                serverInfo.notes = "No RAM for scripts";
            }

            servers.set(host, serverInfo);
            paths.set(host, path);

            // Scan connected servers
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

    // Convert map to array and sort by hacking level
    const serverList = Array.from(servers.values()).sort((a, b) => a.hackLevel - b.hackLevel);

    // Print table
    const headers = ["Server Name", "Path", "Hack Lvl", "Ports", "Root?", "RAM (GB)", "Notes"];
    const colWidths = [15, 25, 8, 6, 6, 8, 20];
    
    // Print header
    let headerRow = "";
    for (let i = 0; i < headers.length; i++) {
        headerRow += headers[i].padEnd(colWidths[i]) + "| ";
    }
    const totalWidth = headerRow.length - 1;
    ns.tprint("+-" + "-".repeat(totalWidth) + "-+");
    ns.tprint("| " + headerRow);
    ns.tprint("+-" + "-".repeat(totalWidth) + "-+");
    
    // Print rows
    for (const server of serverList) {
        const row = [
            server.name.padEnd(colWidths[0]),
            server.path.padEnd(colWidths[1]),
            server.hackLevel.toString().padEnd(colWidths[2]),
            server.ports.toString().padEnd(colWidths[3]),
            server.root.padEnd(colWidths[4]),
            server.ram.toFixed(2).padEnd(colWidths[5]),
            server.notes.padEnd(colWidths[6])
        ].join("| ");
        ns.tprint("| " + row);
    }
    
    ns.tprint("+-" + "-".repeat(totalWidth) + "-+");
}