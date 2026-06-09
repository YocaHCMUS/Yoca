import client from "@/api/main";
import { ProfitableTradersView } from "@/components/market/ProfitableTradersView";
import {
  DexTable,
  INITIAL_FILTERS,
  SortKey,
  TableFilters,
} from "@/components/market/DexTable";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { useGet } from "@/hooks/useGet";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  ArrowUp,
  ChartBar,
  Checkmark,
  ChevronDown,
  Close,
  Growth,
  SettingsAdjust,
  Star,
  Trophy,
} from "@carbon/icons-react";
import { Column, Grid, Section, Stack } from "@carbon/react";
import classNames from "classnames";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./index.module.scss";

type PoolMainTab = "trending" | "top" | "gainers" | "newPairs" | "profitableTraders";
type PoolDuration = "5m" | "1h" | "6h" | "24h";
type TopSort = "volume" | "txns";
type TraderType = "today" | "1W" | "30d" | "90d";

const MAIN_TABS: Array<{ key: PoolMainTab; label: string }> = [
  { key: "trending", label: "Trending" },
  { key: "top", label: "Top" },
  { key: "gainers", label: "Top Gainers" },
  { key: "newPairs", label: "New Pairs" },
  { key: "profitableTraders", label: "Profitable Traders" },
];

