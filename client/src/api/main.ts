// Due to IDE performance issue on massive type inferrence,
// the client type has been broken into smaller modules for each
// route
import { hc } from "hono/client";
import type { AppRouteOf, AppRoutes, ErrCode } from "@sv/main.js";

const apiDomain: string = import.meta.env.VITE_CLIENT_API_DOMAIN || "";

function hcc<Route extends keyof AppRoutes>(
  route: Route,
): ReturnType<typeof hc<AppRouteOf<Route>>> {
  return hc<AppRouteOf<Route>>(`${apiDomain}${route}`, {
    init: { credentials: "include" },
  });
}

type ClientTypeOf<Route extends keyof AppRoutes> = ReturnType<
  typeof hcc<Route>
>;

type UsersClient = ClientTypeOf<"/api/users">;
type TokenClient = ClientTypeOf<"/api/tokens">;
type MiscClient = ClientTypeOf<"/api/misc">;
type ProfileClient = ClientTypeOf<"/api/profile">;
type SearchClient = ClientTypeOf<"/api/search">;
type TransactionsClient = ClientTypeOf<"/api/transactions">;
type BalancesClient = ClientTypeOf<"/api/balances">;
type TransfersClient = ClientTypeOf<"/api/transfers">;
type ChartRouteClient = ClientTypeOf<"/api/charts">;
type TradesClient = ClientTypeOf<"/api/trades">;
type WalletsRouteClient = ClientTypeOf<"/api/wallets">;
type WalletTagsRouteClient = ClientTypeOf<"/api/walletTags">;
type AlertsClient = ClientTypeOf<"/api/alerts">;
type AlertsHpClient = ClientTypeOf<"/api/alertsHp">;
type NewsClient = ClientTypeOf<"/api/news">;
type PaymentClient = ClientTypeOf<"/api/payment">;

export type ApiClient = {
  api: {
    users: UsersClient;
    tokens: TokenClient;
    misc: MiscClient;
    profile: ProfileClient;
    search: SearchClient;
    transactions: TransactionsClient;
    balances: BalancesClient;
    transfers: TransfersClient;
    charts: ChartRouteClient;
    trades: TradesClient;
    wallets: WalletsRouteClient;
    walletTags: WalletTagsRouteClient;
    alerts: AlertsClient;
    alertsHp: AlertsHpClient;
    news: NewsClient;
    payment: PaymentClient;
  };
};

const client: ApiClient = {
  api: {
    users: hcc("/api/users"),
    tokens: hcc("/api/tokens"),
    misc: hcc("/api/misc"),
    profile: hcc("/api/profile"),
    search: hcc("/api/search"),
    transactions: hcc("/api/transactions"),
    balances: hcc("/api/balances"),
    transfers: hcc("/api/transfers"),
    charts: hcc("/api/charts"),
    trades: hcc("/api/trades"),
    wallets: hcc("/api/wallets"),
    walletTags: hcc("/api/walletTags"),
    alerts: hcc("/api/alerts"),
    alertsHp: hcc("/api/alertsHp"),
    news: hcc("/api/news"),
    payment: hcc("/api/payment"),
  },
};

export default client;
export type ApiErrCode = ErrCode;

// client.api.tokens.markets.chart[":address"].daily.$get({
//   query: {
//     days: ,
//   },
// });
