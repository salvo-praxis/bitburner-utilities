/**
 * focus-cleaner.js - Close all popups and refocus terminal
 * v1.0 | 2025-07-23 | SALVO PRAXIS | PRAAXIS_ALPHA
 * Requires: SF4 (Singularity)
 */
/** @param {NS} ns **/
export async function main(ns) {
    while (true) {
        try {
            if (ns.singularity.closeScriptEditor)
                ns.singularity.closeScriptEditor();
            if (ns.singularity.closeDevMenu)
                ns.singularity.closeDevMenu();
            if (ns.singularity.closeTerminalPopups)
                ns.singularity.closeTerminalPopups();
            if (ns.singularity.closeOtherPopups)
                ns.singularity.closeOtherPopups();
            if (ns.singularity.closeFactionsPopups)
                ns.singularity.closeFactionsPopups();
            // Focus on terminal if available (optional, won't error if unavailable)
            if (ns.singularity.focusTerminal)
                ns.singularity.focusTerminal();
        }
        catch (e) {
            // Ignore any errors due to missing API calls
        }
        await ns.sleep(2000); // Check every 2 seconds
    }
}
