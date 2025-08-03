/** @param {NS} ns **/
export async function main(ns) {
    // COLOR CODES
    const color = {
        reset: "\u001b[0m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        red: "\u001b[31m",
        cyan: "\u001b[36m",
        magenta: "\u001b[35m",
        gray: "\u001b[90m",
        white: "\u001b[37m"
    };
    function pad(str, w, r = false) {
        str = String(str);
        let strRaw = str.replace(/\u001b\[[0-9;]*m/g, '');
        if (strRaw.length > w)
            return strRaw.slice(0, w - 2) + "… ";
        let padding = " ".repeat(w - strRaw.length);
        return r ? padding + str : str + padding;
    }
    // RAM SIZES
    const options = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 65536, 131072, 262144, 524288, 1048576];
    const ramLabel = n => n >= 1048576 ? "1 PB" : n >= 1024 ? `${n / 1024} TB` : `${n} GB`;
    const args = ns.flags([
        ["mode", "list"],
        ["size", 0],
        ["count", 25],
        ["start", 0],
        ["from", 1],
        ["to", 25],
        ["help", false]
    ]);
    const limit = ns.getPurchasedServerLimit();
    const owned = ns.getPurchasedServers();
    const money = ns.getServerMoneyAvailable("home");
    let out = [];
    // Formatters
    const fmtMoney = val => "$" + ns.formatNumber(val, 2);
    if (args.help) {
        ns.tprint(color.cyan + "pserv.js -- Bitburner Personal Server Utility\n" + color.reset +
            "\n" +
            color.yellow + "Usage:\n" + color.reset +
            " " + color.cyan + "--mode list" + color.reset + "       List RAM sizes, prices, totals, owned servers\n" +
            " " + color.cyan + "--mode buy --size <index|ram> --count <n> [--start <#>]" + color.reset + "   Buy N servers (size=index or RAM)\n" +
            " " + color.cyan + "--mode sell [--size <ram>] [--count <n>]" + color.reset + "   Sell N servers, optionally only of a certain RAM size\n" +
            " " + color.cyan + "--mode status" + color.reset + "     Show all owned servers, RAM, usage, scripts\n" +
            "\n" +
            color.yellow + "Tip: Use the Idx number from --mode list as the --size parameter for --mode buy.\n" + color.reset +
            "\nExamples:\n" +
            "  run pserv.js --mode list\n" +
            "  run pserv.js --mode buy --size 4 --count 10    # buys 10 servers of 128 GB\n" +
            "  run pserv.js --mode buy --size 128 --count 2   # buys 2 servers of 128 GB\n" +
            "  run pserv.js --mode sell --count 10            # sells 10 servers (any)\n" +
            "  run pserv.js --mode sell --size 1024           # sells all servers with 1 TB RAM\n" +
            "  run pserv.js --mode status\n");
        return;
    }
    // --- LIST MODE ---
    if (args.mode === "list") {
        out.push(color.cyan + `=== Personal Server Purchase Options (Limit ${limit}) ===` + color.reset);
        out.push(color.gray + "Available funds: " + color.green + fmtMoney(money) + color.reset);
        out.push("");
        // COLUMN WIDTHS
        const idxW = 4, sizeW = 8, priceW = 10, totPriceW = 13, pctW = 6, totRamW = 10;
        const head = [
            pad("Idx", idxW, true),
            pad("Size", sizeW),
            pad("Price", priceW, true),
            pad("Total $", totPriceW, true),
            pad("%", pctW, true),
            pad("Total RAM", totRamW, true)
        ].join(" ");
        out.push(color.cyan + head + color.reset);
        out.push(color.gray + "-".repeat(idxW + sizeW + priceW + totPriceW + pctW + totRamW + 6) + color.reset);
        // Find most affordable
        let bestIdx = 0;
        let bestPct = 0;
        for (let i = 0; i < options.length; ++i) {
            const r = options[i];
            const priceAll = ns.getPurchasedServerCost(r) * 25;
            const rawPct = Math.floor((money / priceAll) * 100);
            if (rawPct > bestPct) {
                bestPct = rawPct;
                bestIdx = i;
            }
        }
        for (let i = 0; i < options.length; ++i) {
            const r = options[i];
            const price = ns.getPurchasedServerCost(r);
            const priceAll = price * 25;
            // CAP DISPLAY AT 100%
            const rawPct = Math.floor((money / priceAll) * 100);
            const pct = rawPct;
            const disp = Math.min(rawPct, 100);
            let c = pct >= 100 ? color.green
                : pct >= 25 ? color.yellow
                    : color.red;
            let ramAmt = r * 25; // GB
            let ramStr = ramAmt >= 1048576 ? color.cyan + (ramAmt / 1048576).toFixed(2) + " PB" + color.reset :
                ramAmt >= 1024 ? color.cyan + (ramAmt / 1024).toFixed(2) + " TB" + color.reset :
                    color.cyan + ramAmt + " GB" + color.reset;
            out.push(pad(color.yellow + (i + 1) + color.reset, idxW, true) + " " +
                pad(color.cyan + ramLabel(r) + color.reset, sizeW) +
                pad(color.green + fmtMoney(price) + color.reset, priceW, true) +
                pad(color.green + fmtMoney(priceAll) + color.reset, totPriceW, true) +
                pad(c + disp + "%" + color.reset, pctW, true) +
                pad(ramStr, totRamW, true));
        }
        out.push("");
        out.push(color.cyan + "Owned servers:" + color.reset + ` (${owned.length}/${limit})`);
        if (owned.length > 0) {
            for (let s of owned) {
                let ram = ns.getServerMaxRam(s);
                let used = ns.getServerUsedRam(s);
                out.push("  " + color.green + s + color.reset +
                    ` (${ramLabel(ram)}, ${used.toFixed(1)}/${ramLabel(ram)} used)`);
            }
        }
        else {
            out.push(color.gray + "  (None yet)" + color.reset);
        }
        out.push("");
        out.push(color.yellow + "Tip: Use Idx from the list as --size when buying servers." + color.reset);
        ns.tprint("\n" + out.join("\n"));
        return;
    }
    // --- STATUS MODE ---
    if (args.mode === "status") {
        out.push(color.cyan + `=== Personal Server Status (${owned.length}/${limit}) ===` + color.reset);
        if (owned.length === 0)
            out.push(color.gray + "You don't own any servers." + color.reset);
        else {
            for (let s of owned) {
                let ram = ns.getServerMaxRam(s);
                let used = ns.getServerUsedRam(s);
                let procs = ns.ps(s);
                out.push(color.green + pad(s, 22) + color.reset +
                    pad(ramLabel(ram), 8) +
                    color.yellow + pad(used.toFixed(1), 6, true) + color.reset + "/" +
                    pad(ramLabel(ram), 8) +
                    (procs.length > 0 ? color.magenta + `  ${procs.length} proc(s)` + color.reset : ""));
            }
        }
        ns.tprint("\n" + out.join("\n"));
        return;
    }
    // --- BUY MODE ---
    if (args.mode === "buy") {
        let sizeArg = args.size;
        let size;
        if (!isNaN(sizeArg) && sizeArg >= 1 && sizeArg <= options.length) {
            size = options[sizeArg - 1];
        }
        else if (options.includes(Number(sizeArg))) {
            size = Number(sizeArg);
        }
        else {
            return ns.tprint(color.red + `Invalid size: ${sizeArg}. Use index 1-${options.length} or valid RAM.` + color.reset);
        }
        let count = parseInt(args.count);
        let startIdx = args.start ? parseInt(args.start) : undefined;
        if (isNaN(count) || count <= 0)
            return ns.tprint(color.red + `Invalid count: ${args.count}` + color.reset);
        const sizeLabel = ramLabel(size).replace(" ", "");
        const prefix = `praxis-server-${sizeLabel}-`;
        if (startIdx === undefined) {
            const existing = owned
                .filter(n => n.startsWith(prefix))
                .map(n => parseInt(n.slice(prefix.length)))
                .filter(i => !isNaN(i));
            startIdx = existing.length === 0 ? 1 : Math.max(...existing) + 1;
        }
        let slotsLeft = limit - owned.length;
        if (slotsLeft <= 0)
            return ns.tprint(color.red + `ERROR: Already own ${owned.length}/${limit} servers.` + color.reset);
        if (count > slotsLeft) {
            out.push(color.yellow + `Only ${slotsLeft} slots left; reducing count from ${count} to ${slotsLeft}.` + color.reset);
            count = slotsLeft;
        }
        let bought = 0;
        for (let i = 0; i < count; ++i) {
            const idx = startIdx + i;
            const idxStr = idx < 10 ? `0${idx}` : `${idx}`;
            const name = `${prefix}${idxStr}`;
            const price = ns.getPurchasedServerCost(size);
            if (ns.getServerMoneyAvailable("home") < price) {
                out.push(color.red + `✖ Not enough money to buy ${name} (${ramLabel(size)}). Need ${fmtMoney(price)}.` + color.reset);
                break;
            }
            ns.purchaseServer(name, size);
            out.push(color.green + `✔ Purchased ${name} (${ramLabel(size)}) for ${fmtMoney(price)}` + color.reset);
            bought++;
        }
        if (bought === 0)
            out.push(color.red + "No servers purchased." + color.reset);
        ns.tprint("\n" + out.join("\n"));
        return;
    }
    // --- SELL MODE (Fixed!) ---
    if (args.mode === "sell") {
        let size = args.size ? Number(args.size) : undefined;
        let ramFilter = undefined;
        // Allow filtering by RAM size if provided
        if (size) {
            if (!isNaN(size) && size >= 1 && size <= options.length) {
                size = options[size - 1];
            }
            ramFilter = size;
        }
        // Get all servers to delete (with optional RAM filter)
        let toDelete = owned;
        if (ramFilter !== undefined) {
            toDelete = toDelete.filter(s => ns.getServerMaxRam(s) === ramFilter);
        }
        // Honor count (default 25)
        let maxCount = Math.min(parseInt(args.count) || 25, toDelete.length);
        let count = 0, failed = 0;
        for (let i = 0; i < maxCount; ++i) {
            const name = toDelete[i];
            try {
                ns.killall(name);
                if (ns.deleteServer(name)) {
                    out.push(color.green + `✔ Deleted ${name}` + color.reset);
                    count++;
                }
                else {
                    out.push(color.red + `✖ FAILED to delete ${name}` + color.reset);
                    failed++;
                }
            }
            catch (e) {
                out.push(color.red + `✖ ERROR on ${name}: ${e}` + color.reset);
                failed++;
            }
        }
        if (count + failed === 0) {
            out.push(color.yellow + "No servers matched for deletion." + color.reset);
        }
        out.push(color.yellow + `Deleted ${count}, failed ${failed}.` + color.reset);
        ns.tprint("\n" + out.join("\n"));
        return;
    }
    ns.tprint(color.red + "Unknown or missing --mode. Use --help for usage." + color.reset);
}
