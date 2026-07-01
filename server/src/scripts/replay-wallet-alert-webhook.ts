import "@sv/util/load-env.js";
import {
  processHeliusWebhookTransactions,
  type HeliusEnhancedTransaction,
} from "@sv/services/walletAlerts.service.js";
import { readFile } from "node:fs/promises";
import path from "node:path";

function usage(): never {
  console.error(
    "Usage: npm run alerts:replay -- <fixture.json> [--dryRun] [--send]",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const fixtureArg = args.find((arg) => !arg.startsWith("--"));
if (!fixtureArg) usage();
const fixtureFile = fixtureArg;

async function main() {
  const dryRun = !args.includes("--send");
  const fixturePath = path.resolve(process.cwd(), fixtureFile);
  const text = await readFile(fixturePath, "utf8");
  const payload = JSON.parse(text) as unknown;
  const transactions = Array.isArray(payload)
    ? (payload as HeliusEnhancedTransaction[])
    : Array.isArray((payload as { transactions?: unknown }).transactions)
      ? ((payload as { transactions: HeliusEnhancedTransaction[] })
          .transactions)
      : null;

  if (!transactions) {
    console.error("Fixture must be a Helius enhanced webhook array.");
    process.exit(1);
  }

  const summary = await processHeliusWebhookTransactions(transactions, {
    dryRun,
    dedupe: false,
    log: true,
  });

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

void main();
