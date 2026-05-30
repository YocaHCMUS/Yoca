import { db } from "./src/db/index.js";
import { walletBalanceHistory } from "./src/db/wallets.js";
import { eq } from "drizzle-orm";

const rows = await db
  .select()
  .from(walletBalanceHistory)
  .where(eq(walletBalanceHistory.address, "EG8XbqqyNmBLHMP2Y2wyPbMX8c6J12YG8KM4GmvWvUeV"))
  .orderBy(walletBalanceHistory.timestampMs);

console.log("count:", rows.length);
rows.forEach(r => console.log(new Date(r.timestampMs).toISOString().slice(0, 10), "$" + r.usdValue));
