import {
  Connection,
  PublicKey,
  type ParsedAccountData,
} from "@solana/web3.js";
import { getNextkey } from "@sv/util/util-helius.js";

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";

export type TokenAuthorityStatus = "revoked" | "active" | "unknown";

export interface TokenSecurityContext {
  available: boolean;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  mintAuthorityStatus: TokenAuthorityStatus;
  freezeAuthorityStatus: TokenAuthorityStatus;
  tokenProgram?: string;
  supply?: string;
  decimals?: number;
  isInitialized?: boolean;
  interpretation?: string;
  warnings: string[];
}

function createMainnetRpcConnection() {
  const apiKey = getNextkey();
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
  return new Connection(rpcUrl, "confirmed");
}

function statusForAuthority(value: string | null | undefined) {
  if (value === null) return "revoked";
  if (typeof value === "string" && value.trim().length > 0) return "active";
  return "unknown";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function unavailable(warning: string): TokenSecurityContext {
  return {
    available: false,
    mintAuthorityStatus: "unknown",
    freezeAuthorityStatus: "unknown",
    warnings: [warning],
  };
}

export async function getTokenSecurityContext(
  mintAddress: string,
): Promise<TokenSecurityContext> {
  const address = mintAddress.trim();

  try {
    const mint = new PublicKey(address);
    const connection = createMainnetRpcConnection();
    const account = await connection.getParsedAccountInfo(mint);
    const accountInfo = account.value;

    if (!accountInfo) {
      return unavailable("Mint account was not found on Solana RPC.");
    }

    const data = accountInfo.data;
    if (!("parsed" in data)) {
      return unavailable("Mint account is not available as parsed token data.");
    }

    const parsed = data as ParsedAccountData;
    if (parsed.parsed?.type !== "mint") {
      return unavailable("Account is not a parsed SPL token mint.");
    }

    const info = (parsed.parsed.info ?? {}) as Record<string, unknown>;
    const mintAuthority =
      optionalString(info.mintAuthority) ?? (info.mintAuthority == null ? null : undefined);
    const freezeAuthority =
      optionalString(info.freezeAuthority) ??
      (info.freezeAuthority == null ? null : undefined);
    const wrappedSol = address === WRAPPED_SOL_MINT;

    return {
      available: true,
      mintAuthority,
      freezeAuthority,
      mintAuthorityStatus: statusForAuthority(mintAuthority),
      freezeAuthorityStatus: statusForAuthority(freezeAuthority),
      tokenProgram: accountInfo.owner.toBase58(),
      supply: optionalString(info.supply),
      decimals: optionalNumber(info.decimals),
      isInitialized:
        typeof info.isInitialized === "boolean" ? info.isInitialized : undefined,
      interpretation: wrappedSol
        ? "Wrapped SOL tracks native SOL; its price and risk mainly reflect SOL market conditions."
        : undefined,
      warnings: [],
    };
  } catch (err) {
    return unavailable(
      err instanceof Error
        ? `Solana mint authority lookup failed: ${err.message}`
        : "Solana mint authority lookup failed.",
    );
  }
}
