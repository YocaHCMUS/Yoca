// client/src/components/charts/GeckoTerminalChart.tsx

import { useUserTheme } from "@/contexts/ThemeContext";

interface GeckoTerminalChartProps {
  poolAddress: string;
  height?: string;
}

export const GeckoTerminalChart = ({
  poolAddress,
  height = "700",
}: GeckoTerminalChartProps) => {
  const { theme } = useUserTheme();
  const isLight = theme === "light";

  // URL embed chuẩn từ GeckoTerminal
  const embedUrl = `https://www.geckoterminal.com/solana/pools/${poolAddress}?embed=1&info=0&swaps=0&light_chart=${isLight ? 1 : 0}&resolution=15m&bg_color=${isLight ? "ffffff" : "161616"}`;

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
