/**
 * @param {NS} ns
 * @deprecated This script is deprecated and will be removed. Use pserv.ts instead.
 */
export async function main(ns: NS) {
    ns.tprint("WARNING: This script is deprecated. Please use pserv.ts instead.");
    ns.tprint("This script will be removed in a future update.");
    return false;

    const prefix = "praxis-server-8TB"
    //var prefix = "praxis-server-1PB"

    for(let i = 1; i <= 25; i++) {
        const suffix = i < 10 ? `-0${i}` : `-${i}`;
        const serverName = prefix + suffix;

        if(ns.killall(serverName)) {
            ns.tprintf("SUCCEEDED killing processes on: " + serverName)
        } else {
            ns.tprintf("FAILED to kill processes on: " + serverName)
        }

        if(ns.deleteServer(serverName)) {
            ns.tprintf("SUCCEEDED deleting server: " + serverName)
        } else {
            ns.tprintf("FAILED to delete server: " + serverName)
        }
    }

    return true;
}
