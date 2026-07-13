// TODO: Review seed data and make every operation idempotent before running this script against Supabase or any production-like database. Do not execute it automatically during deployment.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
    firstFunderCategoryDictionary,
    tradingStrategyBenefit,
    tradingStrategyDictionary,
    tradingStrategyRisk,
    tradingStrategyRule,
    tradingStrategyWeight,
    walletCategoryDictionary,
} from "./schema";

const strategySeed = [
    {
        id: "scalper",
        name: "Scalper",
        description:
            "Executes many short-horizon trades and prioritizes fast position turnover.",
        name_key: "dictionary.tradingStrategy.scalper.name",
        description_key: "dictionary.tradingStrategy.scalper.description",
        benefits: [
            "dictionary.tradingStrategy.scalper.benefit.fastTurnover",
            "dictionary.tradingStrategy.scalper.benefit.adaptsVolatility",
        ],
        risks: [
            "dictionary.tradingStrategy.scalper.risk.feeHeavy",
            "dictionary.tradingStrategy.scalper.risk.emotionalPressure",
        ],
        weights: [
            { metric_name: "trade_frequency", weight: 0.35 },
            { metric_name: "avg_holding_time", weight: 0.25 },
            { metric_name: "win_rate", weight: 0.2 },
            { metric_name: "portfolio_concentration", weight: 0.2 },
        ],
        rules: [
            {
                rule_key: "dictionary.tradingStrategy.scalper.rule.minTrades30d",
                value: 40,
            },
            {
                rule_key: "dictionary.tradingStrategy.scalper.rule.maxAvgHoldHours",
                value: 24,
            },
        ],
    },
    {
        id: "swing",
        name: "Swing Trader",
        description:
            "Captures multi-day to multi-week moves and avoids overtrading noise.",
        name_key: "dictionary.tradingStrategy.swing.name",
        description_key: "dictionary.tradingStrategy.swing.description",
        benefits: [
            "dictionary.tradingStrategy.swing.benefit.balancedPace",
            "dictionary.tradingStrategy.swing.benefit.trendCapture",
        ],
        risks: [
            "dictionary.tradingStrategy.swing.risk.gapExposure",
            "dictionary.tradingStrategy.swing.risk.lateReversal",
        ],
        weights: [
            { metric_name: "avg_holding_time", weight: 0.3 },
            { metric_name: "pnl_consistency", weight: 0.3 },
            { metric_name: "win_rate", weight: 0.2 },
            { metric_name: "trade_frequency", weight: 0.2 },
        ],
        rules: [
            {
                rule_key: "dictionary.tradingStrategy.swing.rule.minTrades30d",
                value: 8,
            },
            {
                rule_key: "dictionary.tradingStrategy.swing.rule.minAvgHoldHours",
                value: 24,
            },
        ],
    },
    {
        id: "momentum",
        name: "Momentum Chaser",
        description:
            "Follows strong directional breakouts with acceleration in price and volume.",
        name_key: "dictionary.tradingStrategy.momentum.name",
        description_key: "dictionary.tradingStrategy.momentum.description",
        benefits: [
            "dictionary.tradingStrategy.momentum.benefit.strongTrendUpside",
            "dictionary.tradingStrategy.momentum.benefit.quickInvalidation",
        ],
        risks: [
            "dictionary.tradingStrategy.momentum.risk.falseBreakout",
            "dictionary.tradingStrategy.momentum.risk.whipsawLosses",
        ],
        weights: [
            { metric_name: "trade_size_volatility", weight: 0.3 },
            { metric_name: "buy_pressure", weight: 0.3 },
            { metric_name: "trade_frequency", weight: 0.2 },
            { metric_name: "max_drawdown", weight: 0.2 },
        ],
        rules: [
            {
                rule_key: "dictionary.tradingStrategy.momentum.rule.minBuySellRatio",
                value: 1.2,
            },
            {
                rule_key: "dictionary.tradingStrategy.momentum.rule.minTrades30d",
                value: 15,
            },
        ],
    },
    {
        id: "mean_revert",
        name: "Mean Reverter",
        description:
            "Looks for overextended moves and trades back toward average pricing.",
        name_key: "dictionary.tradingStrategy.meanRevert.name",
        description_key: "dictionary.tradingStrategy.meanRevert.description",
        benefits: [
            "dictionary.tradingStrategy.meanRevert.benefit.definedEntries",
            "dictionary.tradingStrategy.meanRevert.benefit.riskControlled",
        ],
        risks: [
            "dictionary.tradingStrategy.meanRevert.risk.trendAgainst",
            "dictionary.tradingStrategy.meanRevert.risk.patienceRequired",
        ],
        weights: [
            { metric_name: "entry_efficiency", weight: 0.3 },
            { metric_name: "avg_holding_time", weight: 0.25 },
            { metric_name: "pnl_consistency", weight: 0.25 },
            { metric_name: "max_drawdown", weight: 0.2 },
        ],
        rules: [
            {
                rule_key: "dictionary.tradingStrategy.meanRevert.rule.maxTrades30d",
                value: 30,
            },
            {
                rule_key: "dictionary.tradingStrategy.meanRevert.rule.minWinRate",
                value: 0.45,
            },
        ],
    },
    {
        id: "conviction",
        name: "Conviction Holder",
        description:
            "Builds concentrated positions and holds through broader market cycles.",
        name_key: "dictionary.tradingStrategy.conviction.name",
        description_key: "dictionary.tradingStrategy.conviction.description",
        benefits: [
            "dictionary.tradingStrategy.conviction.benefit.longCycleUpside",
            "dictionary.tradingStrategy.conviction.benefit.lowNoise",
        ],
        risks: [
            "dictionary.tradingStrategy.conviction.risk.concentration",
            "dictionary.tradingStrategy.conviction.risk.slowExit",
        ],
        weights: [
            { metric_name: "portfolio_concentration", weight: 0.35 },
            { metric_name: "avg_holding_time", weight: 0.3 },
            { metric_name: "drawdown_tolerance", weight: 0.2 },
            { metric_name: "trade_frequency", weight: 0.15 },
        ],
        rules: [
            {
                rule_key: "dictionary.tradingStrategy.conviction.rule.maxTokensHeld",
                value: 12,
            },
            {
                rule_key:
                    "dictionary.tradingStrategy.conviction.rule.minAvgHoldDays",
                value: 14,
            },
        ],
    },
];

