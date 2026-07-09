import { ArrowDown, ArrowUp } from "@carbon/icons-react";
import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { useEffect, useState } from "react";
import type { ExportFormat } from "../charts/shared/ExportMenu";
import { TableWrapper } from "../tables/TableWrapper.js";
import styles from "./TokenPerformanceTable.module.scss";
import { useLocalization } from "@/contexts/LocalizationContext";

// Define types explicitly based on the API response structure
interface TokenMarketDataItem {
  address: string;
  priceUsd: number;
  priceChangePercentage24h: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
  ath: number;
  athChangePercentage: number;
  atl: number;
  atlChangePercentage: number;
}

interface TokenMetaDataItem {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
}

type MarketData = TokenMarketDataItem[];
type MetaData = TokenMetaDataItem[];

export interface TokenPerformance {
  id: string;
  address: string;
  token: string;
  symbol: string;
  imageUrl: string | null;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: number;
  totalSupply: number;
  ath: number;
  athChangePercentage: number;
  atl: number;
  atlChangePercentage: number;
}

interface TokenPerformanceTableProps {
  /** Callback when a token row is clicked */
  onTokenSelect?: (token: TokenPerformance) => void;
  /** Currently selected token address */
  selectedTokenAddress?: string;
}

// Popular Solana ecosystem token addresses (verified tokens with CoinGecko data)
// This list includes major DeFi, meme, stablecoins, gaming, and infrastructure tokens
const SOLANA_TOKEN_ADDRESSES = [
  // Tier 1: Major tokens (most likely to have data)
  "So11111111111111111111111111111111111111112", // Wrapped SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USD Coin (USDC)
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // Tether USD (USDT)

  // Tier 1: Top tokens by market cap
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // Jupiter (JUP)
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", // Jito (JTO)
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // Bonk (BONK)
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // Dogwifhat (WIF)
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH Network (PYTH)
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", // Helium (HNT)

  // Tier 2: DeFi tokens (well-known)
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // Raydium (RAY)
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", // Orca (ORCA)
  "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac", // Mango (MNGO)
  "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt", // Serum (SRM)
  "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp", // Bonfida (FIDA)

  // Tier 2: Staking & Yield tokens
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // Marinade SOL (mSOL)
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", // BlazeStake Staked SOL (bSOL)

  // Tier 2: Meme & Community tokens
  "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", // Samoyedcoin (SAMO)

  // Tier 3: Additional DeFi
  "Ce3PSQfkxT5ua4r2JqCoWYrMwKWC5hEzwsrT9Hb7mAz9", // Saber (SBR)
  "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT", // Step Finance (STEP)
  "kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6", // KIN Token (KIN)

  // Tier 3: Gaming & NFTs
  "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y", // Shadow Token (SHDW)
  "GENEtH5amGSi8kHAtQoezp1XEXwZJ8vcuePYnXdKrMYz", // Genopets (GENE)
  "7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx", // STEPN (GMT)
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", // Media Network (MEDIA)

  // Tier 3: More DeFi
  "PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y", // Port Finance (PORT)
  "GThUX1Atko4jqhN2q9CkU3EQNd2G5z7YDFfG6MCL5fby", // Sunny (SUNNY)

  // Tier 3: Wrapped tokens
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", // Wrapped Bitcoin (soBTC)
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // Wrapped Ethereum (soETH)

  // Tier 3: Infrastructure
  "CWE8jPTUYhdCTZYWPTe1o5DFqfdjzWKc9Wz8pXq9zvuA", // Hxro Network (HXRO)
  "8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh", // COPE (COPE)
  "Basis9oJw9j8cw53oMV7iqsgo6ihi9ALw4QR31rcjUJa", // Basis Markets (BASIS)
  "8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo", // Rope Token (ROPE)
  "ChVzxWRmrTeSgwd3Ui3UumcN8KX7VK3WaD4K92SKay98", // UXD Stablecoin (UXD)
  "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", // ZEBEC Protocol (ZBC)
  "USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDk4JT78M", // Hubble Protocol USD (USDH)
  "AfXLBfMZd32pN6QauazHCd7diEWoBgw1GNUALDw3suVZ", // LikeCoin (LIKE)
  "2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk", // Ethereum Token on Solana
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // BTC on Solana
];

