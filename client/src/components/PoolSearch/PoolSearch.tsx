import client from "@/api/main";
import { Flex } from "@/components/Flex";
import { TknImg } from "@/components/TknImg";
import { useGet } from "@/hooks/useGet";
import { InlineLoading, Search } from "@carbon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Txt } from "../Txt";
import styles from "./PoolSearch.module.scss";

export interface SelectedPoolValue {
  address: string;
  name: string | null;
  baseTokenAddress: string | null;
  baseTokenSymbol: string | null;
  baseTokenImg: string | null;
  quoteTokenAddress: string | null;
  quoteTokenSymbol: string | null;
  quoteTokenImg: string | null;
}

interface PoolSearchProps {
  setValue: (value: SelectedPoolValue | null) => void;
  closePanel: () => void;
}

interface PoolSearchResult {
  address: string;
  name: string | null;
  baseTokenAddress: string | null;
  baseTokenSymbol: string | null;
  baseTokenImg: string | null;
  quoteTokenAddress: string | null;
  quoteTokenSymbol: string | null;
  quoteTokenImg: string | null;
}

export default function PoolSearch({ setValue, closePanel }: PoolSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchResults = useGet(
    client.api.search,
    200,
    { query: { q: debouncedQuery } },
    {
      enabled: debouncedQuery.trim().length > 0,
      select: (data): PoolSearchResult[] =>
        data.pools.map((pool) => {
          return {
            address: pool.address,
            name: pool.name,
            baseTokenAddress: pool.baseToken?.address || null,
            baseTokenSymbol: pool.baseToken?.symbol || null,
            baseTokenImg: pool.baseToken?.imgUrl || null,
            quoteTokenAddress: pool.quoteToken?.address || null,
            quoteTokenSymbol: pool.quoteToken?.symbol || null,
            quoteTokenImg: pool.quoteToken?.imgUrl || null,
          };
        }),
    },
  );

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 320);
  };

  const pools = useMemo(() => searchResults.data ?? [], [searchResults.data]);
  const showHint = !searchResults.isLoading && !debouncedQuery.trim();
  const showEmpty =
    !searchResults.isLoading &&
    debouncedQuery.trim().length > 0 &&
    pools.length == 0;

  return (
    <Flex dir="column">
      <div className={styles.searchRow}>
        <Search
          size="md"
          labelText="Search for pool"
          placeholder="Search by token pair"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
        />
      </div>

      <Flex justify="between" align="center" pInline={8} pBlockStart={8}>
        <Txt size="sm" secondary>
          Pool
        </Txt>
      </Flex>

      <Flex dir="column" className={styles.list}>
        {showHint && (
          <Flex pInline={8} pBlock={6}>
            <Txt size="sm" secondary>
              Type to search pool
            </Txt>
          </Flex>
        )}
        {searchResults.isLoading && (
          <Flex pInline={8} pBlock={6}>
            <InlineLoading description="Loading..." />
          </Flex>
        )}
        {showEmpty && (
          <Flex pInline={8} pBlock={6}>
            <Txt size="sm" secondary>
              No result
            </Txt>
          </Flex>
        )}

        {!searchResults.isLoading &&
          pools.length > 0 &&
          pools.map((pool) => (
            <button
              key={pool.address}
              type="button"
              className={styles.item}
              onClick={() => {
                setValue({
                  address: pool.address,
                  name: pool.name,
                  baseTokenAddress: pool.baseTokenAddress,
                  baseTokenSymbol: pool.baseTokenSymbol,
                  baseTokenImg: pool.baseTokenImg,
                  quoteTokenAddress: pool.quoteTokenAddress,
                  quoteTokenSymbol: pool.quoteTokenSymbol,
                  quoteTokenImg: pool.quoteTokenImg,
                });
                closePanel();
              }}
            >
              <Flex justify="between" align="center" pInline={8} pBlock={5}>
                <Flex align="center" gap={4}>
                  <Flex align="center" gap={-2} style={{ zIndex: 2 }}>
                    <TknImg
                      size={24}
                      src={pool.baseTokenImg}
                      alt={pool.baseTokenSymbol}
                    />
                    <span style={{ marginLeft: -12 }}>
                      <TknImg
                        size={24}
                        src={pool.quoteTokenImg}
                        alt={pool.quoteTokenSymbol}
                      />
                    </span>
                  </Flex>
                  <Flex dir="column" rowGap={1}>
                    <span className={styles.symbol}>
                      {pool.baseTokenSymbol}/{pool.quoteTokenSymbol}
                    </span>
                    {pool.name && (
                      <span className={styles.name}>{pool.name}</span>
                    )}
                  </Flex>
                </Flex>
              </Flex>
            </button>
          ))}
      </Flex>
    </Flex>
  );
}
