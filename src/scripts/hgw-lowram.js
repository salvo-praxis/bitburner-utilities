/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    if (!target) return;
    while (true) {
        const money = ns.getServerMoneyAvailable(target);
        const maxMoney = ns.getServerMaxMoney(target);
        const security = ns.getServerSecurityLevel(target);
        const minSecurity = ns.getServerMinSecurityLevel(target);
        
        if (security > minSecurity + 0.2) {
            await ns.weaken(target);
        } else if (money < maxMoney * 0.9) {
            await ns.grow(target);
        } else {
            await ns.hack(target);
        }
        await ns.sleep(50);
    }
}