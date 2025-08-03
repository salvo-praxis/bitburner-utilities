/** @param {NS} ns */
export async function main(ns) {
    // Read input files from /data/
    const knownServersContent = ns.read("/data/known-servers.txt");
    const backdooredServersContent = ns.read("/data/backdoored-servers.txt");

    // Parse known-servers.txt (server: path format)
    const knownServers = knownServersContent.split("\n")
        .filter(s => s.trim() !== "")
        .map(line => {
            const parts = line.split(": ");
            const name = parts[0].trim();
            const pathStr = parts[1].trim();
            const path = pathStr === "-" ? [] : pathStr.split(" > ").map(s => s.trim());
            return { name, path };
        });
    const backdooredServers = backdooredServersContent.split("\n").filter(s => s.trim() !== "");

    // Log contents
    ns.tprint(`\nRaw /data/known-servers.txt content: ${knownServersContent || "Empty"}`);
    ns.tprint(`Parsed ${knownServers.length} servers from /data/known-servers.txt`);
    ns.tprint(`Raw /data/backdoored-servers.txt content: ${backdooredServersContent || "Empty"}`);
    ns.tprint(`Parsed ${backdooredServers.length} servers from /data/backdoored-servers.txt`);

    if (knownServers.length === 0) {
        ns.tprint("ERROR: No servers found in /data/known-servers.txt. Run crawler.js to populate it.");
    }

    const playerHackingLevel = ns.getHackingLevel();
    const programs = [
        { name: "BruteSSH.exe", fn: ns.brutessh },
        { name: "FTPCrack.exe", fn: ns.ftpcrack },
        { name: "relaySMTP.exe", fn: ns.relaysmtp },
        { name: "HTTPWorm.exe", fn: ns.httpworm },
        { name: "SQLInject.exe", fn: ns.sqlinject }
    ].filter(p => ns.fileExists(p.name));
    const analysis = [];

    // Evaluate each server
    for (const server of knownServers) {
        if (!ns.serverExists(server.name)) {
            ns.tprint(`Skipping ${server.name}: Server does not exist`);
            continue;
        }

        const details = ns.getServer(server.name);
        const canHack = playerHackingLevel >= details.requiredHackingSkill;
        const portsOpen = programs.length;
        const canRoot = portsOpen >= details.numOpenPortsRequired && playerHackingLevel >= details.requiredHackingSkill;
        const canBackdoor = details.hasAdminRights && !backdooredServers.includes(server.name) && !details.backdoorInstalled;
        
        analysis.push({
            name: server.name,
            hackDifficulty: details.hackDifficulty,
            paragraph: `${server.name}:\n` +
                `Hacking: ${canHack ? "Possible" : `Not possible (requires level ${details.requiredHackingSkill})`}\n` +
                `Root: ${details.hasAdminRights ? "Already rooted" : canRoot ? "Rootable" : `Not rootable (requires ${details.numOpenPortsRequired} ports, ${details.requiredHackingSkill} level)`}\n` +
                `Backdoor: ${details.backdoorInstalled || backdooredServers.includes(server.name) ? "Already installed" : canBackdoor ? "Can install (rooted, not backdoored)" : "Cannot install (needs root)"}\n` +
                `Money: ${ns.formatNumber(details.moneyAvailable)}/${ns.formatNumber(details.moneyMax)}\n` +
                `Security: ${details.hackDifficulty.toFixed(2)} (min: ${details.minDifficulty.toFixed(2)})\n` +
                `Ports Required: ${details.numOpenPortsRequired}, Available Programs: ${programs.map(p => p.name).join(", ") || "None"}\n` +
                `Path: ${server.path.join(" > ") || "None"}`
        });
    }

    // Sort by hack difficulty
    analysis.sort((a, b) => a.hackDifficulty - b.hackDifficulty);

    // Write to /data/server-analysis.txt
    const output = analysis.map(a => `${a.paragraph}\n---------------------`).join("\n");
    ns.write("/data/server-analysis.txt", output || "No servers analyzed", "w");
    ns.tprint(`Wrote analysis for ${analysis.length} servers to /data/server-analysis.txt`);
}