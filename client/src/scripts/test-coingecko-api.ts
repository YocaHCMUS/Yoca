/**
 * Test CoinGecko API - Get SOL Token Data
 */

const API_KEY = "CG-DEMO-API-KEY"; // Demo key có thể dùng free

async function fetchSolData() {
    const url = "https://api.coingecko.com/api/v3/coins/markets";

    const params = new URLSearchParams({
        vs_currency: "usd",
        ids: "solana",
        price_change_percentage: "1h,24h,7d",
    });

    try {
        const response = await fetch(`${url}?${params}`, {
            headers: {
                accept: "application/json",
                // "x-cg-demo-api-key": API_KEY, // Uncomment nếu có API key
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const sol = data[0];

        console.log("=".repeat(60));
        console.log("SOLANA (SOL) DATA FROM COINGECKO API");
        console.log("=".repeat(60));
        console.log();

        // TOKEN INFO
        console.log("📌 TOKEN INFORMATION");
        console.log(`ID: ${sol.id}`);
        console.log(`Symbol: ${sol.symbol.toUpperCase()}`);
        console.log(`Name: ${sol.name}`);
        console.log(`Image: ${sol.image}`);
        console.log();

        // PRICE & MARKET DATA
        console.log("💰 PRICE & MARKET DATA");
        console.log(`Current Price: $${sol.current_price.toLocaleString()}`);
        console.log(`Market Cap: $${sol.market_cap.toLocaleString()}`);
        console.log(`Market Cap Rank: #${sol.market_cap_rank}`);
        console.log(`FDV: $${sol.fully_diluted_valuation?.toLocaleString() || "N/A"}`);
        console.log();

        // SUPPLY
        console.log("📊 SUPPLY");
        console.log(`Circulating Supply: ${sol.circulating_supply?.toLocaleString()} SOL`);
        console.log(`Total Supply: ${sol.total_supply?.toLocaleString()} SOL`);
        console.log(`Max Supply: ${sol.max_supply || "Unlimited"}`);
        console.log();

        // TRADING DATA
        console.log("📈 TRADING DATA");
        console.log(`Volume 24h: $${sol.total_volume.toLocaleString()}`);
        console.log(`High 24h: $${sol.high_24h}`);
        console.log(`Low 24h: $${sol.low_24h}`);
        console.log();

        // PRICE CHANGES
        console.log("📉 PRICE CHANGES");
        console.log(`Price Change 24h: $${sol.price_change_24h?.toFixed(4)}`);
        console.log(`Price Change % 1h: ${sol.price_change_percentage_1h_in_currency?.toFixed(2)}%`);
        console.log(`Price Change % 24h: ${sol.price_change_percentage_24h?.toFixed(2)}%`);
        console.log(`Price Change % 7d: ${sol.price_change_percentage_7d_in_currency?.toFixed(2)}%`);
        console.log();

        // ALL-TIME HIGH
        console.log("🏆 ALL-TIME HIGH (ATH)");
        console.log(`ATH Price: $${sol.ath}`);
        console.log(`ATH Change %: ${sol.ath_change_percentage?.toFixed(2)}%`);
        console.log(`ATH Date: ${sol.ath_date}`);
        console.log();

        // ALL-TIME LOW
        console.log("📉 ALL-TIME LOW (ATL)");
        console.log(`ATL Price: $${sol.atl}`);
        console.log(`ATL Change %: ${sol.atl_change_percentage?.toFixed(2)}%`);
        console.log(`ATL Date: ${sol.atl_date}`);
        console.log();

        console.log(`⏰ Last Updated: ${sol.last_updated}`);
        console.log("=".repeat(60));

        // Return data for use in app
        return {
            id: sol.id,
            symbol: sol.symbol,
            name: sol.name,
            image: sol.image,
            currentPrice: sol.current_price,
            marketCap: sol.market_cap,
            marketCapRank: sol.market_cap_rank,
            fdv: sol.fully_diluted_valuation,
            totalVolume: sol.total_volume,
            high24h: sol.high_24h,
            low24h: sol.low_24h,
            priceChange24h: sol.price_change_24h,
            priceChangePercentage1h: sol.price_change_percentage_1h_in_currency,
            priceChangePercentage24h: sol.price_change_percentage_24h,
            priceChangePercentage7d: sol.price_change_percentage_7d_in_currency,
            circulatingSupply: sol.circulating_supply,
            totalSupply: sol.total_supply,
            maxSupply: sol.max_supply,
            ath: sol.ath,
            athChangePercentage: sol.ath_change_percentage,
            athDate: sol.ath_date,
            atl: sol.atl,
            atlChangePercentage: sol.atl_change_percentage,
            atlDate: sol.atl_date,
            lastUpdated: sol.last_updated,
        };
    } catch (error) {
        console.error("❌ Error fetching SOL data:", error);
        throw error;
    }
}

// Run the test
fetchSolData()
    .then((data) => {
        console.log("\n✅ Data fetched successfully!");
        console.log("\n📦 Parsed Data Object:");
        console.log(JSON.stringify(data, null, 2));
    })
    .catch((err) => {
        console.error("Failed:", err);
    });
