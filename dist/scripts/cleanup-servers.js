/** @param {NS} ns */
export async function main(ns) {
    // Handle arguments
    const dryRun = Array.isArray(ns.args) && ns.args.includes("--dry-run");
    const specificServer = Array.isArray(ns.args) && ns.args.length > 0 && !ns.args[0].startsWith("--") ? ns.args[0] : null;
    const knownServersFile = "/data/known-servers.txt";
    const logFile = "/logs/cleanup-servers.txt";
    // Known native .txt filenames
    const nativeTxtFiles = ["readme.txt", "welcome.txt", "instructions.txt"];
    // Log function with fallback to ns.print
    const log = (message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        try {
            ns.write(logFile, logMessage, "a");
        }
        catch (e) {
            ns.print(`Failed to write to ${logFile}: ${e}`);
            ns.print(logMessage);
        }
    };
    // Clear log file
    try {
        ns.write(logFile, "", "w");
    }
    catch (e) {
        ns.print(`Failed to clear ${logFile}: ${e}`);
    }
    // Read known servers from file
    let servers = [];
    try {
        const fileContent = ns.read(knownServersFile);
        if (!fileContent) {
            log(`Error: ${knownServersFile} is empty or does not exist. Run crawler.js first.`);
            return;
        }
        servers = fileContent.trim().split("\n")
            .filter(s => s.trim())
            .map(line => {
            const [server, path] = line.split(": ").map(part => part.trim());
            return { name: server, path };
        });
    }
    catch (e) {
        log(`Error reading ${knownServersFile}: ${e}`);
        return;
    }
    // Determine servers to clean
    let serversToClean = [];
    if (specificServer) {
        const server = servers.find(s => s.name === specificServer);
        if (!server) {
            log(`Error: Server ${specificServer} not found in ${knownServersFile}`);
            return;
        }
        if (!ns.hasRootAccess(specificServer)) {
            log(`Error: Server ${specificServer} is not rooted`);
            return;
        }
        if (ns.getServerMaxRam(specificServer) <= 0) {
            log(`Warning: Server ${specificServer} has 0 RAM and cannot run scripts, but cleaning as requested`);
        }
        serversToClean = [server];
    }
    else {
        serversToClean = servers.filter(s => ns.hasRootAccess(s.name) &&
            s.name !== "home" &&
            ns.getServerMaxRam(s.name) > 0);
        if (serversToClean.length === 0) {
            log("No rooted servers capable of running scripts found to clean");
            return;
        }
    }
    log(`Processing ${serversToClean.length} servers`);
    // Process servers
    for (const server of serversToClean) {
        // Simulate or kill all processes
        const processes = ns.ps(server.name);
        if (processes.length === 0) {
            log(`${server.name} (Path: ${server.path}): No processes to kill`);
        }
        else {
            for (const process of processes) {
                if (dryRun) {
                    log(`${server.name} (Path: ${server.path}): Would kill ${process.filename} (PID: ${process.pid}, Threads: ${process.threads})`);
                }
                else {
                    if (ns.kill(process.pid, server.name)) {
                        log(`${server.name} (Path: ${server.path}): Killed ${process.filename} (PID: ${process.pid}, Threads: ${process.threads})`);
                    }
                    else {
                        log(`${server.name} (Path: ${server.path}): Failed to kill ${process.filename} (PID: ${process.pid})`);
                    }
                }
            }
        }
        // Identify non-native files
        const files = ns.ls(server.name);
        const nonNativeFiles = [];
        const preservedFiles = [];
        for (const file of files) {
            // Preserve native files
            if (file.endsWith(".lit") || file.endsWith(".msg")) {
                preservedFiles.push(file);
                continue;
            }
            // Handle .txt files
            if (file.endsWith(".txt")) {
                if (!file.includes("/")) { // Root-level .txt
                    const filename = file.split("/").pop();
                    if (nativeTxtFiles.includes(filename)) {
                        preservedFiles.push(file);
                        continue;
                    }
                }
                nonNativeFiles.push(file);
                continue;
            }
            // Delete your files: .js, .script, or files in custom directories
            if (file.endsWith(".js") || file.endsWith(".script")) {
                nonNativeFiles.push(file);
                continue;
            }
            if (file.startsWith("/scripts/") || file.startsWith("/logs/")) {
                nonNativeFiles.push(file);
                continue;
            }
            // Preserve other files by default
            preservedFiles.push(file);
        }
        // Log preserved files
        if (preservedFiles.length > 0) {
            log(`${server.name} (Path: ${server.path}): Preserved files: ${preservedFiles.join(", ")}`);
        }
        // Simulate or delete non-native files
        if (nonNativeFiles.length === 0) {
            log(`${server.name} (Path: ${server.path}): No non-native files to delete`);
        }
        else {
            for (const file of nonNativeFiles) {
                if (dryRun) {
                    log(`${server.name} (Path: ${server.path}): Would delete ${file}`);
                }
                else {
                    try {
                        if (ns.rm(file, server.name)) {
                            log(`${server.name} (Path: ${server.path}): Deleted ${file}`);
                        }
                        else {
                            log(`${server.name} (Path: ${server.path}): Failed to delete ${file}`);
                        }
                    }
                    catch (e) {
                        log(`${server.name} (Path: ${server.path}): Error deleting ${file}: ${e}`);
                    }
                }
            }
        }
    }
    if (dryRun) {
        log("Dry-run complete. Review logs with 'cat /logs/cleanup-servers.txt' or 'tail cleanup-servers.js'");
    }
    else {
        log("Cleanup complete. Review logs with 'cat /logs/cleanup-servers.txt' or 'tail cleanup-servers.js'");
    }
}
