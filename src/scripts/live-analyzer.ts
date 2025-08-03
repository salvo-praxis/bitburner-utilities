/**
 * live-analyzer.ts (v1.0)
 * Real-time analyzer for currently running scripts.
 * No Singularity API required.
 *
 * CLI Flags:
 *   --server <hostname>  (default: home)
 *
 * Outputs a breakdown of all running scripts on a server,
 * including script name, RAM usage, threads, total usage,
 * and a red/white bar chart visualization.
 */

/** @param {NS} ns */
export async function main(ns) {
    const color = {
        reset: "\u001b[0m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        red: "\u001b[31m",
        white: "\u001b[37m",
        gray: "\u001b[90m",
        black: "\u001b[30m"
    };

    const rawFlags = ns.flags([
        ["server", "home"]
    ]);

    const server = rawFlags.server;
    const processes = ns.ps(server);

    if (!processes.length) {
        ns.tprint(`${color.yellow}No running scripts found on ${server}.${color.reset}`);
        return;
    }

    let maxTotalRam = 0;
    const outputBuffer = [];

    outputBuffer.push("\n" + color.red + "=".repeat(60));
    outputBuffer.push(`${color.red}### ${color.white}Running Scripts on ${server} ${color.red}###${color.reset}`);
    outputBuffer.push(color.red + "=".repeat(60) + color.reset);

    for (const p of processes) {
        const ramPerThread = ns.getScriptRam(p.filename, server);
        const totalRam = ramPerThread * p.threads;
        maxTotalRam = Math.max(maxTotalRam, totalRam);

        outputBuffer.push(`\n${color.white}${p.filename}${color.reset}`);
        outputBuffer.push(`  Threads: ${color.green}${p.threads}${color.reset}`);
        outputBuffer.push(`  RAM per thread: ${color.white}${ramPerThread.toFixed(2)} GB${color.reset}`);
        outputBuffer.push(`  Total RAM: ${color.yellow}${totalRam.toFixed(2)} GB${color.reset}`);
    }

    outputBuffer.push("\n" + color.red + "Bar Chart Overview:" + color.reset);
    for (const p of processes) {
        const ramPerThread = ns.getScriptRam(p.filename, server);
        const totalRam = ramPerThread * p.threads;
        const filled = Math.round((totalRam / maxTotalRam) * 20);
        const empty = 20 - filled;
        const bar = `${color.white}[${color.red}${"█".repeat(filled)}${color.black}${" ".repeat(empty)}${color.white}]${color.reset}`;
        outputBuffer.push(`${pad(p.filename, 30)} ${pad(totalRam.toFixed(2), 6)} GB ${bar}`);
    }

    ns.tprint(outputBuffer.join("\n"));

    function pad(str, w, r = false) {
        str = String(str);
        let raw = str.replace(/\u001b\[[0-9;]*m/g, '');
        if (raw.length > w) return raw.slice(0, w - 2) + "… ";
        let pad = " ".repeat(w - raw.length);
        return r ? pad + str : str + pad;
    }
}
