/** @param {NS} ns **/
export async function main(ns) {
    const host      = ns.getHostname();
    const { maxRam, ramUsed } = ns.getServer(host);
    const availRam  = maxRam - ramUsed;

    // ANSI palette & styles
    const C = {
        reset: "\u001b[0m",
        bold:  "\u001b[1m",
        cyan:  "\u001b[36m",
        white: "\u001b[37m",
        yellow:"\u001b[33m",
        green: "\u001b[32m",
        red:   "\u001b[31m",
        gray:  "\u001b[90m",
    };

    // Determine this script's folder (e.g. "scripts/")
    const me  = ns.getScriptName();
    const dir = me.includes("/") ? me.slice(0, me.lastIndexOf("/") + 1) : "";
    const displayDir = dir ? dir.slice(0, -1) : "/";

    // List only immediate files
    const all   = ns.ls("home", dir);
    const files = all
        .filter(f => {
            const rest = f.slice(dir.length);
            return rest && !rest.includes("/");
        })
        .sort();

    // Build rows of {name, size, ram}
    const rows = files.map(path => {
        const name   = path.slice(dir.length);
        const txt    = ns.read(path) || "";
        const ramReq = ns.getScriptRam(path, host);
        return { name, size: txt.length, ram: ramReq };
    });

    // Base column widths
    const nameW = Math.max(4, ...rows.map(r => r.name.length)) + 2;
    const sizeW = Math.max(4, ...rows.map(r => r.size.toString().length)) + 2;
    const ramW  = Math.max(3, ...rows.map(r => r.ram.toFixed(2).length)) + 2;

    // Scale columns by ~1.75×
    const scale      = 1.75;
    const nameWidth  = Math.floor(nameW * scale);
    const sizeWidth  = Math.floor(sizeW * scale);
    const ramWidth   = Math.floor(ramW * scale);

    // Buffer everything
    const buf = [];
    buf.push("");            // blank line #1
    buf.push("");            // blank line #2
    buf.push(                // pserv.js‑style title
        C.bold + C.cyan +
        `=== Directory Listing: ${displayDir} ===` +
        C.reset
    );
    buf.push("");            // one more break before table

    // ALL‑CAPS header
    buf.push(
        C.bold + C.white +
        "NAME".padEnd(nameWidth) +
        "SIZE".padEnd(sizeWidth) +
        "RAM".padEnd(ramWidth) +
        C.reset
    );
    // separator line
    buf.push(
        C.gray +
        "-".repeat(nameWidth) +
        "-".repeat(sizeWidth) +
        "-".repeat(ramWidth) +
        C.reset
    );

    // Data rows
    for (const r of rows) {
        let ramColor;
        if (r.ram <= availRam) {
            ramColor = C.green;    // fits now
        } else {
            ramColor = (r.ram / maxRam) > 0.5
                       ? C.yellow   // heavy script
                       : C.red;     // small but no room
        }
        buf.push(
            C.white + r.name.padEnd(nameWidth) + C.reset +
            C.yellow + r.size.toString().padEnd(sizeWidth) + C.reset +
            ramColor + r.ram.toFixed(2).padEnd(ramWidth) + C.reset
        );
    }

    // Single, non‑breaking print
    ns.tprint(buf.join("\n"));
}
