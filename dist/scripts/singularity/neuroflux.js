/**
 * neuroflux.js
 * Max NeuroFlux Governor purchases from all eligible factions, color-precise.
 * Perfect log and table formatting, DRY RUN supported.
 * v2.2 | 2025-07-23 | SALVO PRAXIS | PRAAXIS_ALPHA
 */
/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([["dry-run", false]]);
    const NFG = "NeuroFlux Governor";
    const player = ns.getPlayer();
    const factions = player.factions.filter(f => ns.singularity.getAugmentationsFromFaction(f).includes(NFG));
    if (!factions.length) {
        ns.tprint("\u001b[31m[\u001b[1m\u001b[37mneuroflux.js\u001b[0m\u001b[31m]\u001b[0m \u001b[37mNo eligible factions found (must be a member and NFG must be available).\u001b[0m");
        return;
    }
    // Color helper (includes bold)
    const c = {
        reset: "\u001b[0m",
        bold: "\u001b[1m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        cyan: "\u001b[36m",
        red: "\u001b[31m",
        magenta: "\u001b[35m",
        white: "\u001b[37m"
    };
    let purchases = []; // {faction, nfgNum, price, rep}
    let factionPurchases = {}; // {faction: [purchase, ...]}
    let totalSpent = 0;
    let nfgBought = 0;
    let n = ns.singularity.getOwnedAugmentations(true).filter(a => a === NFG).length;
    let origMoney = ns.getPlayer().money;
    function getNFGPrice(n) { return ns.singularity.getAugmentationPrice(NFG) * Math.pow(1.14, n); }
    function getNFGRep(n) { return ns.singularity.getAugmentationRepReq(NFG) * Math.pow(1.14, n); }
    // Main loop: try *every* eligible faction for *every* possible NFG, repeat until no more money or rep
    while (true) {
        let boughtThisRound = false;
        for (let f of factions) {
            let price = getNFGPrice(n);
            let rep = getNFGRep(n);
            let factionRep = ns.singularity.getFactionRep(f);
            if (ns.getPlayer().money >= price && factionRep >= rep) {
                if (!args["dry-run"]) {
                    let ok = await ns.singularity.purchaseAugmentation(f, NFG);
                    if (!ok)
                        continue; // Defensive: only log if actually bought
                }
                purchases.push({ faction: f, nfgNum: n + 1, price, rep });
                if (!factionPurchases[f])
                    factionPurchases[f] = [];
                factionPurchases[f].push({ nfgNum: n + 1, price, rep });
                totalSpent += price;
                nfgBought += 1;
                // LOG OUTPUT: all brackets/colons/commas/parentheses red, filename bold white, Purchased text white, rest as specified
                ns.tprint(`${c.red}[${c.bold}${c.white}neuroflux.js${c.reset}${c.red}]${c.reset} ` +
                    `${c.white}Purchased NFG #${n + 1} from ${c.white}${f}${c.reset} ${c.red}(${c.reset}` +
                    `${c.yellow}Cost${c.red}:${c.reset} ${c.white}${ns.formatNumber(price)}${c.reset}${c.red},${c.reset} ` +
                    `${c.yellow}Rep${c.red}:${c.reset} ${c.white}${ns.formatNumber(rep)}${c.reset}${c.red})${c.reset}`);
                n++;
                boughtThisRound = true;
                if (!args["dry-run"])
                    await ns.sleep(80); // Yield for UI stability
            }
        }
        if (!boughtThisRound)
            break; // None purchased in this round, stop.
    }
    // Calculate remaining money and rep for each faction
    let remMoney = ns.getPlayer().money;
    let summaryRows = factions.map(f => {
        let usedRep = (factionPurchases[f] || []).reduce((sum, p) => sum + p.rep, 0);
        let nfgs = (factionPurchases[f] || []).length;
        let repLeft = ns.singularity.getFactionRep(f) - usedRep;
        return {
            Faction: c.white + f + c.reset,
            Bought: c.white + nfgs + c.reset,
            Spent: nfgs > 0 ? c.white + ns.formatNumber((factionPurchases[f] || []).reduce((s, p) => s + p.price, 0)) + c.reset : c.red + "0" + c.reset,
            "Rep Left": c.white + ns.formatNumber(repLeft) + c.reset,
        };
    });
    // Colorized summary table (alignment/padding fixed to match int-farmer style)
    printTable("NeuroFlux Governor Purchases", [
        { name: "Faction", width: 20 },
        { name: "Bought", width: 6 },
        { name: "Spent", width: 18 },
        { name: "Rep Left", width: 13 }
    ], summaryRows, c, ns);
    // Totals line
    ns.tprint(`${c.red}[${c.bold}${c.white}neuroflux.js${c.reset}${c.red}]${c.reset} ` +
        `${c.white}Purchased total${c.red}:${c.reset} ${c.bold}${nfgBought}${c.reset}${c.white} NFGs${c.red},${c.reset} ` +
        `${c.white}Spent${c.red}:${c.reset} ${c.bold}${ns.formatNumber(totalSpent)}${c.reset}${c.white}${c.red},${c.reset} ` +
        `${c.white}Money Left${c.red}:${c.reset} ${c.bold}${ns.formatNumber(remMoney)}${c.reset}`);
    if (!nfgBought) {
        ns.tprint(`${c.red}[${c.bold}${c.white}neuroflux.js${c.reset}${c.red}]${c.reset} ${c.white}No NeuroFlux Governors purchased. Check available rep and money.${c.reset}`);
    }
    if (args["dry-run"]) {
        ns.tprint(`${c.red}[${c.bold}${c.white}neuroflux.js${c.reset}${c.red}]${c.reset} ` +
            `${c.yellow}This was a DRY RUN. No purchases were made.${c.reset}`);
    }
}
// Table printer with color-safe width (handles color codes in value padding)
function printTable(title, columns, rows, color, ns) {
    ns.tprint('\n');
    const RED = color.red, WHITE = color.white, RESET = color.reset;
    function stripColors(str) {
        // Remove ANSI escape codes for accurate width measurement
        return str.replace(/\u001b\[\d+m/g, '').replace(/\u001b\[1m/g, '');
    }
    // Determine max content width for each column (accounting for color codes)
    columns = columns.map((col, idx) => {
        let widest = stripColors(col.name).length;
        rows.forEach(row => {
            widest = Math.max(widest, stripColors(row[col.name]).length);
        });
        return { ...col, width: widest };
    });
    let colWidths = columns.map(col => col.width + 2);
    let totalWidth = colWidths.reduce((a, b) => a + b, 0) + columns.length + 1;
    let top = RED + '╔' + '═'.repeat(totalWidth - 2) + '╗';
    let titleLine = RED + '║' + WHITE + padCenter(title, totalWidth - 2) + RED + '║';
    let header = RED + '╠';
    colWidths.forEach((w, i) => {
        header += '═'.repeat(w);
        header += (i < colWidths.length - 1) ? '╦' : '╣';
    });
    let headers = RED + '║' + columns.map((col, i) => ' ' + WHITE + pad(col.name, col.width, false) + RED + ' ').join('║') + '║';
    let rowsep = RED + '╠';
    colWidths.forEach((w, i) => {
        rowsep += '═'.repeat(w);
        rowsep += (i < colWidths.length - 1) ? '╬' : '╣';
    });
    let datarows = rows.map(row => RED + '║' + columns.map((col, idx) => {
        let val = row[col.name];
        // Color-safe padding: pad *stripped* value, then insert colorized value in
        let padLen = col.width - stripColors(val).length;
        return ' ' + val + ' '.repeat(padLen) + RED + ' ';
    }).join('║') + '║');
    let bottom = RED + '╚';
    colWidths.forEach((w, i) => {
        bottom += '═'.repeat(w);
        bottom += (i < colWidths.length - 1) ? '╩' : '╝';
    });
    let out = ['\n', top, titleLine, header, headers, rowsep, ...datarows, bottom].join('\n') + RESET;
    ns.tprint(out);
}
// Helper for string centering/padding
function padCenter(str, width) {
    let pad = width - str.length;
    let left = Math.floor(pad / 2);
    let right = pad - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
}
function pad(str, width, right = false) {
    const stripColors = s => s.replace(/\u001b\[\d+m/g, '').replace(/\u001b\[1m/g, '');
    let len = stripColors(str).length;
    if (len >= width)
        return str;
    let padLen = width - len;
    return right ? str + ' '.repeat(padLen) : str + ' '.repeat(padLen);
}