const walletCategorySeed = [
    {
        id: "smart_money",
        name: "Smart Money",
        description:
            "Historically profitable wallet with consistent risk-adjusted decisions.",
        name_key: "dictionary.walletCategory.smartMoney.name",
        description_key: "dictionary.walletCategory.smartMoney.description",
    },
    {
        id: "active_trader",
        name: "Active Trader",
        description:
            "High activity wallet with frequent rotations and short response cycles.",
        name_key: "dictionary.walletCategory.activeTrader.name",
        description_key: "dictionary.walletCategory.activeTrader.description",
    },
    {
        id: "whale",
        name: "Whale",
        description:
            "Wallet with large capital base capable of moving thin-liquidity markets.",
        name_key: "dictionary.walletCategory.whale.name",
        description_key: "dictionary.walletCategory.whale.description",
    },
    {
        id: "new_wallet",
        name: "New Wallet",
        description:
            "Recently active wallet with limited historical behavior footprint.",
        name_key: "dictionary.walletCategory.newWallet.name",
        description_key: "dictionary.walletCategory.newWallet.description",
    },
    {
        id: "risk_wallet",
        name: "Risk Wallet",
        description:
            "Wallet that shows elevated volatility, adverse signals, or unstable patterns.",
        name_key: "dictionary.walletCategory.riskWallet.name",
        description_key: "dictionary.walletCategory.riskWallet.description",
    },
];

const firstFunderCategorySeed = [
    {
        id: "cex",
        name: "Centralized Exchange",
        description:
            "First inbound funding appears to come from a centralized exchange hot wallet.",
        name_key: "dictionary.firstFunderCategory.cex.name",
        description_key: "dictionary.firstFunderCategory.cex.description",
    },
    {
        id: "dex_router",
        name: "DEX Router",
        description:
            "First inbound funding originates from decentralized swap router infrastructure.",
        name_key: "dictionary.firstFunderCategory.dexRouter.name",
        description_key: "dictionary.firstFunderCategory.dexRouter.description",
    },
    {
        id: "bridge",
        name: "Bridge",
        description:
            "First inbound funding indicates cross-chain bridge transfer behavior.",
        name_key: "dictionary.firstFunderCategory.bridge.name",
        description_key: "dictionary.firstFunderCategory.bridge.description",
    },
    {
        id: "otc",
        name: "OTC Desk",
        description:
            "First inbound funding likely from over-the-counter settlement wallet.",
        name_key: "dictionary.firstFunderCategory.otc.name",
        description_key: "dictionary.firstFunderCategory.otc.description",
    },
    {
        id: "unknown",
        name: "Unknown Source",
        description:
            "Funding source cannot be confidently classified from available on-chain signals.",
        name_key: "dictionary.firstFunderCategory.unknown.name",
        description_key: "dictionary.firstFunderCategory.unknown.description",
    },
];

async function runSeed() {
    const connectionString = "POSTGRES_DB_URL_HERE";
    if (!connectionString) {
        throw new Error("POSTGRES_DB_URL is required to run db seed");
    }

    const client = postgres(connectionString);
    const db = drizzle({
        client,
        schema: {
            firstFunderCategoryDictionary,
            tradingStrategyBenefit,
            tradingStrategyDictionary,
            tradingStrategyRisk,
            tradingStrategyRule,
            tradingStrategyWeight,
            walletCategoryDictionary,
        },
    });

    try {
        await db.transaction(async (tx) => {
            await tx.delete(tradingStrategyDictionary);
            await tx.delete(walletCategoryDictionary);
            await tx.delete(firstFunderCategoryDictionary);

            await tx.insert(tradingStrategyDictionary).values(
                strategySeed.map((strategy) =>
                    strategy,
                ),
            );

            await tx.insert(walletCategoryDictionary).values(walletCategorySeed);
            await tx
                .insert(firstFunderCategoryDictionary)
                .values(firstFunderCategorySeed);

            await tx.insert(tradingStrategyBenefit).values(
                strategySeed.flatMap((strategy) =>
                    strategy.benefits.map((benefit_key) => ({
                        strategyId: strategy.id,
                        benefit_key,
                    })),
                ),
            );

            await tx.insert(tradingStrategyRisk).values(
                strategySeed.flatMap((strategy) =>
                    strategy.risks.map((risk_key) => ({
                        strategyId: strategy.id,
                        risk_key,
                    })),
                ),
            );

            await tx.insert(tradingStrategyWeight).values(
                strategySeed.flatMap((strategy) =>
                    strategy.weights.map((weight) => ({
                        strategyId: strategy.id,
                        metric_name: weight.metric_name,
                        weight: weight.weight,
                    })),
                ),
            );

            await tx.insert(tradingStrategyRule).values(
                strategySeed.flatMap((strategy) =>
                    strategy.rules.map((rule) => ({
                        strategyId: strategy.id,
                        rule_key: rule.rule_key,
                        value: rule.value,
                    })),
                ),
            );
        });

        console.log("Seed complete: trading strategy, wallet category, first funder category dictionaries.");
    } finally {
        await client.end({ timeout: 5 });
    }
}

runSeed().catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
});
