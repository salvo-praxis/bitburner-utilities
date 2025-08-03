/**
 * system.js
 * PRAAXIS_ALPHA-style Home/system stats, with color table.
 * v1.1 | 2025-07-27 | SALVO PRAXIS | PRAAXIS_ALPHA
 *
 * Usage: run system.js
 */

/** @param {NS} ns **/
export async function main(ns) {
    // Color scheme (same as other scripts)
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

    // Gather stats
    const player = ns.getPlayer();
    const home = ns.getServer("home");

    // Robust player name for all Bitburner versions
    const playerName = player.name || player.alias || "???";

    // Port programs (manual or purchased)
    const portProgs = [
        "BruteSSH.exe",
        "FTPCrack.exe",
        "relaySMTP.exe",
        "HTTPWorm.exe",
        "SQLInject.exe"
    ];

    // Only use player.tor to check Tor Router ownership (see discussion)
    const hasTor = ns.serverExists("darkweb");

    // Table rows
    const specs = [
        { label: c.cyan + "Player" + c.reset,      value: c.white + playerName + c.reset },
        { label: c.cyan + "BitNode" + c.reset,     value: c.yellow + ns.getResetInfo().currentNode + c.reset },
        { label: c.cyan + "Money" + c.reset,       value: c.green + "$" + ns.formatNumber(player.money) + c.reset },
        { label: c.cyan + "Hack Level" + c.reset,  value: c.yellow + player.skills.hacking + c.reset },
        { label: c.cyan + "Home RAM" + c.reset,    value: c.magenta + home.maxRam + " GB" + c.reset },
        { label: c.cyan + "Home Cores" + c.reset,  value: c.magenta + home.cpuCores + c.reset },
        { label: c.cyan + "Home Used RAM" + c.reset, value: c.yellow + home.ramUsed.toFixed(2) + " GB" + c.reset },
        { label: c.cyan + "Home Scripts" + c.reset, value: c.white + ns.ps("home").length + c.reset },
        { label: c.cyan + "Tor Router" + c.reset,  value: hasTor ? c.green + "Yes" + c.reset : c.red + "No" + c.reset },
        { label: c.cyan + "Formulas.exe" + c.reset, value: ns.fileExists("Formulas.exe", "home") ? c.green + "Yes" + c.reset : c.red + "No" + c.reset },
        { label: c.cyan + "Port Programs" + c.reset, value: portProgs.map(prog => ns.fileExists(prog, "home") ? c.green + "✓" + c.reset : c.red + "✗" + c.reset).join(" ") }
    ];

    // Print summary table (neuroflux style)
    printTable(
        "HOME SYSTEM SPECS",
        [
            { name: "Stat", width: 18 },
            { name: "Value", width: 28 }
        ],
        specs.map(row => ({
            Stat: row.label,
            Value: row.value
        })),
        c,
        ns
    );
}

// Table printer (color-safe width, as in neuroflux.js)
function printTable(title, columns, rows, color, ns) {
    ns.tprint('\n');
    const RED = color.red, WHITE = color.white, RESET = color.reset;

    function stripColors(str) {
        return str.replace(/\u001b\[\d+m/g, '').replace(/\u001b\[1m/g, '');
    }

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
    let headers = RED + '║' + columns.map((col, i) =>
        ' ' + WHITE + pad(col.name, col.width, false) + RED + ' '
    ).join('║') + '║';
    let rowsep = RED + '╠';
    colWidths.forEach((w, i) => {
        rowsep += '═'.repeat(w);
        rowsep += (i < colWidths.length - 1) ? '╬' : '╣';
    });
    let datarows = rows.map(row =>
        RED + '║' + columns.map((col, idx) => {
            let val = row[col.name];
            let padLen = col.width - stripColors(val).length;
            return ' ' + val + ' '.repeat(padLen) + RED + ' ';
        }).join('║') + '║'
    );
    let bottom = RED + '╚';
    colWidths.forEach((w, i) => {
        bottom += '═'.repeat(w);
        bottom += (i < colWidths.length - 1) ? '╩' : '╝';
    });
    let out = ['\n', top, titleLine, header, headers, rowsep, ...datarows, bottom].join('\n') + RESET;
    ns.tprint(out);
}
function padCenter(str, width) {
    let pad = width - str.length;
    let left = Math.floor(pad / 2);
    let right = pad - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
}
function pad(str, width, right = false) {
    const stripColors = s => s.replace(/\u001b\[\d+m/g, '').replace(/\u001b\[1m/g, '');
    let len = stripColors(str).length;
    if (len >= width) return str;
    let padLen = width - len;
    return right ? str + ' '.repeat(padLen) : str + ' '.repeat(padLen);
}
