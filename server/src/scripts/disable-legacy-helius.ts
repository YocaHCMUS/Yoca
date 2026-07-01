import "@sv/util/load-env.js";
import { disableLegacyHeliusWebhook } from "@sv/services/heliusWebhooks.service.js";

function printManualSteps(steps: string[] | undefined) {
  if (!steps || steps.length === 0) return;
  console.error("Manual dashboard steps:");
  steps.forEach((step, index) => {
    console.error(`${index + 1}. ${step}`);
  });
}

async function main() {
  const result = await disableLegacyHeliusWebhook();

  if (result.skipped && result.ok) {
    console.log(result.message);
    process.exit(0);
  }

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error(result.message);
    if (result.verification && result.verification.errors.length > 0) {
      console.error("Verification errors:");
      for (const error of result.verification.errors) {
        console.error(`- ${error}`);
      }
    }
    if (result.deleteResult && !result.deleteResult.ok) {
      console.error("Helius delete failed:");
      console.error(
        JSON.stringify(
          {
            status: result.deleteResult.status ?? null,
            body: result.deleteResult.body ?? null,
            error: result.deleteResult.error ?? null,
          },
          null,
          2,
        ),
      );
    }
    printManualSteps(result.manualSteps);
    process.exit(1);
  }

  console.log(result.message);
  process.exit(0);
}

void main();
