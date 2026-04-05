import * as hl from "@sv/util/util-helius.js";

export async function getWalletFirstFund(wallet: string) {
  const res = await hl.client.wallet.getFundedBy({
    wallet,
  });
  return res.date;
}
