import client from "@/api/main";
import { Flex } from "@/components/Flex";
import { TknImg } from "@/components/TknImg";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet, UseGetResp } from "@/hooks/useGet";
import { InlineLoading, Search } from "@carbon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TrendNum } from "../TrendNum";
import { Txt } from "../Txt";
import styles from "./TokenSearch.module.scss";

export interface SelectedTokenValue {
  address: string;
  symbol: string | null;
  name: string | null;
  imgUrl: string | null;
}

interface TokenSearchProps {
  setValue: (value: SelectedTokenValue | null) => void;
  closePanel: () => void;
}

interface TokenSearchResult {
  address: string;
  name: string | null;
  symbol: string | null;
  imgUrl: string | null;
  priceChangePercentage24h: number | null;
}

export default function TokenSearch({
  setValue,
  closePanel,
}: TokenSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fmt } = useLocalization();

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchResults: UseGetResp<TokenSearchResult[]> = useGet(
    client.api.search,
    200,
    { query: { q: debouncedQuery } },
    {
      enabled: debouncedQuery.trim().length > 0,
      select: (data): TokenSearchResult[] =>
        data.tokens.map((token) => {
          const address = token.address;
          const symbol = token.symbol;

          return {
            address,
            name: token.name,
            symbol,
            imgUrl: token.imgUrl,
            priceChangePercentage24h: token.priceChangePercentage24h,
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

  const tokens = useMemo(() => searchResults.data ?? [], [searchResults.data]);
  const showHint = !searchResults.isLoading && !debouncedQuery.trim();
  const showEmpty =
    !searchResults.isLoading &&
    debouncedQuery.trim().length > 0 &&
    tokens.length == 0;

  return (
    <Flex dir="column">
      <div className={styles.searchRow}>
        <Search
          size="md"
          labelText="Search for token"
          placeholder="Search by symbol"
          value={query}
          onChange={(event) => handleInput(event.target.value)}
        />
      </div>

      <Flex justify="between" align="center" pInline={8} pBlockStart={8}>
        <Txt size="sm" secondary>
          Token
        </Txt>
        <Txt size="sm" secondary>
          24h change
        </Txt>
      </Flex>

      <Flex dir="column" className={styles.list}>
        {showHint && (
          <Flex pInline={8} pBlock={6}>
            <Txt size="sm" secondary>
              Type to search token
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
          tokens.length > 0 &&
          tokens.map((token) => (
            <button
              key={token.address}
              type="button"
              className={styles.item}
              onClick={() => {
                setValue({
                  address: token.address,
                  symbol: token.symbol,
                  name: token.name,
                  imgUrl: token.imgUrl,
                });
                closePanel();
              }}
            >
              <Flex justify="between" align="center" pInline={8} pBlock={5}>
                <Flex align="center" gap={4}>
                  <TknImg size={24} src={token.imgUrl} alt={token.symbol} />
                  <Flex dir="column" rowGap={1}>
                    <span className={styles.symbol}>{token.symbol}</span>
                    {token.name && (
                      <span className={styles.name}>{token.name}</span>
                    )}
                  </Flex>
                </Flex>
                <TrendNum
                  value={token.priceChangePercentage24h}
                  formatter={fmt.num.percent}
                />
              </Flex>
            </button>
          ))}
      </Flex>
    </Flex>
  );
}
