/** @param {NS} ns **/
export async function main(ns) {
    // Usage/help message
    const usage = `
Usage: run hacknet-manager.js [--reserve N] [--roi N] [--interval N] [--help]

- Automatically purchases and upgrades Hacknet nodes ONLY when it's profitable.
- Optimizes for fastest payback (lowest ROI) without spending all your cash.
- Prints upgrades to terminal/tail.

Options:
  --reserve   N   Minimum $ to keep in your bank (default: 1e6)
  --roi       N   Max payback time in seconds (default: 3600 for 1 hour)
  --interval  N   How often to check, in seconds (default: 10)
  --help          Show this help message

Examples:
  run hacknet-manager.js --reserve 2e6 --roi 1800 --interval 5
  run hacknet-manager.js --help
    `.trim();
    // Parse flags
    const args = ns.flags([
        ["reserve", 1e6],
        ["roi", 3600],
        ["interval", 10],
        ["help", false],
    ]);
    if (args.help) {
        ns.tprint(usage);
        return;
    }
    const reserve = args.reserve;
    const minROI = args.roi;
    const interval = args.interval;
    ns.tprint(`[Hacknet Manager] Reserve: $${reserve.toLocaleString()}, ROI < ${minROI}s, Interval: ${interval}s`);
    while (true) {
        let action = null;
        let bestPayback = Infinity;
        let playerMoney = ns.getServerMoneyAvailable("home");
        // Check node purchase
        let nNodes = ns.hacknet.numNodes();
        let nodeCost = ns.hacknet.getPurchaseNodeCost();
        if (playerMoney - nodeCost >= reserve) {
            // Estimate income gain: use average node production
            let avgProd = 0;
            if (nNodes > 0) {
                let totalProd = 0;
                for (let i = 0; i < nNodes; ++i)
                    totalProd += ns.hacknet.getNodeStats(i).production;
                avgProd = totalProd / nNodes;
            }
            else {
                avgProd = 1; // Very first node, some default
            }
            let payback = nodeCost / Math.max(avgProd, 1);
            if (payback < bestPayback && payback < minROI) {
                bestPayback = payback;
                action = { type: "buyNode", payback, cost: nodeCost };
            }
        }
        // Check upgrades for all nodes
        for (let i = 0; i < nNodes; ++i) {
            let stats = ns.hacknet.getNodeStats(i);
            // Next Level
            let lvlCost = ns.hacknet.getLevelUpgradeCost(i, 1);
            if (playerMoney - lvlCost >= reserve && lvlCost !== Infinity) {
                let gain = ns.hacknet.getNodeStats(i).production * 0.01; // Estimate: each level ~1%
                let payback = lvlCost / Math.max(gain, 0.001);
                if (payback < bestPayback && payback < minROI) {
                    bestPayback = payback;
                    action = { type: "upgradeLevel", i, payback, cost: lvlCost };
                }
            }
            // Next RAM
            let ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
            if (playerMoney - ramCost >= reserve && ramCost !== Infinity) {
                let gain = ns.hacknet.getNodeStats(i).production * 0.4;
                let payback = ramCost / Math.max(gain, 0.001);
                if (payback < bestPayback && payback < minROI) {
                    bestPayback = payback;
                    action = { type: "upgradeRam", i, payback, cost: ramCost };
                }
            }
            // Next Core
            let coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
            if (playerMoney - coreCost >= reserve && coreCost !== Infinity) {
                let gain = ns.hacknet.getNodeStats(i).production * 0.15;
                let payback = coreCost / Math.max(gain, 0.001);
                if (payback < bestPayback && payback < minROI) {
                    bestPayback = payback;
                    action = { type: "upgradeCore", i, payback, cost: coreCost };
                }
            }
        }
        // Execute the best action found, or sleep if nothing good
        if (action) {
            switch (action.type) {
                case "buyNode":
                    ns.hacknet.purchaseNode();
                    ns.tprint(`[Hacknet] Purchased node for $${action.cost.toLocaleString()} (payback: ${action.payback.toFixed(1)}s)`);
                    break;
                case "upgradeLevel":
                    ns.hacknet.upgradeLevel(action.i, 1);
                    ns.tprint(`[Hacknet] Upgraded node #${action.i} level for $${action.cost.toLocaleString()} (payback: ${action.payback.toFixed(1)}s)`);
                    break;
                case "upgradeRam":
                    ns.hacknet.upgradeRam(action.i, 1);
                    ns.tprint(`[Hacknet] Upgraded node #${action.i} RAM for $${action.cost.toLocaleString()} (payback: ${action.payback.toFixed(1)}s)`);
                    break;
                case "upgradeCore":
                    ns.hacknet.upgradeCore(action.i, 1);
                    ns.tprint(`[Hacknet] Upgraded node #${action.i} core for $${action.cost.toLocaleString()} (payback: ${action.payback.toFixed(1)}s)`);
                    break;
            }
        }
        else {
            ns.print(`[Hacknet] No upgrades under ROI < ${minROI}s; waiting...`);
        }
        await ns.sleep(interval * 1000);
    }
}
