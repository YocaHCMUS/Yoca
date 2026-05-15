import client from "@/api/main";
import { DexTable } from "@/components/market/DexTable";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useGet } from "@/hooks/useGet";
import styles from "./index.module.scss";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import { Column, Grid, Section, Stack } from "@carbon/react";
import { Growth, ChartBar, ArrowUp, Star, Trophy, ChevronDown, Checkmark, SettingsAdjust, Close } from "@carbon/icons-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { TableFilters, INITIAL_FILTERS, SortKey } from "@/components/market/DexTable";
import classNames from "classnames";

type PoolMainTab = "trending" | "top" | "gainers" | "newPairs";
type PoolDuration = "5m" | "1h" | "6h" | "24h";
type TopSort = "volume" | "txns";

const MAIN_TABS: Array<{ key: PoolMainTab; label: string }> = [
  { key: "trending", label: "Trending" },
  { key: "top", label: "Top" },
  { key: "gainers", label: "Top Gainers" },
  { key: "newPairs", label: "New Pairs" },
];

export default function MarketPage() {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [trendingDuration, setTrendingDuration] = useState<PoolDuration>("5m");
  const [topSort, setTopSort] = useState<TopSort>("volume");

  // Sorting & Filtering States (Lifting from DexTable)
  const [sortKey, setSortKey] = useState<SortKey | "none">("none");
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
      if (rankRef.current && !rankRef.current.contains(event.target as Node)) setIsRankOpen(false);
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync sortKey with duration for Gainers tab
  useEffect(() => {
    if (activeTab === "gainers") {
      setSortKey(trendingDuration as SortKey);
      setSortDirection("desc");
    }
  }, [trendingDuration, activeTab]);

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setTempFilters(INITIAL_FILTERS);
  };

  const updateTempFilter = (key: keyof TableFilters, field: "min" | "max", val: string) => {
    setTempFilters(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: val }
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
    { key: "liquidity", label: "Liquidity" },
    { key: "age", label: "Pair Age" },
  ];


  const trendingPools = useGet(
    client.api.tokens["market-pools"].trending,
    200,
    { query: { duration: trendingDuration } },
  );

  const topPools = useGet(
    client.api.tokens["market-pools"].top,
    200,
    { query: { sortBy: topSort } },
  );

  const topGainerPools = useGet(client.api.tokens["market-pools"].gainers, 200);
  const newPairs = useGet(client.api.tokens["market-pools"]["new-pairs"], 200);

  const headings = useMemo(() => {
    switch (activeTab) {
      case "trending":
        return {
          title: "Trending Pools",
          subtitle: "Các pool đang trend trên Solana theo mốc thời gian 5M, 1H, 6H, 24H.",
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
          title: "New Pair Pools",
          subtitle: "Các pool mới được tạo gần đây trên hệ Solana.",
        };
      default:
        return {
          title: "Market Pools",
          subtitle: "Theo dõi pool theo các bộ lọc chính.",
        };
    }
  }, [activeTab]);

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
                    const hasSubfilters = tab.key === "trending" || tab.key === "top" || tab.key === "gainers";
                    return (
                      <div key={tab.key} className={`${styles.activeTabContainer} ${!hasSubfilters ? styles.noSubfilters : ""}`}>
                        <span className={styles.activeTabText}>
                          {tab.key === "trending" && <Growth size={16} />}
                          {tab.key === "top" && <ChartBar size={16} />}
                          {tab.key === "gainers" && <ArrowUp size={16} />}
                          {tab.key === "newPairs" && <Star size={16} />}
                          {tab.label}
                        </span>
                        {(tab.key === "trending" || tab.key === "gainers") && (
                          <div className={styles.inlineFilters}>
                            {["5m", "1h", "6h", "24h"].map((d) => (
                              <button
                                key={d}
                                className={`${styles.inlineFilterBtn} ${trendingDuration === d ? styles.active : ""}`}
                                onClick={() => setTrendingDuration(d as PoolDuration)}
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
                                onClick={() => setTopSort(s as TopSort)}
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
                        const newIndex = MAIN_TABS.findIndex((t) => t.key === tab.key);
                        setActiveTabIndex(newIndex);
                        
                        // Reset or set specific sort when switching tabs
                        if (tab.key === "gainers") {
                          setSortKey(trendingDuration as SortKey);
                          setSortDirection("desc");
                        } else {
                          // Reset sort to default for other tabs to avoid conflicts
                          setSortKey("none");
                          setSortDirection("desc");
                        }
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}

                {/* Toolbar moved here */}
                <div className={styles.toolbarWrapper}>
                  <div className={styles.rankContainer} ref={rankRef}>
                    <button 
                      className={classNames(styles.toolbarBtn, { [styles.active]: isRankOpen })}
                      onClick={() => setIsRankOpen(!isRankOpen)}
                    >
                      <Trophy size={16} />
                      <span>Rank by: {sortKey === "none" ? "None" : `${sortDirection === "desc" ? "↓" : "↑"} ${SORT_OPTIONS.find(o => o.key === sortKey)?.label}`}</span>
                      <ChevronDown size={16} />
                    </button>
                    
                    {isRankOpen && (
                      <div className={styles.dropdown}>
                        <div className={styles.dropdownSection}>
                          <div className={styles.sectionTitle}>Order</div>
                          <div className={styles.option} onClick={() => { setSortDirection("desc"); setIsRankOpen(false); }}>
                            {sortDirection === "desc" && <Checkmark size={14} />}
                            <span>Descending</span>
                          </div>
                          <div className={styles.option} onClick={() => { setSortDirection("asc"); setIsRankOpen(false); }}>
                            {sortDirection === "asc" && <Checkmark size={14} />}
                            <span>Ascending</span>
                          </div>
                        </div>
                        <div className={styles.dropdownSection}>
                          <div className={styles.sectionTitle}>Rank by</div>
                          <div className={styles.option} onClick={() => { setSortKey("none"); setIsRankOpen(false); }}>
                            {sortKey === "none" && <Checkmark size={14} />}
                            <span>Default (No Sort)</span>
                          </div>
                          {SORT_OPTIONS.map(opt => (
                            <div key={opt.key} className={styles.option} onClick={() => { setSortKey(opt.key); setIsRankOpen(false); }}>
                              {sortKey === opt.key && <Checkmark size={14} />}
                              <span>{opt.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.filterContainer} ref={filterRef}>
                    <button 
                      className={classNames(styles.toolbarBtn, { [styles.active]: isFilterOpen })}
                      onClick={() => { setIsFilterOpen(!isFilterOpen); setTempFilters(filters); }}
                    >
                      <SettingsAdjust size={16} />
                      <span>Filters</span>
                    </button>

                    {isFilterOpen && (
                      <div className={styles.filterPopup}>
                        <div className={styles.popupHeader}>
                          <span>Customize Filters</span>
                          <Close size={20} className={styles.closeIcon} onClick={() => setIsFilterOpen(false)} />
                        </div>
                        <div className={styles.popupContent}>
                          {[
                            { label: "Liquidity", key: "liquidity", unit: "$" },
                            { label: "Market cap", key: "mcap", unit: "$" },
                            { label: "Volume (24h)", key: "volume", unit: "$" },
                            { label: "Txns (24h)", key: "txns", unit: "" },
                            { label: "Pair age (h)", key: "age", unit: "" },
                            { label: "24h change", key: "change24h", unit: "%" },
                          ].map(f => (
                            <div key={f.key} className={styles.filterRow}>
                              <label>{f.label}:</label>
                              <div className={styles.inputGroup}>
                                <div className={styles.inputWithUnit}>
                                  {f.unit && <span className={styles.unit}>{f.unit}</span>}
                                  <input 
                                    type="number" 
                                    placeholder="Min" 
                                    value={tempFilters[f.key as keyof TableFilters].min || ""} 
                                    onChange={e => updateTempFilter(f.key as keyof TableFilters, "min", e.target.value)}
                                  />
                                </div>
                                <div className={styles.inputWithUnit}>
                                  {f.unit && <span className={styles.unit}>{f.unit}</span>}
                                  <input 
                                    type="number" 
                                    placeholder="Max" 
                                    value={tempFilters[f.key as keyof TableFilters].max || ""} 
                                    onChange={e => updateTempFilter(f.key as keyof TableFilters, "max", e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className={styles.popupFooter}>
                          <button className={styles.resetBtn} onClick={handleResetFilters}>Reset</button>
                          <button className={styles.applyBtn} onClick={handleApplyFilters}>Apply</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {activeTab === "trending" && (
                <DexTable 
                  loading={trendingPools.isLoading || trendingPools.isValidating} 
                  data={trendingPools.data as any} 
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  filters={filters}
                />
              )}
              {activeTab === "top" && (
                <DexTable 
                  loading={topPools.isLoading || topPools.isValidating} 
                  data={topPools.data as any} 
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  filters={filters}
                />
              )}
              {activeTab === "gainers" && (
                <DexTable 
                  loading={trendingPools.isLoading || trendingPools.isValidating} 
                  data={trendingPools.data as any} 
                  sortKey={sortKey === "none" ? (trendingDuration as SortKey) : sortKey}
                  sortDirection={sortDirection}
                  filters={filters}
                />
              )}
              {activeTab === "newPairs" && (
                <DexTable 
                  loading={newPairs.isLoading} 
                  data={newPairs.data as any} 
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  filters={filters}
                />
              )}
            </Stack>
          </Column>
        </Grid>
      </Section>
    </PageWrapper>
  );
}
