/**
 * analyzer.js (v2.8.1 updated)
 * Fully featured script analyzer with:
 * - CLI flag parsing (--server, --directory, --script, --all)
 * - Per-file analysis of RAM costs, NS API usage, group summaries
 * - Red/white bar charts
 * - Output fully buffered per file to avoid interruptions
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
        ["server", "home"],
        ["directory", ""],
        ["script", ""],
        ["all", false],
        ["help", false]
    ]);
    const flags = Object.assign({}, rawFlags);
    if (flags.help || (!flags.directory && !flags.script && !flags.all)) {
        ns.tprint("Usage: run analyzer.js [--server] [--script] [--directory] [--all]");
        return;
    }
    function pad(str, w, r = false) {
        str = String(str);
        const raw = str.replace(/\u001b\[[0-9;]*m/g, '');
        if (raw.length > w)
            return raw.slice(0, w - 2) + "… ";
        const pad = " ".repeat(w - raw.length);
        return r ? pad + str : str + pad;
    }
    function barChart(value, max = 16.0, width = 16) {
        const filled = Math.round((value / max) * width);
        const empty = width - filled;
        return (color.white + "[" +
            color.red + "█".repeat(filled) +
            color.black + " ".repeat(empty) +
            color.white + "]" +
            color.reset);
    }
    function extractFunctions(scriptText) {
        return (scriptText.match(/ns\.[\w\.]+/g) || [])
            .map(x => x.trim())
            .filter(x => !x.includes("//"));
    }
    function groupAPI(fn) {
        if (fn.startsWith("ns.corporation."))
            return "corporation";
        if (fn.startsWith("ns.bladeburner."))
            return "bladeburner";
        if (fn.startsWith("ns.gang."))
            return "gang";
        if (fn.startsWith("ns.singularity."))
            return "singularity";
        if (fn.startsWith("ns.hacknet."))
            return "hacknet";
        if (fn.startsWith("ns.heart."))
            return "heart";
        return "core";
    }
    function getRamCost(fn) {
        if (!fn.startsWith("ns."))
            return 0;
        const stripped = fn.replace(/^ns\./, "");
        try {
            return ns.getFunctionRamCost(stripped) || 0;
        }
        catch {
            return 0;
        }
    }
    async function analyzeFile(file, server = "home") {
        const script = ns.read(file);
        const usedFns = [...new Set(extractFunctions(script))];
        const functionData = usedFns.map(name => ({
            name,
            ram: getRamCost(name),
            group: groupAPI(name)
        }));
        const groupTotals = {};
        for (const f of functionData) {
            groupTotals[f.group] = (groupTotals[f.group] || 0) + f.ram;
        }
        const totalRam = ns.getScriptRam(file, flags.server);
        const fileSize = script.length;
        const dedupedRam = functionData.reduce((sum, f) => sum + f.ram, 0);
        const buffer = [];
        buffer.push("\n" + color.red + "=".repeat(60));
        buffer.push(`${color.red}### ${color.white}[${file}] ${color.red}on ${color.white}${flags.server}${color.red} ###${color.reset}`);
        buffer.push(color.red + "=".repeat(60) + color.reset);
        buffer.push(`\n${color.white}Total RAM Cost: ${totalRam.toFixed(2)} GB${color.reset}`);
        buffer.push(`  ${color.gray}(Base: 1.6 + NS: ${dedupedRam.toFixed(2)} GB deduped, Raw: ${dedupedRam.toFixed(2)} GB)`);
        buffer.push(`  File Size: ${fileSize.toLocaleString()} bytes\n`);
        buffer.push(`${color.yellow}Per-API Group RAM Usage:${color.reset}`);
        for (const group of Object.keys(groupTotals).sort((a, b) => groupTotals[b] - groupTotals[a])) {
            buffer.push(`- ${pad(group, 18)} ${groupTotals[group].toFixed(2)} GB`);
        }
        buffer.push(`\n${color.red}NS Function Breakdown:${color.reset}`);
        buffer.push(color.white + pad("Function", 36) + pad("RAM", 6) + " Bar" + color.reset);
        buffer.push(color.gray + "-".repeat(60) + color.reset);
        for (const fn of functionData.sort((a, b) => b.ram - a.ram)) {
            buffer.push(color.green + pad(fn.name, 36) +
                color.white + pad(fn.ram.toFixed(2), 6) +
                barChart(fn.ram));
        }
        buffer.push("\n" + color.white + "Core Utilization:" + color.reset + " " + color.yellow + "No" + color.reset);
        buffer.push(color.white + "Processing Impact:" + color.reset + " " + color.yellow + "Async – Uses await/sleep; ideal for background automation." + color.reset);
        buffer.push(`\n${color.yellow}Tips:${color.reset}`);
        buffer.push(`- ${color.green}Max threads = floor(RAM / ${totalRam.toFixed(2)})${color.reset}`);
        buffer.push(`- Async tasks are ideal for passive background execution.`);
        buffer.push(`- Remove unused NS calls to reduce RAM footprint.`);
        return buffer.join("\n");
    }
    const outputBuffer = [];
    if (flags.script) {
        outputBuffer.push(await analyzeFile(flags.script));
    }
    else {
        const allFiles = flags.all
            ? ns.ls(flags.server).filter(f => f.endsWith(".js"))
            : ns.ls(flags.server, flags.directory).filter(f => f.endsWith(".js"));
        if (!allFiles.length) {
            ns.tprint(`${color.red}No .js files found in ${flags.directory || '/'} on ${flags.server}.${color.reset}`);
            return;
        }
        outputBuffer.push(`${color.white}\nTotal .js files in ${flags.directory || '/'}: ${allFiles.length}${color.reset}`);
        for (const file of allFiles) {
            outputBuffer.push(await analyzeFile(file));
        }
    }
    ns.tprint(outputBuffer.join("\n"));
}
