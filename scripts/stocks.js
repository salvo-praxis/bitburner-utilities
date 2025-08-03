/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    const symbols = ns.stock.getSymbols();
    const minCash = 1e12; // Keep $1T cash reserve for augs
    const tradeFee = 100000; // $100k per trade
    const maxPosition = 0.02; // Max 2% of cash per stock
    const buyThreshold = 0.57; // Buy if forecast > 57%
    const sellThreshold = 0.47; // Sell if forecast < 47%
    const profitTarget = 1.1; // Sell if 10% profit
    const stopLoss = 0.97; // Sell if 3% loss
    const maxVolatility = 0.03; // Avoid >3% volatility
    const minPrice = 1000; // Avoid stocks under $1k

    while (true) {
        const cash = ns.getPlayer().money;
        if (cash < minCash) {
            ns.print("Low cash, waiting...");
            await ns.sleep(30000);
            continue;
        }

        for (const sym of symbols) {
            const forecast = ns.stock.getForecast(sym);
            const volatility = ns.stock.getVolatility(sym);
            const price = ns.stock.getPrice(sym);
            const maxShares = ns.stock.getMaxShares(sym);
            const position = ns.stock.getPosition(sym); // [longShares, longPrice, shortShares, shortPrice]
            const longShares = position[0];
            const longPrice = position[1];

            // Skip undesirable stocks
            if (volatility > maxVolatility || price < minPrice) continue;

            // Calculate affordable shares (max 2% of cash)
            const affordableShares = Math.floor((cash * maxPosition) / price);
            const tradeShares = Math.min(maxShares * 0.05, affordableShares);

            // Buy long position
            if (forecast > buyThreshold && longShares === 0 && tradeShares > 0 && cash > price * tradeShares + tradeFee) {
                const cost = ns.stock.buyStock(sym, tradeShares);
                if (cost > 0) {
                    ns.print(`Bought ${tradeShares} shares of ${sym} at $${price.toFixed(2)} (forecast: ${(forecast * 100).toFixed(1)}%, vol: ${(volatility * 100).toFixed(1)}%)`);
                }
            }

            // Sell long position
            if (longShares > 0) {
                const priceRatio = price / longPrice;
                if (forecast < sellThreshold || priceRatio >= profitTarget || priceRatio <= stopLoss) {
                    const profit = ns.stock.sellStock(sym, longShares);
                    if (profit > 0) {
                        const gainLoss = ((price - longPrice) * longShares - 2 * tradeFee).toFixed(2);
                        ns.print(`Sold ${longShares} shares of ${sym} at $${price.toFixed(2)} (forecast: ${(forecast * 100).toFixed(1)}%, vol: ${(volatility * 100).toFixed(1)}%), net: $${gainLoss}`);
                    }
                }
            }
        }

        // Log portfolio value
        let portfolioValue = cash;
        for (const sym of symbols) {
            const [longShares,,,] = ns.stock.getPosition(sym);
            const price = ns.stock.getPrice(sym);
            portfolioValue += longShares * price;
        }
        ns.print(`Portfolio: $${portfolioValue.toFixed(2)} | Cash: $${cash.toFixed(2)}`);

        await ns.sleep(30000); // Check every 30 seconds
    }
}