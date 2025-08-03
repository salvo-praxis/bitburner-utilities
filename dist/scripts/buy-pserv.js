/**
 * buy-pserv.js
 *
 * Without parameters, displays a cost table for personal servers from 16GB–1TB.
 * With --size and --count (and optional --start), purchases servers named:
 *   praxis-server-<size><GB|TB>-XX
 * where XX starts at --start or next available index.
 *
 * Usage:
 *   run buy-pserv.js
 *   run buy-pserv.js --size 16 --count 4           # buys 4 of 16GB
 *   run buy-pserv.js --size 16 --count 4 --start 11 # starts naming at index 11
 */
/** @param {NS} ns **/
export async function main(ns) {
    // Disable verbose logs
    ns.disableLog("ALL");
    ns.clearLog();
    // Parse flags
    const flags = ns.flags([
        ["size", undefined], // RAM in GB (16,32,64,128,256,512,1024)
        ["count", undefined], // How many to purchase
        ["start", undefined], // Optional starting index
    ]);
    const size = flags.size === undefined ? undefined : parseInt(flags.size);
    let count = flags.count === undefined ? undefined : parseInt(flags.count);
    let startIdx = flags.start === undefined ? undefined : parseInt(flags.start);
    const limit = ns.getPurchasedServerLimit();
    const owned = ns.getPurchasedServers();
    const options = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 65536, 131072, 262144, 524288, 1048576];
    // If missing size or count, show cost table
    if (size === undefined || count === undefined) {
        ns.tprint(`=== Server Purchase Cost Table (limit ${limit}) ===`);
        for (const r of options) {
            const cost = ns.getPurchasedServerCost(r);
            const costStr = cost.toLocaleString('en', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 });
            const tempLabel = r >= 1024 ? (r == 1048576 ? `1 PB` : `${r / 1024} TB`) : `${r} GB`;
            ns.tprint(`${tempLabel} : $${costStr}`);
            ns.tprint(`run buy-pserv.js --size ${r} --count <N> [--start <idx>]`);
            ns.tprint(``);
        }
        return;
    }
    // Validate size and count
    if (!options.includes(size)) {
        ns.tprint(`ERROR: Invalid size '${size}'. Must be one of ${options.join(", ")}`);
        return;
    }
    if (isNaN(count) || count <= 0) {
        ns.tprint(`ERROR: Invalid count '${flags.count}'. Must be a positive integer.`);
        return;
    }
    const sizeLabel = size >= 1024 ? (size == 1048576 ? `1PB` : `${size / 1024}TB`) : `${size}GB`;
    //const sizeLabel = size >= 1024 ? (size >= 2097152 ? `${size/2048}PB` : `${size/1024}TB`) : `${size}GB`;
    const prefix = `praxis-server-${sizeLabel}-`;
    // Determine starting index if not provided
    if (startIdx === undefined) {
        const existing = owned
            .filter(n => n.startsWith(prefix))
            .map(n => parseInt(n.slice(prefix.length)))
            .filter(i => !isNaN(i));
        // Next index: if existing empty start at 1, else max+1
        startIdx = existing.length === 0 ? 1 : Math.max(...existing) + 1;
    }
    // Check slot availability
    const slotsLeft = limit - owned.length;
    if (slotsLeft <= 0) {
        ns.tprint(`ERROR: Already own ${owned.length}/${limit} servers (limit reached).`);
        return;
    }
    if (count > slotsLeft) {
        ns.tprint(`Only ${slotsLeft} slots free; reducing count from ${count} to ${slotsLeft}.`);
        count = slotsLeft;
    }
    // Purchase servers
    for (let i = 0; i < count; i++) {
        const idx = startIdx + i;
        // Format index with leading zero if <10
        const idxStr = idx < 10 ? `0${idx}` : `${idx}`;
        const name = `${prefix}${idxStr}`;
        const cost = ns.getPurchasedServerCost(size);
        if (ns.getServerMoneyAvailable("home") < cost) {
            ns.tprint(`✖ Not enough money to buy ${name} (${sizeLabel}). Need $${cost.toLocaleString()}.`);
            break;
        }
        ns.purchaseServer(name, size);
        ns.tprint(`✔ Purchased ${name} (${sizeLabel}) for $${cost.toLocaleString()}`);
    }
}