const getHeaders = (tr: any) => [
  { key: "token", header: tr("marketPage.token") },
  { key: "price", header: tr("marketPage.price") },
  { key: "change24h", header: tr("marketPage.change24h") },
  { key: "volume24h", header: tr("marketPage.volume24h") },
  { key: "marketCap", header: tr("marketPage.marketCap") },
  { key: "supply", header: tr("token.marketStats.circSupply") },
];

export const TokenPerformanceTable: React.FC<TokenPerformanceTableProps> = ({
  onTokenSelect,
  selectedTokenAddress,
}) => {
  const { tr, fmt } = useLocalization();
  const [tokens, setTokens] = useState<TokenPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = getHeaders(tr);

  // Handle row click
  const handleRowClick = (tokenId: string) => {
    const token = tokens.find((t) => t.id === tokenId);
    if (token && onTokenSelect) {
      onTokenSelect(token);
    }
  };

  useEffect(() => {
    async function fetchTokenData() {
      try {
        setLoading(true);
        setError(null);

        const apiDomain =
          import.meta.env.VITE_CLIENT_API_DOMAIN || window.location.origin;

        // Batch tokens into smaller chunks to avoid API issues
        const BATCH_SIZE = 10;
        const batches: string[][] = [];
        for (let i = 0; i < SOLANA_TOKEN_ADDRESSES.length; i += BATCH_SIZE) {
          batches.push(SOLANA_TOKEN_ADDRESSES.slice(i, i + BATCH_SIZE));
        }

        const allMarketData: TokenMarketDataItem[] = [];
        const allMetaData: TokenMetaDataItem[] = [];

        // Fetch each batch separately with error handling per batch
        for (const batch of batches) {
          const addressesParam = batch.join(",");

          try {
            // Fetch market data and meta data in parallel for this batch
            const [marketResp, metaResp] = await Promise.all([
              fetch(`${apiDomain}/api/tokens/markets/${addressesParam}`),
              fetch(`${apiDomain}/api/tokens/meta/${addressesParam}`),
            ]);

            // Process market data if successful
            if (marketResp.ok) {
              const marketData = (await marketResp.json()) as MarketData;
              if (Array.isArray(marketData)) {
                allMarketData.push(...marketData);
              }
            } else {
              console.warn(
                `Failed to fetch market data for batch: ${batch.join(",").substring(0, 50)}...`,
              );
            }

            // Process meta data if successful
            if (metaResp.ok) {
              const metaData = (await metaResp.json()) as MetaData;
              if (Array.isArray(metaData)) {
                allMetaData.push(...metaData);
              }
            } else {
              console.warn(
                `Failed to fetch meta data for batch: ${batch.join(",").substring(0, 50)}...`,
              );
            }
          } catch (batchError) {
            // Log but continue with other batches
            console.warn(
              `Error fetching batch: ${batch.join(",").substring(0, 50)}...`,
              batchError,
            );
          }
        }

        // If no market data was fetched at all, show error
        if (allMarketData.length === 0) {
          setError(tr("ERROR.FAILED_TO_FETCH_REQUESTED_DATA"));
          setLoading(false);
          return;
        }

        // Create a lookup map for meta data by address
        const metaLookup = new Map(allMetaData.map((m) => [m.address, m]));

        // Combine market and meta data, filtering out invalid entries
        const combinedTokens: TokenPerformance[] = allMarketData
          .filter(
            (market) => market && market.address && market.priceUsd != null,
          )
          .map((market, index) => {
            const meta = metaLookup.get(market.address);
            return {
              id: String(index + 1),
              address: market.address,
              token: meta?.name || "Unknown",
              symbol: meta?.symbol?.toUpperCase() || "???",
              imageUrl: meta?.imageUrl || null,
              price: Number(market.priceUsd) || 0,
              change24h: Number(market.priceChangePercentage24h || 0),
              volume24h: Number(market.volume24h) || 0,
              marketCap: Number(market.marketCap) || 0,
              supply: Number(market.circulatingSupply) || 0,
              totalSupply: Number(market.totalSupply) || 0,
              ath: Number(market.ath) || 0,
              athChangePercentage: Number(market.athChangePercentage) || 0,
              atl: Number(market.atl) || 0,
              atlChangePercentage: Number(market.atlChangePercentage) || 0,
            };
          })
          // Sort by market cap descending
          .sort((a, b) => b.marketCap - a.marketCap);

        setTokens(combinedTokens);

        // Show partial success message if some tokens were skipped
        if (combinedTokens.length < SOLANA_TOKEN_ADDRESSES.length) {
          console.info(
            `Loaded ${combinedTokens.length} of ${SOLANA_TOKEN_ADDRESSES.length} tokens`,
          );
        }
      } catch (err) {
        console.error("Failed to fetch token data:", err);
        setError(tr("ERROR.FAILED_TO_FETCH_REQUESTED_DATA"));
      } finally {
        setLoading(false);
      }
    }

    fetchTokenData();
  }, []);

  // Removed local formatNumber

  const formatSupply = (num: number, symbol: string) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T ${symbol}`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B ${symbol}`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M ${symbol}`;
    return `${fmt.num.decimal(num)} ${symbol}`;
  };

  const rows = tokens.map((token) => ({
    id: token.id,
    token: (
      <div className={styles.tokenCell}>
        {token.imageUrl && (
          <img
            src={token.imageUrl}
            alt={token.token}
            className={styles.tokenImage}
            width={24}
            height={24}
          />
        )}
        <div className={styles.tokenInfo}>
          <span className={styles.tokenName}>{token.token}</span>
          <span className={styles.tokenSymbol}>{token.symbol}</span>
        </div>
      </div>
    ),
    price: fmt.num.currency(token.price),
    change24h: (
      <span
        className={token.change24h >= 0 ? styles.positive : styles.negative}
      >
        {token.change24h >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
        {Math.abs(token.change24h).toFixed(2)}%
      </span>
    ),
    volume24h: fmt.num.compact.currency(token.volume24h),
    marketCap: fmt.num.compact.currency(token.marketCap),
    supply: formatSupply(token.supply, token.symbol),
  }));
  /**
   * Handle export functionality
   */
  const handleExport = async (format: ExportFormat) => {
    if (format === "csv") {
      // Export as CSV
      const csvHeaders = headers.map((h) => h.header).join(",");
      const csvRows = tokens.map((token) =>
        [
          token.token,
          token.symbol,
          token.price.toFixed(6),
          token.change24h.toFixed(2),
          token.volume24h.toString(),
          token.marketCap.toString(),
          token.supply.toString(),
        ].join(","),
      );
      const csvContent = [csvHeaders, ...csvRows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `token-performance-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };
  if (loading) {
    return (
      <TableWrapper
        title={tr("marketPage.tokenPerformanceTitle")}
        onExport={handleExport}
        isEmpty={true}
      >
        <div className={styles.loadingState}>{tr("common.loading")}</div>
      </TableWrapper>
    );
  }

  if (error) {
    return (
      <TableWrapper
        title={tr("marketPage.tokenPerformanceTitle")}
        onExport={handleExport}
        isEmpty={true}
      >
        <div className={styles.errorState}>{error}</div>
      </TableWrapper>
    );
  }

  return (
    <TableWrapper
      title={tr("marketPage.tokenPerformanceTitle")}
      onExport={handleExport}
      isEmpty={tokens.length === 0}
    >
      <div className={styles.tokenPerformanceTable}>
        <DataTable rows={rows} headers={headers}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });
                  const token = tokens.find((t) => t.id === row.id);
                  const isSelected = token?.address === selectedTokenAddress;
                  return (
                    <TableRow
                      key={key}
                      {...rowProps}
                      className={`${styles.clickableRow} ${isSelected ? styles.selectedRow : ""}`}
                      onClick={() => handleRowClick(row.id)}
                    >
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataTable>
      </div>
    </TableWrapper>
  );
};
