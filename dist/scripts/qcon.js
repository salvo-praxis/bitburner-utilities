/** @param {NS} ns **/
export async function main(ns) {
    const target = ns.args[0];
    if (!target) {
        ns.tprint("Usage: run qcon.js <server>");
        ns.tprint("Prints the connect path from 'home' to <server>.");
        return;
    }
    // BFS to find shortest path from home to target
    let queue = [["home"]];
    let visited = new Set(["home"]);
    let found = false;
    while (queue.length > 0) {
        const path = queue.shift();
        const last = path[path.length - 1];
        if (last === target) {
            // Print connect sequence
            const cmds = path.map(s => `connect ${s}`).join("; ");
            ns.tprint(`\nRoute to '${target}':`);
            for (let i = 1; i < path.length; ++i)
                ns.tprint(`connect ${path[i]}`);
            ns.tprint(`\nCopy-paste: ${cmds}`);
            found = true;
            break;
        }
        for (const neighbor of ns.scan(last)) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }
    if (!found) {
        ns.tprint(`Could not find a path to '${target}'.`);
    }
}
