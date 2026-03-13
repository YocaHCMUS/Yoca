import client from "@/api/main";

/**
 * Fetch the custom tags for a wallet for the authenticated user.
 * Returns an empty array if the user has no tags for this wallet.
 */
export async function fetchWalletTags(walletAddress: string): Promise<string[]> {
  const response = await (client.api as any).walletTags.$get({
    query: { address: walletAddress },
  });
  if (response.status === 401) return [];
  if (!response.ok) throw new Error(`Failed to fetch wallet tags: ${response.status}`);
  const data = await response.json();
  return (data as { tags: string[] }).tags ?? [];
}

/**
 * Save custom tags for a wallet for the authenticated user.
 * Throws if the user is not authenticated.
 */
export async function saveWalletTags(
  walletAddress: string,
  tags: string[],
): Promise<void> {
  const response = await (client.api as any).walletTags.$put({
    json: { address: walletAddress, tags },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as any)?.error ?? `Failed to save wallet tags: ${response.status}`);
  }
}
