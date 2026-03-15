import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { Close, Search as SearchIcon } from "@carbon/react/icons";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "react-router";
import { PoolResultItem, type PoolResult } from "./PoolResultItem";
import styles from "./SearchBar.module.scss";
import { TokenResultItem, type TokenResult } from "./TokenResultItem";
import { TokenStatsPanel } from "./TokenStatsPanel";

interface SearchBarProps {
  onClose: () => void;
}

export function SearchBar({ onClose }: SearchBarProps) {
  const { tr } = useLocalization();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [lastFocusedToken, setLastFocusedToken] = useState<TokenResult | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchResults = useGet(
    client.api.search,
    200,
    { query: { q: debouncedQuery } },
    {
      enabled: debouncedQuery.trim().length > 0,
      select: (data) => ({
        tokens: data.tokens.map(
          (token): TokenResult => ({
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            imgUrl: token.imgUrl,
            priceUsd: token.priceUsd,
            priceChangePercentage24h: token.priceChangePercentage24h ?? 0,
            sparkline7d: token.sparkline7d,
            marketCap: token.marketCap,
            volume24h: token.volume24h,
          }),
        ),
        pools: data.pools.map(
          (pool): PoolResult => ({
            id: pool.id || "",
            address: pool.attributes?.address ?? null,
            name: pool.attributes?.name ?? null,
            dexId: pool.relationships?.dex?.data?.id ?? null,
            baseTokenImg: pool.baseTokenImg ?? null,
            quoteTokenImg: pool.quoteTokenImg ?? null,
          }),
        ),
      }),
    },
  );

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key == "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleInput = (value: string) => {
    setQuery(value);
    setFocusedIdx(-1);
    setHoveredIdx(-1);
    setLastFocusedToken(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 320);
  };

  const selectToken = useCallback(
    (token: TokenResult) => {
      navigate(`/tokens/${token.address}`);
      onClose();
    },
    [navigate, onClose],
  );

  const selectPool = useCallback(
    (pool: PoolResult) => {
      const tokenId = pool.id.split("_")[1] || null;
      if (tokenId && pool.address) {
        navigate(`/tokens/${tokenId}/${pool.address}`);
        onClose();
      }
    },
    [navigate, onClose],
  );

  const tokenResults = searchResults.data?.tokens ?? [];
  const poolResults = searchResults.data?.pools ?? [];
  const totalResults = tokenResults.length + poolResults.length;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (totalResults == 0) return;

    if (e.key == "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, totalResults - 1));
    } else if (e.key == "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key == "Enter" && focusedIdx >= 0) {
      e.preventDefault();
      if (focusedIdx < tokenResults.length) {
        selectToken(tokenResults[focusedIdx]);
      } else {
        selectPool(poolResults[focusedIdx - tokenResults.length]);
      }
    }
  };

  const isEmpty =
    !searchResults.isLoading && debouncedQuery.trim() && totalResults == 0;
  const showEmpty = !searchResults.isLoading && !debouncedQuery.trim();

  // Active token for the stats panel (hover takes priority over keyboard focus)
  const activeIdx = hoveredIdx >= 0 ? hoveredIdx : focusedIdx;
  const activeToken =
    activeIdx >= 0 && activeIdx < tokenResults.length
      ? tokenResults[activeIdx]
      : null;

  // Persist the last hovered/focused token
  useEffect(() => {
    if (activeToken) {
      setLastFocusedToken(activeToken);
    }
  }, [activeToken]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/*Search Input*/}
        <div className={styles.inputRow}>
          <SearchIcon size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={query}
            placeholder={tr("nav.searchPlaceholder")}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={tr("nav.search")}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              className={styles.clearBtn}
              onClick={() => handleInput("")}
              aria-label="Clear"
              type="button"
            >
              <Close size={16} />
            </button>
          )}
        </div>

        {/*Results + Stats*/}
        <div className={styles.mainArea}>
          <div className={styles.results}>
            {showEmpty && (
              <p className={styles.stateMsg}>{tr("nav.searchHint")}</p>
            )}
            {searchResults.isLoading && (
              <p className={styles.stateMsg}>{tr("nav.searchLoading")}</p>
            )}
            {isEmpty && (
              <p className={styles.stateMsg}>{tr("nav.searchNoResults")}</p>
            )}

            {!searchResults.isLoading && totalResults > 0 && (
              <div className={styles.scrollArea}>
                {tokenResults.length > 0 && (
                  <>
                    <p className={styles.sectionLabel}>
                      {tr("nav.searchTokens")}
                    </p>
                    {tokenResults.map((token, idx) => (
                      <TokenResultItem
                        key={token.address}
                        token={token}
                        isFocused={idx == focusedIdx || idx == hoveredIdx}
                        onSelect={selectToken}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(-1)}
                      />
                    ))}
                  </>
                )}

                {poolResults.length > 0 && (
                  <>
                    <p className={styles.sectionLabel}>
                      {tr("nav.searchPools")}
                    </p>
                    {poolResults.map((pool, idx) => {
                      const actualIdx = tokenResults.length + idx;
                      return (
                        <PoolResultItem
                          key={pool.id}
                          pool={pool}
                          isFocused={
                            actualIdx == focusedIdx || actualIdx == hoveredIdx
                          }
                          onSelect={selectPool}
                          onMouseEnter={() => setHoveredIdx(actualIdx)}
                          onMouseLeave={() => setHoveredIdx(-1)}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          <TokenStatsPanel token={activeToken || lastFocusedToken} />
        </div>

        {/*Keyboard Hints*/}
        <div className={styles.hint}>
          <div>
            <kbd>↑</kbd> <kbd>↓</kbd> {tr("nav.searchNavigate")}
          </div>
          <div>
            <kbd>↵</kbd> {tr("nav.searchSelect")}
          </div>
          <div>
            <kbd>ESC</kbd> {tr("nav.searchClose")}
          </div>
        </div>
      </div>
    </div>
  );
}
