import { clusterApiUrl, Connection } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

/**
 * Valid Solana cluster identifiers accepted by `@solana/web3.js`.
 * This list is the source of truth — do NOT add values here without
 * verifying that `clusterApiUrl()` and `WalletAdapterNetwork` support them.
 */
const VALID_NETWORKS = ["devnet", "testnet", "mainnet-beta"] as const;
export type SolanaNetwork = (typeof VALID_NETWORKS)[number];

/**
 * Maps a validated SolanaNetwork string to the WalletAdapterNetwork enum
 * required by `@solana/wallet-adapter-base`.
 */
const NETWORK_TO_ADAPTER: Record<SolanaNetwork, WalletAdapterNetwork> = {
  devnet: WalletAdapterNetwork.Devnet,
  testnet: WalletAdapterNetwork.Testnet,
  "mainnet-beta": WalletAdapterNetwork.Mainnet,
};

/**
 * Reads and strictly validates `VITE_SOLANA_NETWORK` from the Vite env.
 *
 * @throws {Error} A clear, human-readable error if the variable is missing,
 *   empty, or set to an unrecognized cluster name. This error is designed to
 *   be caught by the calling UI layer and surfaced as a toast/alert.
 *
 * @returns The validated network string as `SolanaNetwork`.
 *
 * @example
 * try {
 *   const network = getValidatedSolanaNetwork();
 * } catch (err) {
 *   toast.error(err.message); // "System Error: Missing network configuration in .env"
 * }
 */
export function getValidatedSolanaNetwork(): SolanaNetwork {
  const raw = import.meta.env.VITE_SOLANA_NETWORK as string | undefined;

  if (!raw || raw.trim() === "") {
    throw new Error(
      "System Error: Missing network configuration in .env — VITE_SOLANA_NETWORK is not set."
    );
  }

  const trimmed = raw.trim();

  if (!VALID_NETWORKS.includes(trimmed as SolanaNetwork)) {
    throw new Error(
      `System Error: Invalid VITE_SOLANA_NETWORK value "${trimmed}". ` +
        `Must be one of: ${VALID_NETWORKS.join(", ")}.`
    );
  }

  return trimmed as SolanaNetwork;
}

/**
 * Returns the `WalletAdapterNetwork` enum value that corresponds to the
 * validated env variable. Use this when configuring wallet adapters.
 *
 * @throws {Error} Propagates from `getValidatedSolanaNetwork()`.
 */
export function getWalletAdapterNetwork(): WalletAdapterNetwork {
  return NETWORK_TO_ADAPTER[getValidatedSolanaNetwork()];
}

/**
 * Builds and returns a `@solana/web3.js` `Connection` instance whose
 * endpoint is derived dynamically from `VITE_SOLANA_NETWORK`.
 *
 * Uses `clusterApiUrl()` for the public RPC endpoint. If you need a
 * private RPC (e.g., Helius), replace `clusterApiUrl(network)` with
 * `import.meta.env.VITE_SOLANA_RPC_URL` and add its own validation.
 *
 * @throws {Error} Propagates from `getValidatedSolanaNetwork()`.
 */
export function getDynamicConnection(): Connection {
  const network = getValidatedSolanaNetwork();
  return new Connection(clusterApiUrl(network), "confirmed");
}
