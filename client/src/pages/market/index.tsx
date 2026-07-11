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
import { useLocalization } from "@/contexts/LocalizationContext";
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

type PoolMainTab =
  | "trending"
  | "top"
  | "gainers"
  | "newPairs"
  | "profitableTraders";
type PoolDuration = "5m" | "1h" | "6h" | "24h";
type TopSort = "volume" | "txns";
type TraderType = "today" | "1W" | "30d" | "90d";

const MAIN_TABS: Array<{ key: PoolMainTab }> = [
  { key: "trending" },
  { key: "top" },
  { key: "gainers" },
  { key: "newPairs" },
  { key: "profitableTraders" },
];

const TRADER_PERIODS: TraderType[] = ["today", "1W", "30d", "90d"];
const POOL_DURATIONS: PoolDuration[] = ["5m", "1h", "6h", "24h"];
const TOP_SORTS: TopSort[] = ["volume", "txns"];

function traderPeriodLabel(period: TraderType) {
  switch (period) {
    case "today":
      return "1D";
    case "1W":
      return "7D";
    case "30d":
      return "30D";
    case "90d":
      return "90D";
  }
}

export default function MarketPage() {
  const { tr } = useLocalization();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [trendingDuration, setTrendingDuration] =
    useState<PoolDuration>("5m");
  const [topSort, setTopSort] = useState<TopSort>("volume");
  const [traderType, setTraderType] = useState<TraderType>("1W");

  const [sortKey, setSortKey] = useState<SortKey>("5m");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<TableFilters>(INITIAL_FILTERS);
  const [tempFilters, setTempFilters] =
    useState<TableFilters>(INITIAL_FILTERS);

  const [isRankOpen, setIsRankOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeTab = MAIN_TABS[activeTabIndex]?.key ?? "trending";

  const rankRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rankRef.current && !rankRef.current.contains(event.target as Node)) {
        setIsRankOpen(false);
      }
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeTab === "gainers" || activeTab === "trending") {
      setSortKey(trendingDuration as SortKey);
      setSortDirection("desc");
    }
  }, [trendingDuration, activeTab]);

  const getTabLabel = (tab: PoolMainTab) => {
    switch (tab) {
      case "trending":
        return tr("marketPage.trending");
      case "top":
        return tr("marketPage.top");
      case "gainers":
        return tr("marketPage.topGainers");
      case "newPairs":
        return tr("marketPage.newPairs");
      case "profitableTraders":
        return tr("marketPage.profitableTraders");
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }

    if (["5m", "1h", "6h", "24h"].includes(key)) {
      setTrendingDuration(key as PoolDuration);
    }
    if (["volume", "txns"].includes(key)) {
      setTopSort(key as TopSort);
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

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: "5m", label: tr("marketPage.trending5m") },
    { key: "1h", label: tr("marketPage.trending1h") },
    { key: "6h", label: tr("marketPage.trending6h") },
    { key: "24h", label: tr("marketPage.trending24h") },
    { key: "txns", label: tr("marketPage.txns") },
    { key: "volume", label: tr("marketPage.volume") },
    { key: "marketCap", label: tr("marketPage.marketCap") },
    { key: "price", label: tr("marketPage.price") },
    { key: "liquidity", label: tr("marketPage.liquidity") },
    { key: "age", label: tr("marketPage.pairAge") },
  ];

  const filterOptions: Array<{
    label: string;
    key: keyof TableFilters;
    unit: string;
  }> = [
    { label: tr("marketPage.liquidity"), key: "liquidity", unit: "$" },
    { label: tr("marketPage.marketCap"), key: "mcap", unit: "$" },
    { label: tr("marketPage.volume24h"), key: "volume", unit: "$" },
    { label: tr("marketPage.txns24h"), key: "txns", unit: "" },
    { label: tr("marketPage.pairAgeHours"), key: "age", unit: "" },
    { label: tr("marketPage.change24h"), key: "change24h", unit: "%" },
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
    { enabled: activeTab == "trending" },
  );

  const topPools = useGet(
    client.api.tokens["market-pools"].top,
    200,
    { query: { sortBy: topSort } },
    { enabled: activeTab == "top" },
  );

  const topGainerPools = useGet(
    client.api.tokens["market-pools"].gainers,
    200,
    undefined,
    { enabled: activeTab == "gainers" },
  );
  const newPairs = useGet(
    client.api.tokens["market-pools"]["new-pairs"],
    200,
    undefined,
    { enabled: activeTab == "newPairs" },
  );

  const headings = useMemo(() => {
    switch (activeTab) {
      case "trending":
        return {
          title: tr("marketPage.trendingPools"),
          subtitle: tr("marketPage.trendingPoolsSubtitle"),
        };
      case "top":
        return {
          title: tr("marketPage.topPools"),
          subtitle: tr("marketPage.topPoolsSubtitle"),
        };
      case "gainers":
        return {
          title: tr("marketPage.topGainerPools"),
          subtitle: tr("marketPage.topGainerPoolsSubtitle"),
        };
      case "newPairs":
        return {
          title: tr("marketPage.newPairs"),
          subtitle: tr("marketPage.newPairsSubtitle"),
        };
      case "profitableTraders":
        return {
          title: tr("marketPage.profitableTraders"),
          subtitle: tr("marketPage.profitableTradersPoolsSubtitle"),
        };
      default:
        return {
          title: tr("marketPage.marketPools"),
          subtitle: tr("marketPage.marketPoolsSubtitle"),
        };
    }
  }, [activeTab, tr]);

  const dataToRender = useMemo(() => {
    switch (activeTab) {
      case "trending":
        return trendingPools.data;
      case "top":
        return topPools.data;
      case "gainers":
        return topGainerPools.data;
      case "newPairs":
        return newPairs.data;
      default:
        return [];
    }
  }, [
    activeTab,
    trendingPools.data,
    topPools.data,
    topGainerPools.data,
    newPairs.data,
  ]);

  const currentSortLabel =
    sortOptions.find((option) => option.key === sortKey)?.label ?? "";

  return (
    <PageWrapper>
      <Section className={styles.marketPage}>
        <Grid className={overwriteStyles.wdGrd}>
          <Column sm={2} md={8} lg={16}>
            <Stack className={styles.marketStack} gap={4}>
              <header className={styles.marketHero}>
                <div className={styles.radarEyebrow}>
                  <span className={styles.radarPulse} aria-hidden="true" />
                  Market Radar
                </div>
                <Txt block bold className={styles.marketTitle} size="lg">
                  {headings.title}
                </Txt>
                <Txt block className={styles.marketSubtitle}>
                  {headings.subtitle}
                </Txt>
              </header>

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
                        className={`${styles.activeTabContainer} ${
                          !hasSubfilters ? styles.noSubfilters : ""
                        }`}
                      >
                        <span className={styles.activeTabText}>
                          {tab.key === "trending" && <Growth size={16} />}
                          {tab.key === "top" && <ChartBar size={16} />}
                          {tab.key === "gainers" && <ArrowUp size={16} />}
                          {tab.key === "newPairs" && <Star size={16} />}
                          {tab.key === "profitableTraders" && (
                            <Trophy size={16} />
                          )}
                          {getTabLabel(tab.key)}
                        </span>

                        {tab.key === "profitableTraders" && (
                          <div className={styles.inlineFilters}>
                            {TRADER_PERIODS.map((period) => (
                              <button
                                key={period}
                                className={`${styles.inlineFilterBtn} ${
                                  traderType === period ? styles.active : ""
                                }`}
                                onClick={() => setTraderType(period)}
                              >
                                {traderPeriodLabel(period)}
                              </button>
                            ))}
                          </div>
                        )}

                        {(tab.key === "trending" || tab.key === "gainers") && (
                          <div className={styles.inlineFilters}>
                            {POOL_DURATIONS.map((duration) => (
                              <button
                                key={duration}
                                className={`${styles.inlineFilterBtn} ${
                                  trendingDuration === duration
                                    ? styles.active
                                    : ""
                                }`}
                                onClick={() => {
                                  setTrendingDuration(duration);
                                  setSortKey(duration);
                                  setSortDirection("desc");
                                }}
                              >
                                {duration}
                              </button>
                            ))}
                          </div>
                        )}

                        {tab.key === "top" && (
                          <div className={styles.inlineFilters}>
                            {TOP_SORTS.map((sort) => (
                              <button
                                key={sort}
                                className={`${styles.inlineFilterBtn} ${
                                  topSort === sort ? styles.active : ""
                                }`}
                                onClick={() => {
                                  setTopSort(sort);
                                  setSortKey(sort);
                                  setSortDirection("desc");
                                }}
                              >
                                {sort === "volume"
                                  ? tr("marketPage.volume")
                                  : tr("marketPage.txns")}
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
                          (candidate) => candidate.key === tab.key,
                        );
                        setActiveTabIndex(newIndex);

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
                      {getTabLabel(tab.key)}
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
                            {tr("marketPage.rankBy")}:{" "}
                            {`${
                              sortDirection === "desc" ? "↓" : "↑"
                            } ${currentSortLabel}`}
                          </span>
                          <ChevronDown size={16} />
                        </button>

                        {isRankOpen && (
                          <div className={styles.dropdown}>
                            <div className={styles.dropdownSection}>
                              <div className={styles.sectionTitle}>
                                {tr("marketPage.order")}
                              </div>
                              <div
                                className={styles.option}
                                onClick={() => {
                                  setSortDirection("desc");
                                  setIsRankOpen(false);
                                }}
                              >
                                {sortDirection === "desc" && (
                                  <Checkmark size={14} />
                                )}
                                <span>{tr("marketPage.descending")}</span>
                              </div>
                              <div
                                className={styles.option}
                                onClick={() => {
                                  setSortDirection("asc");
                                  setIsRankOpen(false);
                                }}
                              >
                                {sortDirection === "asc" && (
                                  <Checkmark size={14} />
                                )}
                                <span>{tr("marketPage.ascending")}</span>
                              </div>
                            </div>
                            <div className={styles.dropdownSection}>
                              <div className={styles.sectionTitle}>
                                {tr("marketPage.rankBy")}
                              </div>
                              {sortOptions.map((option) => (
                                <div
                                  key={option.key}
                                  className={styles.option}
                                  onClick={() => {
                                    handleSort(option.key);
                                    setIsRankOpen(false);
                                  }}
                                >
                                  {sortKey === option.key && (
                                    <Checkmark size={14} />
                                  )}
                                  <span>{option.label}</span>
                                </div>
                              ))}
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
                          <span>{tr("marketPage.filters")}</span>
                        </button>

                        {isFilterOpen && (
                          <div className={styles.filterPopup}>
                            <div className={styles.popupHeader}>
                              <span>{tr("marketPage.customizeFilters")}</span>
                              <Close
                                size={20}
                                className={styles.closeIcon}
                                onClick={() => setIsFilterOpen(false)}
                              />
                            </div>
                            <div className={styles.popupContent}>
                              {filterOptions.map((filter) => (
                                <div
                                  key={filter.key}
                                  className={styles.filterRow}
                                >
                                  <label>{filter.label}:</label>
                                  <div className={styles.inputGroup}>
                                    <div className={styles.inputWithUnit}>
                                      {filter.unit && (
                                        <span className={styles.unit}>
                                          {filter.unit}
                                        </span>
                                      )}
                                      <input
                                        type="number"
                                        placeholder={tr("marketPage.min")}
                                        value={tempFilters[filter.key].min || ""}
                                        onChange={(event) =>
                                          updateTempFilter(
                                            filter.key,
                                            "min",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className={styles.inputWithUnit}>
                                      {filter.unit && (
                                        <span className={styles.unit}>
                                          {filter.unit}
                                        </span>
                                      )}
                                      <input
                                        type="number"
                                        placeholder={tr("marketPage.max")}
                                        value={tempFilters[filter.key].max || ""}
                                        onChange={(event) =>
                                          updateTempFilter(
                                            filter.key,
                                            "max",
                                            event.target.value,
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
                                {tr("marketPage.reset")}
                              </button>
                              <button
                                className={styles.applyBtn}
                                onClick={handleApplyFilters}
                              >
                                {tr("marketPage.apply")}
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
                      (activeTab == "trending" &&
                        (trendingPools.isLoading ||
                          trendingPools.isValidating)) ||
                      (activeTab == "top" &&
                        (topPools.isLoading ||
                          topPools.isValidating)) ||
                      (activeTab == "gainers" &&
                        (topGainerPools.isLoading ||
                          topGainerPools.isValidating)) ||
                      (activeTab == "newPairs" &&
                        (newPairs.isLoading ||
                          newPairs.isValidating))
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
