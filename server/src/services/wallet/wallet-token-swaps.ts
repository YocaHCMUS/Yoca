import { getTrackedApiResult } from "@sv/middlewares/validation";
import * as hl from "@sv/util/util-helius";
import * as mrl from "@sv/util/util-moralis";
import { mrl_WalletTokenSwapsSchema } from "../_types/wallet-raw-responses";

export async function getWalletFirstFund(wallet: string) {
  const res = await hl.client.wallet.getFundedBy({
    wallet,
  });
  return res.date;
}

export async function getWalletTokenSwaps(
  walletAddress: string,
  tokenAddress: string,
) {
  // https://docs.moralis.com/data-api/solana/wallet/wallet-swaps
  const mrlEnpoint = mrl.getEndpoint(`/account/mainnet/${walletAddress}/swaps`);
  mrlEnpoint.search = new URLSearchParams({
    limit: "10",
    order: "DESC",
    tokenAddress,
  }).toString();

  const req = new Request(mrlEnpoint, {
    method: "GET",
    headers: mrl.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  const res = await getTrackedApiResult(mrl_WalletTokenSwapsSchema, resp);

  if (!res) {
    return null;
  }
}
