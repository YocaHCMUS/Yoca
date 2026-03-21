import * as bds from "@sv/util/util-bitquery.js";
import type { BDS_WalletFirstFund } from "../_types/wallet_raw_responses.js";

export async function getWalletFirstFund(wallets: string[]) {
  const bdsEndpoint = bds.getEndpoint("/wallet/v2/tx/first-funded");
  const req = new Request(bdsEndpoint, {
    method: "POST",
    headers: bds.getRequiredHeaders(),
    body: JSON.stringify({
      wallets,
    }),
  });

  const resp = await fetch(req);
  if (!resp.ok) {
    console.log(resp.status);
    return null;
  }

  const res: BDS_WalletFirstFund = await resp.json();

  if (!res.success) {
    console.log(await resp.json());
    return null;
  }

  const addressToFirstFund = Object.fromEntries(
    Object.entries(res.data).map(([address, data]) => [
      address,
      { timestamp: data.block_unix_time },
    ]),
  );

  return addressToFirstFund;
}
