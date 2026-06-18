import {
  disableLegacyHeliusWebhook,
  getHeliusWebhookDiagnostics,
  getManagedWebhookUrl,
  MAX_HELIUS_WEBHOOK_ADDRESSES,
  syncHeliusWebhookAccountAddresses,
  verifyHeliusCutover,
  type DisableLegacyHeliusWebhookDependencies,
  type HeliusWebhookSyncDependencies,
  type ManagedHeliusWebhook,
} from "@sv/services/heliusWebhooks.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WEBHOOK_URL = "https://alerts.example.com/webhook";

function makeAddresses(count: number, offset = 0): string[] {
  return Array.from(
    { length: count },
    (_, index) => `Wallet${String(index + offset).padStart(4, "0")}`,
  );
}

function makeExistingShard(index: number): ManagedHeliusWebhook {
  return makeShardWithAddresses(
    `hook-${index + 1}`,
    makeAddresses(MAX_HELIUS_WEBHOOK_ADDRESSES, index * 25),
    index + 1,
  );
}

function makeShardWithAddresses(
  heliusWebhookId: string,
  accountAddresses: string[],
  id = 1,
): ManagedHeliusWebhook {
  return {
    id,
    heliusWebhookId,
    webhookUrl: WEBHOOK_URL,
    webhookType: "enhanced",
    transactionTypes: ["ANY"],
    accountAddresses,
    status: "active",
  };
}

