/**
 * stats-report.js
 *
 * Provides a terminal report of your hacking fleet:
 *  - Total, used, and free RAM across all rooted servers
 *  - Free threads available for high- and low-RAM scripts
 *  - Number of running processes and total threads in use
 *  - Estimated potential money per minute/hour using free threads on the best target and average
 *  - Estimated current money gain per minute/hour from running scripts
 *  - XP estimates via --measure flag (executes one hack)
 *
 * Usage: run stats-report.js [--measure]
 */

/** @param {NS} ns **/
export async function main(ns) {
    // Parse flags
    const args = ns.flags([["measure", false]]);
    const doMeasure = args.measure;

    // Scripts and data file
    const lowRamScript  = "/scripts/hgw-lowram.js";
    const highRamScript = "/scripts/hgw-highram.js";
    const targetsFile   = "/data/distributed-targets.txt";

    // 1) Discover all rooted servers (BFS)
    const visited = new Set(["home"]);
    const queue = ["home"];
    while (queue.length > 0) {
        const host = queue.shift();
        for (const nbr of ns.scan(host)) {
            if (!visited.has(nbr)) {
                visited.add(nbr);
                queue.push(nbr);
            }
        }
    }
    const rooted = Array.from(visited).filter(s => ns.hasRootAccess(s));

    // 2) Aggregate RAM and process stats
    let totalMaxRam = 0;
    let totalUsedRam = 0;
    let totalProcesses = 0;
    let totalProcessThreads = 0;
    for (const srv of rooted) {
        totalMaxRam += ns.getServerMaxRam(srv);
        totalUsedRam += ns.getServerUsedRam(srv);
        const procs = ns.ps(srv);
        totalProcesses += procs.length;
        totalProcessThreads += procs.reduce((sum, p) => sum + p.threads, 0);
    }
    const totalFreeRam = totalMaxRam - totalUsedRam;

    // 3) Calculate free threads
    const ramHigh = ns.getScriptRam(highRamScript, "home");
    const ramLow  = ns.getScriptRam(lowRamScript,  "home");
    const freeHighThreads = Math.floor(totalFreeRam / ramHigh);
    const freeLowThreads  = Math.floor(totalFreeRam / ramLow);

    // 4) Load valid targets
    let validTargets = [];
    try {
        validTargets = ns.read(targetsFile)
            .split("\n")
            .map(t => t.trim())
            .filter(t => t && ns.hasRootAccess(t));
    } catch {
        validTargets = [];
    }

    // Helper: money per second per thread
    function moneyPerSec(target) {
        const secs = ns.getHackTime(target) / 1000;
        const max = ns.getServerMaxMoney(target);
        const frac = ns.hackAnalyze(target);
        return frac * max / secs;
    }

    // 5) Estimate potential gains
    let bestTarget = null;
    let potMoneyPS = 0;
    let avgMoneyPS = 0;
    if (validTargets.length > 0) {
        const gains = validTargets.map(t => ({
            target: t,
            mps: moneyPerSec(t)
        }));
        gains.sort((a, b) => b.mps - a.mps);
        bestTarget = gains[0].target;
        potMoneyPS = gains[0].mps * freeHighThreads;
        const sum = gains.reduce((acc, g) => acc + g.mps, 0);
        avgMoneyPS = (sum / gains.length) * freeHighThreads;
    }

    // 6) Compute current running gains
    let runMoneyPS = 0;
    for (const srv of rooted) {
        for (const p of ns.ps(srv)) {
            const name = p.filename;
            if ([highRamScript, lowRamScript].some(path => path.endsWith(name))) {
                runMoneyPS += moneyPerSec(p.args[0]) * p.threads;
            }
        }
    }

    // 7) XP measurement if requested
    let xpPerSec = 0;
    if (doMeasure && bestTarget) {
        ns.tprint(`Measuring XP: hacking 1 thread on ${bestTarget}...`);
        const before = ns.getPlayer().skills.hacking;
        await ns.hack(bestTarget);
        const after = ns.getPlayer().skills.hacking;
        const delta = after - before;
        const secs = ns.getHackTime(bestTarget) / 1000;
        xpPerSec = delta / secs;
    }

    // 8) Output
    const toMin = x => x * 60;
    const toHr  = x => x * 3600;

    ns.tprint("===== FLEET STATS REPORT =====");
    ns.tprint(`Rooted servers       : ${rooted.length}`);
    ns.tprint(`RAM Used/Total/Free  : ${totalUsedRam.toFixed(2)}/${totalMaxRam.toFixed(2)}/${totalFreeRam.toFixed(2)} GB`);
    ns.tprint(`Processes running    : ${totalProcesses}`);
    ns.tprint(`Threads in processes : ${totalProcessThreads}`);
    ns.tprint(`Free threads (High)  : ${freeHighThreads}`);
    ns.tprint(`Free threads (Low)   : ${freeLowThreads}`);

    if (bestTarget) {
        ns.tprint("--- Potential Money Gains ---");
        ns.tprint(`Best target: ${bestTarget}`);
        ns.tprint(`Money/min (best): $${toMin(potMoneyPS).toLocaleString('en', {notation:'compact',compactDisplay:'short',maximumFractionDigits:2})}` +
                   `, Money/hr: $${toHr(potMoneyPS).toLocaleString('en', {notation:'compact',compactDisplay:'short',maximumFractionDigits:2})}`);
        ns.tprint(`Money/min (avg) : $${toMin(avgMoneyPS).toLocaleString('en', {notation:'compact',compactDisplay:'short',maximumFractionDigits:2})}`);
    }

    ns.tprint("--- Current Running Money Gains ---");
    ns.tprint(`Money/min: $${toMin(runMoneyPS).toLocaleString('en', {notation:'compact',compactDisplay:'short',maximumFractionDigits:2})}` +
               `, Money/hr: $${toHr(runMoneyPS).toLocaleString('en', {notation:'compact',compactDisplay:'short',maximumFractionDigits:2})}`);

    if (doMeasure) {
        ns.tprint("--- XP Measurement ---");
        ns.tprint(`XP/sec: ${xpPerSec.toFixed(4)}, XP/min: ${toMin(xpPerSec).toFixed(2)}` +
                   `, XP/hr: ${toHr(xpPerSec).toFixed(2)}`);
    } else {
        ns.tprint("XP estimates: run with --measure to measure XP/sec (consumes one hack)");
    }
}
