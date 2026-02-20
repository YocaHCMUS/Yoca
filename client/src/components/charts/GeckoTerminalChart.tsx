// client/src/components/charts/GeckoTerminalChart.tsx

interface GeckoTerminalChartProps {
    poolAddress: string;
    height?: string;
}

export const GeckoTerminalChart = ({ poolAddress, height = "700" }: GeckoTerminalChartProps) => {
    // URL embed chuẩn từ GeckoTerminal
    const embedUrl = `https://www.geckoterminal.com/solana/pools/${poolAddress}?embed=1&info=0&swaps=0&light_chart=1&resolution=15m&bg_color=ffffff`;

    return (
        <iframe
            id="geckoterminal-embed"
            title="GeckoTerminal Embed"
            src={embedUrl}
            frameBorder="0"
            allow="clipboard-write"
            allowFullScreen
            style={{ width: "100%", height: `${height}px`, borderRadius: "8px" }}
        />
    );
};