function makeDeps(
  addresses: string[],
  existing: ManagedHeliusWebhook[] = [],
  overrides: Partial<HeliusWebhookSyncDependencies> = {},
): HeliusWebhookSyncDependencies {
  let created = 0;
  return {
    withShardSyncLock: vi.fn(async (work) => work()),
    loadWatchedAddresses: vi.fn().mockResolvedValue(addresses),
    listManagedWebhooksFromDb: vi.fn().mockResolvedValue(existing),
    createWebhook: vi.fn(async () => {
      created += 1;
      return `new-hook-${created}`;
    }),
    updateWebhook: vi.fn().mockResolvedValue(undefined),
    deleteWebhook: vi.fn().mockResolvedValue(undefined),
    persistShardState: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeDisableDeps(
  addresses: string[],
  existing: ManagedHeliusWebhook[] = [],
  overrides: Partial<DisableLegacyHeliusWebhookDependencies> = {},
): DisableLegacyHeliusWebhookDependencies {
  return {
    loadWatchedAddresses: vi.fn().mockResolvedValue(addresses),
    listManagedWebhooksFromDb: vi.fn().mockResolvedValue(existing),
    deleteWebhookById: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    ...overrides,
  };
}

describe("Helius managed webhook sharding", () => {
  beforeEach(() => {
    vi.stubEnv("HELIUS_API_KEY", "test-helius-key");
    vi.stubEnv("PUBLIC_WEBHOOK_URL", "https://alerts.example.com");
    vi.stubEnv("WEBHOOK_PUBLIC_URL", "");
    vi.stubEnv("HELIUS_WEBHOOK_AUTH_KEY", "test-auth");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not require an active webhook when there are 0 watched addresses", async () => {
    const deps = makeDeps([]);

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(result.requiredShards).toBe(0);
    expect(deps.createWebhook).not.toHaveBeenCalled();
    expect(deps.updateWebhook).not.toHaveBeenCalled();
    expect(deps.deleteWebhook).not.toHaveBeenCalled();
    expect(deps.persistShardState).toHaveBeenCalledWith([], []);
    expect(deps.withShardSyncLock).toHaveBeenCalledTimes(1);
  });

  it("sync does not require HELIUS_WEBHOOK_ID", async () => {
    vi.stubEnv("HELIUS_WEBHOOK_ID", "");
    const deps = makeDeps(makeAddresses(1));

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(deps.createWebhook).toHaveBeenCalledTimes(1);
  });

  it("uses WEBHOOK_PUBLIC_URL before PUBLIC_WEBHOOK_URL when both are configured", () => {
    vi.stubEnv("WEBHOOK_PUBLIC_URL", "https://new-ngrok.example/webhook");
    vi.stubEnv("PUBLIC_WEBHOOK_URL", "https://old-ngrok.example/webhook");

    expect(getManagedWebhookUrl()).toBe("https://new-ngrok.example/webhook");
  });

  it("uses 1 webhook for 1-25 watched addresses", async () => {
    const deps = makeDeps(makeAddresses(25));

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(result.requiredShards).toBe(1);
    expect(result.shardAddressCounts).toEqual([25]);
    expect(deps.createWebhook).toHaveBeenCalledTimes(1);
    expect(deps.persistShardState).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          heliusWebhookId: "new-hook-1",
          webhookUrl: WEBHOOK_URL,
          accountAddresses: makeAddresses(25),
        }),
      ],
      [],
    );
  });

  it.each([26, 50])(
    "uses 2 webhooks for %i watched addresses",
    async (count) => {
      const deps = makeDeps(makeAddresses(count));

      const result = await syncHeliusWebhookAccountAddresses(deps);

      expect(result.ok).toBe(true);
      expect(result.requiredShards).toBe(2);
      expect(result.shardAddressCounts).toEqual([
        25,
        count - MAX_HELIUS_WEBHOOK_ADDRESSES,
      ]);
      expect(deps.createWebhook).toHaveBeenCalledTimes(2);
    },
  );

  it("uses 3 webhooks for 51 watched addresses", async () => {
    const deps = makeDeps(makeAddresses(51));

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(result.requiredShards).toBe(3);
    expect(result.shardAddressCounts).toEqual([25, 25, 1]);
    expect(deps.createWebhook).toHaveBeenCalledTimes(3);
  });

  it("dedupes and trims addresses across followed wallets and alert rules", async () => {
    const deps = makeDeps([" Wallet0001 ", "Wallet0002", "Wallet0001", ""]);

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(result.totalAddresses).toBe(2);
    expect(deps.createWebhook).toHaveBeenCalledWith(["Wallet0001", "Wallet0002"]);
  });

  it("deletes extra managed shards when watched addresses shrink", async () => {
    const existing = [0, 1, 2].map(makeExistingShard);
    const deps = makeDeps(makeAddresses(10), existing);

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(deps.updateWebhook).toHaveBeenCalledWith("hook-1", makeAddresses(10));
    expect(deps.deleteWebhook).toHaveBeenCalledWith("hook-2");
    expect(deps.deleteWebhook).toHaveBeenCalledWith("hook-3");
    expect(deps.persistShardState).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          heliusWebhookId: "hook-1",
          accountAddresses: makeAddresses(10),
        }),
      ],
      ["hook-2", "hook-3"],
    );
  });

  it.each([
    {
      name: "create",
      existing: [] as ManagedHeliusWebhook[],
      override: {
        createWebhook: vi.fn().mockRejectedValue(new Error("create failed")),
      },
    },
    {
      name: "update",
      existing: [makeExistingShard(0)],
      override: {
        updateWebhook: vi.fn().mockRejectedValue(new Error("update failed")),
      },
    },
  ])(
    "logs failed Helius $name and does not persist partial shard state",
    async ({ existing, override }) => {
      const deps = makeDeps(makeAddresses(1), existing, override);

      const result = await syncHeliusWebhookAccountAddresses(deps);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("failed");
      expect(deps.persistShardState).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "[helius-shards] sync failed",
        expect.any(String),
      );
    },
  );

  it("recreates a managed shard when Helius no longer has the stored webhook id", async () => {
    const stale = makeShardWithAddresses("stale-hook", makeAddresses(2));
    const notFound = Object.assign(new Error("not found"), { status: 404 });
    const deps = makeDeps(makeAddresses(2), [stale], {
      updateWebhook: vi.fn().mockRejectedValue(notFound),
      createWebhook: vi.fn().mockResolvedValue("replacement-hook"),
    });

    const result = await syncHeliusWebhookAccountAddresses(deps);

    expect(result.ok).toBe(true);
    expect(result.createdWebhookIds).toEqual(["replacement-hook"]);
    expect(result.deletedWebhookIds).toEqual(["stale-hook"]);
    expect(deps.persistShardState).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          heliusWebhookId: "replacement-hook",
          accountAddresses: makeAddresses(2),
        }),
      ],
      ["stale-hook"],
    );
  });

  it("diagnostics warns when HELIUS_WEBHOOK_ID is still set", async () => {
    vi.stubEnv("HELIUS_WEBHOOK_ID", "legacy-hook");

    const diagnostics = await getHeliusWebhookDiagnostics({
      loadWatchedAddresses: vi.fn().mockResolvedValue([]),
      listManagedWebhooksFromDb: vi.fn().mockResolvedValue([]),
    });

    expect(diagnostics.oldEnvWebhookConfigured).toBe(true);
    expect(diagnostics.oldEnvWebhookIdPresent).toBe(true);
    expect(diagnostics.legacyCutoverRequired).toBe(true);
    expect(diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("legacy HELIUS_WEBHOOK_ID is configured"),
      ]),
    );
  });

  it("cutover verification fails when watched addresses exist but no managed shards exist", async () => {
    const result = await verifyHeliusCutover({
      loadWatchedAddresses: vi.fn().mockResolvedValue(makeAddresses(1)),
      listManagedWebhooksFromDb: vi.fn().mockResolvedValue([]),
    });

    expect(result.ok).toBe(false);
    expect(result.requiredHeliusWebhookCount).toBe(1);
    expect(result.managedHeliusWebhookCount).toBe(0);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("no DB-managed Helius webhook shards exist"),
      ]),
    );
  });

  it("cutover verification passes when required shard count matches active managed shards", async () => {
    const watched = makeAddresses(26);
    const managed = [
      makeShardWithAddresses("hook-1", watched.slice(0, 25), 1),
      makeShardWithAddresses("hook-2", watched.slice(25), 2),
    ];

    const result = await verifyHeliusCutover({
      loadWatchedAddresses: vi.fn().mockResolvedValue(watched),
      listManagedWebhooksFromDb: vi.fn().mockResolvedValue(managed),
    });

    expect(result.ok).toBe(true);
    expect(result.requiredHeliusWebhookCount).toBe(2);
    expect(result.managedHeliusWebhookCount).toBe(2);
    expect(result.shardAddressCounts.map((shard) => shard.addressCount)).toEqual([
      25,
      1,
    ]);
  });

  it("legacy disable refuses to run if managed shards are unhealthy", async () => {
    vi.stubEnv("HELIUS_WEBHOOK_ID", "legacy-hook");
    const deps = makeDisableDeps(makeAddresses(1), []);

    const result = await disableLegacyHeliusWebhook(deps);

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain("not healthy");
    expect(deps.deleteWebhookById).not.toHaveBeenCalled();
  });

  it("legacy disable is a no-op when HELIUS_WEBHOOK_ID is missing", async () => {
    vi.stubEnv("HELIUS_WEBHOOK_ID", "");
    const deps = makeDisableDeps([], []);

    const result = await disableLegacyHeliusWebhook(deps);

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toBe(
      "No legacy HELIUS_WEBHOOK_ID configured. Nothing to disable.",
    );
    expect(deps.deleteWebhookById).not.toHaveBeenCalled();
  });

  it("serializes concurrent shard sync attempts through the advisory lock seam", async () => {
    const watched = makeAddresses(2);
    const managed: ManagedHeliusWebhook[] = [];
    let created = 0;
    let lockChain = Promise.resolve();
    const deps = makeDeps(watched, [], {
      withShardSyncLock: vi.fn(async (work) => {
        const previous = lockChain;
        let release!: () => void;
        lockChain = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await work();
        } finally {
          release();
        }
      }),
      listManagedWebhooksFromDb: vi.fn(async () => [...managed]),
      createWebhook: vi.fn(async (addresses) => {
        created += 1;
        return `created-${created}-${addresses.length}`;
      }),
      updateWebhook: vi.fn().mockResolvedValue(undefined),
      persistShardState: vi.fn(async (activeAssignments) => {
        managed.splice(
          0,
          managed.length,
          ...activeAssignments.map((assignment, index) =>
            makeShardWithAddresses(
              assignment.heliusWebhookId,
              assignment.accountAddresses,
              index + 1,
            ),
          ),
        );
      }),
    });

    const [first, second] = await Promise.all([
      syncHeliusWebhookAccountAddresses(deps),
      syncHeliusWebhookAccountAddresses(deps),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(deps.withShardSyncLock).toHaveBeenCalledTimes(2);
    expect(deps.createWebhook).toHaveBeenCalledTimes(1);
    expect(deps.updateWebhook).toHaveBeenCalledTimes(1);
    expect(managed).toHaveLength(1);
  });
});
