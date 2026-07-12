import {
  getNextCursor,
  getTokenLogoUri,
  mapHeliusTransferEntry,
  toFiniteNumber,
  toIsoTimestamp,
  toOptionalNumber,
  toTokenAmount,
} from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { describe, expect, it } from "vitest";

describe("wallet provider mappers", () => {
  it("normalizes provider cursor and optional logo variants", () => {
    expect(getNextCursor({ nextCursor: "cursor-2" })).toBe("cursor-2");
    expect(getNextCursor({ nextCursor: "" })).toBeNull();
    expect(getNextCursor({ nextCursor: 12 })).toBeNull();
    expect(getTokenLogoUri({ logo_uri: " https://cdn.example/token.png " })).toBe(
      "https://cdn.example/token.png",
    );
    expect(getTokenLogoUri({ image: "   " })).toBeUndefined();
  });

  it("keeps malformed optional numbers from becoming NaN", () => {
    expect(toOptionalNumber(null)).toBeNull();
    expect(toOptionalNumber("not-a-number")).toBeNull();
    expect(toFiniteNumber("not-a-number", 7)).toBe(7);
    expect(toTokenAmount("1250000", 6, 0)).toBe(1.25);
    expect(toTokenAmount(undefined, undefined, "2.5")).toBe(2.5);
  });

  it("normalizes seconds, milliseconds and long fractional timestamps", () => {
    expect(toIsoTimestamp(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
    expect(toIsoTimestamp(1_700_000_000_000)).toBe(
      "2023-11-14T22:13:20.000Z",
    );
    expect(toIsoTimestamp("2026-01-02T03:04:05.123456Z")).toBe(
      "2026-01-02T03:04:05.123Z",
    );
    expect(toIsoTimestamp("invalid")).toBeNull();
  });

  it("maps inbound and outbound Helius transfers without guessing missing identity", () => {
    expect(
      mapHeliusTransferEntry(
        {
          timestamp: 1_700_000_000,
          direction: "in",
          counterparty: "SenderWallet",
          signature: "signature-in",
          mint: "TokenMint",
          symbol: "TOK",
          amountRaw: "1250000",
          decimals: 6,
        },
        "ObservedWallet",
      ),
    ).toMatchObject({
      from: "SenderWallet",
      to: "ObservedWallet",
      amount: 1.25,
      tokenAddress: "TokenMint",
      tokenSymbol: "TOK",
      transactionSignature: "signature-in",
    });

    expect(
      mapHeliusTransferEntry(
        {
          timestamp: 1_700_000_000,
          direction: "out",
          counterparty: "ReceiverWallet",
          signature: "signature-out",
          amount: 2,
        },
        "ObservedWallet",
      ),
    ).toMatchObject({
      from: "ObservedWallet",
      to: "ReceiverWallet",
      amount: 2,
    });
    expect(mapHeliusTransferEntry({ signature: "missing-time" }, "wallet")).toBeNull();
    expect(mapHeliusTransferEntry({ timestamp: 1_700_000_000 }, "wallet")).toBeNull();
  });
});
