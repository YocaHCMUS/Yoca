import Tble from "../Tble";
import { type MarketData } from "../../hooks/useTokenPageData";

interface MarketStatsProps {
    data: NonNullable<MarketData>;
}

export const MarketStats = ({ data }: MarketStatsProps) => {
    // Helper to format price change with color
    const formatPriceChange = (value: number | null) => {
        if (value === null || value === undefined) return "N/A";
        const sign = value >= 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}%`;
    };

    // Helper to format currency
    const formatCurrency = (value: number | null) => {
        if (value === null || value === undefined) return "N/A";
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
    };

    // Helper to format date
    const formatDate = (dateStr: string | null | Date) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString();
    };

    const marketDataHeaders = [
        { key: "name", header: "Name" },
        { key: "value", header: "Value" },
    ];

    const marketDataRows = [
        {
            id: "currentPrice",
            name: "Current Price",
            value: formatCurrency(data.priceUsd),
        },
        {
            id: "priceChange1h",
            name: "Price Change (1h)",
            value: formatPriceChange(data.priceChangePercentage1h),
        },
        {
            id: "priceChange24h",
            name: "Price Change (24h)",
            value: formatPriceChange(data.priceChangePercentage24h),
        },
        {
            id: "priceChange14d",
            name: "Price Change (14d)",
            value: formatPriceChange(data.priceChangePercentage14d),
        },
        {
            id: "priceChange30d",
            name: "Price Change (30d)",
            value: formatPriceChange(data.priceChangePercentage30d),
        },
        {
            id: "marketCap",
            name: "Market Cap",
            value: data.marketCap ? `$${data.marketCap.toLocaleString()}` : "N/A",
        },
        {
            id: "volume24h",
            name: "24h Trading Volume",
            value: data.volume24h ? `$${data.volume24h.toLocaleString()}` : "N/A",
        },
        {
            id: "fdv",
            name: "Fully Diluted Value",
            value: data.fullyDilutedValuation ? `$${data.fullyDilutedValuation.toLocaleString()}` : "N/A",
        },
        {
            id: "circulatingSupply",
            name: "Circulating Supply",
            value: data.circulatingSupply ? data.circulatingSupply.toLocaleString() : "N/A",
        },
        {
            id: "totalSupply",
            name: "Total Supply",
            value: data.totalSupply ? data.totalSupply.toLocaleString() : "N/A",
        },
        {
            id: "maxSupply",
            name: "Max Supply",
            value: data.maxSupply ? data.maxSupply.toLocaleString() : "N/A",
        },
        {
            id: "ath",
            name: "All-Time High (ATH)",
            value: `${formatCurrency(data.ath)} (${formatDate(data.athDate)})`,
        },
        {
            id: "athChange",
            name: "% From ATH",
            value: formatPriceChange(data.athChangePercentage),
        },
        {
            id: "atl",
            name: "All-Time Low (ATL)",
            value: `${formatCurrency(data.atl)} (${formatDate(data.atlDate)})`,
        },
        {
            id: "atlChange",
            name: "% From ATL",
            value: formatPriceChange(data.atlChangePercentage),
        },
    ];

    return (
        <Tble
            headers={marketDataHeaders}
            loading={false}
            rows={marketDataRows}
            hideHeaders
        />
    );
};
