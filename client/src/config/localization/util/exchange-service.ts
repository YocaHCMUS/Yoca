import client from "@/api/main";

let _usdToVndRate = 25_000;

export function getUsdToVndRate(): number {
  return _usdToVndRate;
}

export async function refreshUsdToVndRate(): Promise<void> {
  try {
    const resp = await client.api.misc["exchange-rates"].$get();
    if (!resp.ok) return;
    const data = await resp.json();
    const usd: number | undefined = data?.rates?.usd?.value;
    const vnd: number | undefined = data?.rates?.vnd?.value;
    if (usd && vnd && usd > 0) {
      _usdToVndRate = vnd / usd;
    }
  } catch {
    // Keep fallback value on any network error
  }
}

// Fetch on module load
refreshUsdToVndRate();