import {
  runCursorPagination,
  runOffsetPagination,
} from "@sv/services/wallet/fetchers/walletPagination.js";
import { describe, expect, it, vi } from "vitest";

describe("wallet provider pagination", () => {
  it("collects cursor pages and stops at provider end", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ pageItems: [1, 2], nextCursor: "c2", hasMore: true })
      .mockResolvedValueOnce({ pageItems: [3], nextCursor: null, hasMore: false });

    const result = await runCursorPagination({
      maxPages: 5,
      maxItems: 10,
      fetchPage,
    });

    expect(result).toMatchObject({
      items: [1, 2, 3],
      cursor: null,
      hasMore: false,
      pagesFetched: 2,
      stopReason: "provider-end",
    });
    expect(fetchPage).toHaveBeenNthCalledWith(1, null, 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "c2", 2);
  });

  it("stops cursor pagination when the provider repeats a cursor", async () => {
    const result = await runCursorPagination({
      maxPages: 5,
      maxItems: 10,
      fetchPage: vi.fn().mockResolvedValue({
        pageItems: [1],
        nextCursor: "same-cursor",
        hasMore: true,
      }),
    });

    expect(result.stopReason).toBe("stagnant");
    expect(result.pagesFetched).toBe(2);
    expect(result.items).toEqual([1, 1]);
  });

  it("stops at max items without requesting another cursor page", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      pageItems: [1, 2, 3],
      nextCursor: "c2",
      hasMore: true,
    });
    const result = await runCursorPagination({
      maxPages: 5,
      maxItems: 3,
      fetchPage,
    });

    expect(result.stopReason).toBe("max-items");
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("increments offsets and stops on an empty provider page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ pageItems: ["a", "b"], hasMore: true })
      .mockResolvedValueOnce({ pageItems: [], hasMore: true });
    const result = await runOffsetPagination({
      initialOffset: 10,
      maxPages: 5,
      maxItems: 10,
      pageSize: 2,
      fetchPage,
    });

    expect(result).toMatchObject({
      items: ["a", "b"],
      offset: 12,
      hasMore: false,
      pagesFetched: 2,
      stopReason: "empty-page",
    });
    expect(fetchPage).toHaveBeenNthCalledWith(1, 10, 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 12, 2);
  });
});
