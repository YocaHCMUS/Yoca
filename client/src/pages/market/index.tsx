import client from "@/api/main";
import { PageWrapper } from "@/components/wrapper";
import { useGet } from "@/hooks/useGet";

export default function MarketPage() {
  // const [activeTab, setActiveTab] = useState<TabType>("overview");

  const top = useGet(client.api.tokens["top-marketcap"], 200);

  return (
    <PageWrapper>
      <></>
      {/* <div className={styles.marketPage}>
        {/* <TickerBar /> */}
      {/* <main className={styles.content}>
          <MarketTabs activeTab={activeTab} onTabChange={setActiveTab}>
            {{
              overview: <OverviewTab />,
              fundamental: <FundamentalTab />,
              profitloss: <ProfitLossTab />,
              futures: <FuturesTab />,
            }}
          </MarketTabs>
        </main> */}
      {/* </div> */}
      {/* <Tble
        loading={top.isLoading}
        headers={
          top.data ? [
            {
              key: "rank",
              header: "#Rank",
            },
            {
              key: "token",
              header: "Token",
            },
            {
              key: "price",
              header: "Price",
            },
            {
              key: "percentageChange1h",
              header: "1h",
            },
            {
              key: "percentageChange1h",
              header: "24h",
            },
            {
              key: "percentageChange1h",
              header: "7d",
            },
            {
              key: "volume24h",
              header: "24h Volume",
            },
            {
              key: "marketCap",
              header: "Market Cap",
            },
          ] : []
        }
        rows={top.data.map((data) => ({
          id: "rank",
          rank: data.rank,
          token: (
            <Stack
              orientation="horizontal"
              gap={1}
              style={{ justifyContent: "start" }}
              
            >
              <img src={data.marketData.}></img>
            </Stack>
          ),
        }))}
      /> */}
    </PageWrapper>
  );
}
