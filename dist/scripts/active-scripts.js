/**
 * active-scripts.js v2.9
 * Overview + deep per-server breakdown with flags:
 *   --server <hostname|all>
 *   --sort-mode <ram|alpha|threads>
 *   --sort <ram|name|threads> (for per-server view)
 *   --group
 *   --bar-width <int>
 *   --help
 */
/** @param {NS} ns **/
export async function main(ns) {
    const color = {
        reset: "\u001b[0m",
        red: "\u001b[31m",
        white: "\u001b[37m",
        gray: "\u001b[90m",
        black: "\u001b[30m",
        yellow: "\u001b[33m",
        green: "\u001b[32m"
    };
    const args = ns.flags([
        ["server", "home"],
        ["sort", "ram"],
        ["sort-mode", "ram"],
        ["group", false],
        ["bar-width", 30],
        ["help", false],
    ]);
    const hostname = args.server;
    const barWidth = args["bar-width"];
    if (args.help) {
        const help = [];
        help.push("");
        help.push(`${color.white}ACTIVE-SCRIPTS.JS - USAGE${color.reset}`);
        help.push("");
        help.push(`${color.yellow}--server <host|all>${color.reset}         View active scripts on a specific server or across all servers`);
        help.push(`${color.yellow}--sort-mode <ram|alpha|threads>${color.reset}  Sort multi-server view by RAM usage (default), name, or threads`);
        help.push(`${color.yellow}--sort <ram|name|threads>${color.reset}   Sort per-server view by RAM, filename, or thread count`);
        help.push(`${color.yellow}--group${color.reset}                     Group scripts by filename (per-server view only)`);
        help.push(`${color.yellow}--bar-width <int>${color.reset}           Adjust the width of the RAM usage bar`);
        help.push(`${color.yellow}--help${color.reset}                      Show this help message`);
        help.push("");
        help.push(`${color.white}Examples:${color.reset}`);
        help.push(`${color.gray}run active-scripts.js --server all --sort-mode alpha${color.reset}`);
        help.push(`${color.gray}run active-scripts.js --server n00dles --sort threads --group${color.reset}`);
        help.push("");
        ns.tprint(help.join("\n"));
        return;
    }
    function stripAnsi(str) {
        return str.replace(/\u001b\[[0-9;]*m/g, '');
    }
    function pad(str, width, right = false) {
        const rawLength = stripAnsi(str).length;
        const padLength = Math.max(width - rawLength, 0);
        const padding = " ".repeat(padLength);
        return right ? padding + str : str + padding;
    }
    function ramBar(percent, width = 30) {
        let fillColor = color.white;
        if (percent === 0)
            fillColor = color.white;
        else if (percent < 40)
            fillColor = color.red;
        else if (percent < 80)
            fillColor = color.yellow;
        else
            fillColor = color.green;
        const filled = Math.round((percent / 100) * width);
        const empty = width - filled;
        return (color.white + "[" +
            fillColor + "█".repeat(filled) +
            color.black + " ".repeat(empty) +
            color.white + "]" +
            color.reset);
    }
    function formatGB(num) {
        return `${num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
    }
    function colorPercent(p) {
        if (p === 0)
            return color.gray + `${p.toFixed(1)}%` + color.reset;
        if (p < 40)
            return color.red + `${p.toFixed(1)}%` + color.reset;
        if (p < 80)
            return color.yellow + `${p.toFixed(1)}%` + color.reset;
        return color.green + `${p.toFixed(1)}%` + color.reset;
    }
    function colorServerName(name, percent) {
        percent = Math.min(Math.max(percent, 0), 100);
        let colorize;
        if (percent === 0 || percent >= 100)
            colorize = color.white;
        else if (percent < 40)
            colorize = color.red;
        else if (percent < 80)
            colorize = color.yellow;
        else
            colorize = color.white;
        return colorize + name + color.reset;
    }
    function highlightFilename(path, width = 28, percent = 100) {
        const parts = path.split("/");
        const filename = parts.pop();
        const dir = parts.length ? parts.join("/") + "/" : "";
        const nameOnly = filename.replace(/\.js$/, "");
        let colorize = color.white;
        if (percent < 40)
            colorize = color.red;
        else if (percent < 80)
            colorize = color.yellow;
        return pad(color.red + dir + colorize + nameOnly + color.red + "." + colorize + "js" + color.reset, width);
    }
    function scanAllServers() {
        const seen = new Set();
        const queue = ["home"];
        const results = [];
        while (queue.length > 0) {
            const current = queue.pop();
            if (seen.has(current))
                continue;
            seen.add(current);
            results.push(current);
            for (const neighbor of ns.scan(current)) {
                if (!seen.has(neighbor))
                    queue.push(neighbor);
            }
        }
        return results;
    }
    if (hostname === "all") {
        const allServers = scanAllServers();
        const servers = allServers.filter(s => ns.hasRootAccess(s) &&
            ns.getServerMaxRam(s) > 0 &&
            ns.ps(s).length > 0);
        const data = servers.map(s => {
            const ramUsed = ns.getServerUsedRam(s);
            const ramMax = ns.getServerMaxRam(s);
            const threads = ns.ps(s).reduce((sum, p) => sum + p.threads, 0);
            return {
                name: s,
                threads,
                ramUsed,
                ramMax,
                percent: ramMax > 0 ? (ramUsed / ramMax) * 100 : 0
            };
        });
        const sortMode = args["sort-mode"];
        if (sortMode === "alpha") {
            data.sort((a, b) => a.name.localeCompare(b.name));
        }
        else if (sortMode === "threads") {
            data.sort((a, b) => b.threads - a.threads);
        }
        else {
            data.sort((a, b) => b.percent - a.percent);
        }
        const buffer = [];
        buffer.push("\n");
        buffer.push(`${color.white}ACTIVE SCRIPTS ACROSS ALL SERVERS (${data.length} SHOWN):${color.reset}\n`);
        buffer.push(color.white + pad("Server", 20) +
            color.yellow + pad("Threads", 9, true) +
            color.gray + pad("Max RAM", 13, true) +
            color.green + pad("Used RAM", 13, true) +
            color.white + pad("RAM %", 7, true) +
            " " + pad("Usage", barWidth + 2) + color.reset);
        buffer.push(color.gray + "-".repeat(20 + 9 + 13 + 13 + 7 + 1 + barWidth + 2) + color.reset);
        for (const entry of data) {
            buffer.push(pad(colorServerName(entry.name.slice(0, 20), entry.percent), 20) +
                color.yellow + pad(entry.threads.toLocaleString(), 9, true) +
                color.gray + pad(formatGB(entry.ramMax), 13, true) +
                color.green + pad(formatGB(entry.ramUsed), 13, true) +
                pad(colorPercent(entry.percent), 7, true) +
                " " + ramBar(entry.percent, barWidth));
        }
        buffer.push("");
        ns.tprint(buffer.join("\n"));
        return;
    }
    const ps = ns.ps(hostname);
    if (!ps.length) {
        ns.tprint(`${color.yellow}No active scripts on ${hostname}.${color.reset}`);
        return;
    }
    let data;
    if (args.group) {
        const grouped = {};
        for (const proc of ps) {
            const ram = ns.getScriptRam(proc.filename, hostname);
            if (!grouped[proc.filename]) {
                grouped[proc.filename] = {
                    filename: proc.filename,
                    threads: 0,
                    ramPerThread: ram,
                    totalRam: 0
                };
            }
            grouped[proc.filename].threads += proc.threads;
            grouped[proc.filename].totalRam += ram * proc.threads;
        }
        data = Object.values(grouped);
    }
    else {
        data = ps.map(proc => {
            const ram = ns.getScriptRam(proc.filename, hostname);
            return {
                filename: proc.filename,
                threads: proc.threads,
                ramPerThread: ram,
                totalRam: ram * proc.threads
            };
        });
    }
    const sortFn = {
        ram: (a, b) => b.totalRam - a.totalRam,
        threads: (a, b) => b.threads - a.threads,
        name: (a, b) => a.filename.localeCompare(b.filename)
    }[args.sort] || ((a, b) => b.totalRam - a.totalRam);
    data.sort(sortFn);
    const maxRam = Math.max(...data.map(d => d.totalRam), 1);
    const buffer = [];
    buffer.push("");
    buffer.push(`${color.white}ACTIVE SCRIPTS ON ${hostname.toUpperCase()}:${color.reset}\n`);
    buffer.push(color.white + pad("Script", 28) +
        color.yellow + pad("Threads", 9, true) +
        color.gray + pad("RAM/Thread", 12, true) +
        color.green + pad("RAM %", 7, true) +
        " " + pad("Usage", barWidth + 2) +
        " " + color.gray + "Used / Max" + color.reset);
    buffer.push(color.gray + "-".repeat(28 + 9 + 12 + 7 + 1 + barWidth + 2 + 15) + color.reset);
    for (const proc of data) {
        const percent = (proc.totalRam / maxRam) * 100;
        const used = proc.totalRam.toFixed(1);
        const total = maxRam.toFixed(1);
        buffer.push(highlightFilename(proc.filename, 28, percent) +
            color.yellow + pad(proc.threads.toLocaleString(), 9, true) +
            color.gray + pad(proc.ramPerThread.toFixed(2) + " GB", 12, true) +
            color.green + pad(percent.toFixed(1) + "%", 7, true) +
            " " + ramBar(percent, barWidth) +
            " " + color.gray + `${used} / ${total} GB` + color.reset);
    }
    ns.tprint("\n" + buffer.join("\n"));
}
