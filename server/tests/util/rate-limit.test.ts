import Bottleneck from "bottleneck";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rlFetch } from "@sv/util/rate-limit.js";

function createLimiter() {
  return new Bottleneck({ maxConcurrent: 1, minTime: 0 });
}

describe("rlFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries a 500 response and returns a later successful response", async () => {
    const limiter = createLimiter();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const response = await rlFetch(new URL("https://example.test/chart"), {
      rlLimiter: limiter,
      rlRetries: 1,
      rlRetryDelayMs: 0,
      rlLogContext: { provider: "zerion", endpointPath: "/chart" },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await limiter.stop({ dropWaitingJobs: true });
  });

  it("retries a 429 response and returns a later successful response", async () => {
    const limiter = createLimiter();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const response = await rlFetch(new URL("https://example.test/chart"), {
      rlLimiter: limiter,
      rlRetries: 1,
      rlRetryDelayMs: 0,
      rlLogContext: { provider: "zerion", endpointPath: "/chart" },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await limiter.stop({ dropWaitingJobs: true });
  });
});
