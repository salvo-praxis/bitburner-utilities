/** @param {NS} ns **/
export async function main(ns) {
    if (!ns.singularity || !ns.singularity.connect) {
        ns.tprint("ERROR: Singularity API required (SF4) to auto-connect.");
        return;
    }
    const target = ns.args[0];
    if (!target) {
        ns.tprint("Usage: run scon.js <server>");
        ns.tprint("Auto-connects from 'home' to <server> using Singularity API.");
        return;
    }
    // BFS to find path
    let queue = [["home"]];
    let visited = new Set(["home"]);
    let path = null;
    while (queue.length > 0) {
        let curr = queue.shift();
        let last = curr[curr.length - 1];
        if (last === target) {
            path = curr;
            break;
        }
        for (const neighbor of ns.scan(last)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...curr, neighbor]);
            }
        }
    }
    if (!path) {
        ns.tprint(`Could not find a path to '${target}'.`);
        return;
    }
    // Auto-connect along path
    ns.tprint(`Connecting to '${target}':`);
    ns.singularity.connect("home");
    for (let i = 1; i < path.length; ++i) {
        ns.singularity.connect(path[i]);
        ns.tprint(`> connect ${path[i]}`);
    }
    ns.tprint("Done.");
}
