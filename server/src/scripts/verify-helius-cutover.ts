import "@sv/util/load-env.js";
import { verifyHeliusCutover } from "@sv/services/heliusWebhooks.service.js";

async function main() {
  const result = await verifyHeliusCutover();
  console.log(JSON.stringify(result, null, 2));

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of result.warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (!result.ok) {
    console.error("Helius cutover verification failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Helius cutover verification passed.");
  process.exit(0);
}

void main();