export default function MarketPage() {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [trendingDuration, setTrendingDuration] = useState<PoolDuration>("5m");
  const [topSort, setTopSort] = useState<TopSort>("volume");
  const [traderType, setTraderType] = useState<TraderType>("1W");

  // Sorting & Filtering States (Lifting from DexTable)
  const [sortKey, setSortKey] = useState<SortKey>("5m");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<TableFilters>(INITIAL_FILTERS);
  const [tempFilters, setTempFilters] = useState<TableFilters>(INITIAL_FILTERS);

  const [isRankOpen, setIsRankOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeTab = MAIN_TABS[activeTabIndex]?.key ?? "trending";

  const rankRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rankRef.current && !rankRef.current.contains(event.target as Node))
        setIsRankOpen(false);
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      )
        setIsFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync sortKey with duration for Gainers tab
  useEffect(() => {
    if (activeTab === "gainers" || activeTab === "trending") {
      setSortKey(trendingDuration as SortKey);
      setSortDirection("desc");
    }
  }, [trendingDuration, activeTab]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setTempFilters(INITIAL_FILTERS);
  };

  const updateTempFilter = (
    key: keyof TableFilters,
    field: "min" | "max",
    val: string,
  ) => {
    setTempFilters((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
    { key: "5m", label: "Trending 5m" },
    { key: "1h", label: "Trending 1h" },
    { key: "6h", label: "Trending 6h" },
    { key: "24h", label: "Trending 24h" },
    { key: "txns", label: "Txns" },
    { key: "volume", label: "Volume" },
    { key: "marketCap", label: "Market Cap" },
    { key: "price", label: "Price" },
    { key: "liquidity", label: "Liquidity" },
    { key: "age", label: "Pair Age" },
  ];

  const SYNC_OPTIONS = [
    { key: "trending-5m", label: "Trending 5m", tab: "trending", sub: "5m" },
    { key: "trending-1h", label: "Trending 1h", tab: "trending", sub: "1h" },
    { key: "trending-6h", label: "Trending 6h", tab: "trending", sub: "6h" },
    { key: "trending-24h", label: "Trending 24h", tab: "trending", sub: "24h" },
    { key: "top-volume", label: "Top Volume", tab: "top", sub: "volume" },
    { key: "top-txns", label: "Top Txns", tab: "top", sub: "txns" },
    { key: "gainers-5m", label: "Top Gainers 5m", tab: "gainers", sub: "5m" },
    { key: "gainers-1h", label: "Top Gainers 1h", tab: "gainers", sub: "1h" },
    { key: "gainers-6h", label: "Top Gainers 6h", tab: "gainers", sub: "6h" },
    { key: "gainers-24h", label: "Top Gainers 24h", tab: "gainers", sub: "24h" },
    { key: "new-pairs", label: "New Pairs", tab: "newPairs", sub: "age" },
  ];

  const currentDropdownLabel = useMemo(() => {
    if (activeTab === "trending") return `Trending ${trendingDuration}`;
    if (activeTab === "gainers") return `Top Gainers ${trendingDuration}`;
    if (activeTab === "top") return `Top ${topSort === "volume" ? "Volume" : "Txns"}`;
    if (activeTab === "newPairs") return "New Pairs";
    return "";
  }, [activeTab, trendingDuration, topSort]);

  const trendingPools = useGet(
    client.api.tokens["market-pools"].trending,
    200,
    { query: { duration: trendingDuration } },
  );

  const topPools = useGet(client.api.tokens["market-pools"].top, 200, {
    query: { sortBy: topSort },
  });

  // why is this not used
  const topGainerPools = useGet(client.api.tokens["market-pools"].gainers, 200);
  const newPairs = useGet(client.api.tokens["market-pools"]["new-pairs"], 200);

  // Note: localization here
  const headings = useMemo(() => {
    switch (activeTab) {
      case "trending":
        return {
          title: "Trending Pools",
          subtitle:
            "Các pool đang trend trên Solana theo mốc thời gian 5M, 1H, 6H, 24H.",
        };
      case "top":
        return {
          title: "Top Pools",
          subtitle: "Top pool theo Volume, Txns hoặc Market Cap.",
        };
      case "gainers":
        return {
          title: "Top Gainer Pools",
          subtitle: "Top pool tăng giá mạnh nhất trong 24 giờ.",
        };
      case "newPairs":
        return {
          title: "New Pairs",
          subtitle: "Các pool mới tạo gần đây.",
        };
      case "profitableTraders":
        return {
          title: "Profitable Traders",
          subtitle: "Top các ví giao dịch có lợi nhuận (PnL) cao nhất và thấp nhất.",
        };
      default:
        return {
          title: "Market Pools",
          subtitle: "Theo dõi pool theo các bộ lọc chính.",
        };
    }
  }, [activeTab]);

  const dataToRender = useMemo(() => {
    switch (activeTab) {
      case "trending": return trendingPools.data;
      case "top": return topPools.data;
      case "gainers": return topGainerPools.data;
      case "newPairs": return newPairs.data;
      default: return [];
    }
  }, [activeTab, trendingPools.data, topPools.data, topGainerPools.data, newPairs.data]);

  return (
    <PageWrapper>
      <Section>
        <Grid className={overwriteStyles.wdGrd}>
          <Column sm={2} md={8} lg={16}>
            <Stack gap={4}>
              <Stack gap={1}>
                <Txt bold size="lg">
                  {headings.title}
                </Txt>
                <Txt secondary>{headings.subtitle}</Txt>
              </Stack>

              <div className={styles.dexBar}>
                {MAIN_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;

                  if (isActive) {
                    const hasSubfilters =
                      tab.key === "trending" ||
                      tab.key === "top" ||
                      tab.key === "gainers" ||
                      tab.key === "profitableTraders";
                    return (
                      <div
                        key={tab.key}
                        className={`${styles.activeTabContainer} ${!hasSubfilters ? styles.noSubfilters : ""}`}
                      >
                        <span className={styles.activeTabText}>
                          {tab.key === "trending" && <Growth size={16} />}
                          {tab.key === "top" && <ChartBar size={16} />}
                          {tab.key === "gainers" && <ArrowUp size={16} />}
                          {tab.key === "newPairs" && <Star size={16} />}
                          {tab.key === "profitableTraders" && <Trophy size={16} />}
                          {tab.label}
                        </span>
                        {tab.key === "profitableTraders" && (
                          <div className={styles.inlineFilters}>
                            {(["today", "1W", "30d", "90d"] as TraderType[]).map((t) => {
                              const label = t === "today" ? "1D" : t === "1W" ? "7D" : t === "30d" ? "30D" : "90D";
                              return (
                                <button
                                  key={t}
                                  className={`${styles.inlineFilterBtn} ${traderType === t ? styles.active : ""}`}
                                  onClick={() => setTraderType(t)}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {(tab.key === "trending" || tab.key === "gainers") && (
                          <div className={styles.inlineFilters}>
                            {["5m", "1h", "6h", "24h"].map((d) => (
                              <button
                                key={d}
                                className={`${styles.inlineFilterBtn} ${trendingDuration === d ? styles.active : ""}`}
                                onClick={() => {
                                  setTrendingDuration(d as PoolDuration);
                                  setSortKey(d as SortKey);
                                  setSortDirection("desc");
                                }}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}
                        {tab.key === "top" && (
                          <div className={styles.inlineFilters}>
                            {["volume", "txns"].map((s) => (
                              <button
                                key={s}
                                className={`${styles.inlineFilterBtn} ${topSort === s ? styles.active : ""}`}
                                onClick={() => {
                                  setTopSort(s as TopSort);
                                  setSortKey(s as SortKey);
                                  setSortDirection("desc");
                                }}
                              >
                                {s === "volume" ? "Volume" : "Txns"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={tab.key}
                      className={styles.tabBtn}
                      onClick={() => {
                        const newIndex = MAIN_TABS.findIndex(
                          (t) => t.key === tab.key,
                        );
                        setActiveTabIndex(newIndex);

                        // Reset or set specific sort when switching tabs
                        if (tab.key === "gainers" || tab.key === "trending") {
                          setSortKey(trendingDuration as SortKey);
                          setSortDirection("desc");
                        } else if (tab.key === "top") {
                          setSortKey(topSort as SortKey);
                          setSortDirection("desc");
                        } else if (tab.key === "newPairs") {
                          setSortKey("age");
                          setSortDirection("desc");
                        }
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                <div className={styles.toolbarWrapper}>
                  {activeTab !== "profitableTraders" && (
                    <>
                      <div className={styles.rankContainer} ref={rankRef}>
                        <button
                          className={classNames(styles.toolbarBtn, {
                            [styles.active]: isRankOpen,
                          })}
                          onClick={() => setIsRankOpen(!isRankOpen)}
                        >
                          <Trophy size={16} />
                          <span>
                            Rank by: {currentDropdownLabel}
                          </span>
                          <ChevronDown size={16} />
                        </button>

                        {isRankOpen && (
                          <div className={styles.dropdown}>
                            <div className={styles.dropdownSection}>
                              <div className={styles.sectionTitle}>Rank by</div>
                              {SYNC_OPTIONS.map((opt) => {
                                const isSelected = activeTab === opt.tab && 
                                  (opt.tab === "top" ? topSort === opt.sub : 
                                   opt.tab === "newPairs" ? true : 
                                   trendingDuration === opt.sub);
                                return (
                                  <div
                                    key={opt.key}
                                    className={styles.option}
                                    onClick={() => {
                                      const newIndex = MAIN_TABS.findIndex((t) => t.key === opt.tab);
                                      if (newIndex !== -1) setActiveTabIndex(newIndex);
                                      
                                      if (opt.tab === "top") {
                                        setTopSort(opt.sub as TopSort);
                                        setSortKey(opt.sub as SortKey);
                                      } else if (opt.tab === "newPairs") {
                                        setSortKey("age");
                                      } else {
                                        setTrendingDuration(opt.sub as PoolDuration);
                                        setSortKey(opt.sub as SortKey);
                                      }
                                      setSortDirection("desc");
                                      setIsRankOpen(false);
                                    }}
                                  >
                                    {isSelected && <Checkmark size={14} />}
                                    <span>{opt.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={styles.filterContainer} ref={filterRef}>
                        <button
                          className={classNames(styles.toolbarBtn, {
                            [styles.active]: isFilterOpen,
                          })}
                          onClick={() => {
                            setIsFilterOpen(!isFilterOpen);
                            setTempFilters(filters);
                          }}
                        >
                          <SettingsAdjust size={16} />
                          <span>Filters</span>
                        </button>

                        {isFilterOpen && (
                          <div className={styles.filterPopup}>
                            <div className={styles.popupHeader}>
                              <span>Customize Filters</span>
                              <Close
                                size={20}
                                className={styles.closeIcon}
                                onClick={() => setIsFilterOpen(false)}
                              />
                            </div>
                            <div className={styles.popupContent}>
                              {[
                                { label: "Liquidity", key: "liquidity", unit: "$" },
                                { label: "Market cap", key: "mcap", unit: "$" },
                                { label: "Volume (24h)", key: "volume", unit: "$" },
                                { label: "Txns (24h)", key: "txns", unit: "" },
                                { label: "Pair age (h)", key: "age", unit: "" },
                                {
                                  label: "24h change",
                                  key: "change24h",
                                  unit: "%",
                                },
                              ].map((f) => (
                                <div key={f.key} className={styles.filterRow}>
                                  <label>{f.label}:</label>
                                  <div className={styles.inputGroup}>
                                    <div className={styles.inputWithUnit}>
                                      {f.unit && (
                                        <span className={styles.unit}>
                                          {f.unit}
                                        </span>
                                      )}
                                      <input
                                        type="number"
                                        placeholder="Min"
                                        value={
                                          tempFilters[f.key as keyof TableFilters]
                                            .min || ""
                                        }
                                        onChange={(e) =>
                                          updateTempFilter(
                                            f.key as keyof TableFilters,
                                            "min",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className={styles.inputWithUnit}>
                                      {f.unit && (
                                        <span className={styles.unit}>
                                          {f.unit}
                                        </span>
                                      )}
                                      <input
                                        type="number"
                                        placeholder="Max"
                                        value={
                                          tempFilters[f.key as keyof TableFilters]
                                            .max || ""
                                        }
                                        onChange={(e) =>
                                          updateTempFilter(
                                            f.key as keyof TableFilters,
                                            "max",
                                            e.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className={styles.popupFooter}>
                              <button
                                className={styles.resetBtn}
                                onClick={handleResetFilters}
                              >
                                Reset
                              </button>
                              <button
                                className={styles.applyBtn}
                                onClick={handleApplyFilters}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Section className={styles.tableSection}>
                {activeTab === "profitableTraders" ? (
                  <ProfitableTradersView traderType={traderType} />
                ) : (
                  <DexTable
                    loading={
                      trendingPools.isLoading || 
                      trendingPools.isValidating || 
                      topPools.isLoading || 
                      topPools.isValidating ||
                      newPairs.isLoading
                    }
                    data={dataToRender as any}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    filters={filters}
                    onSort={handleSort}
                  />
                )}
              </Section>
            </Stack>
          </Column>
        </Grid>
      </Section>
    </PageWrapper>
  );
}
