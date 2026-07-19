import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import {
    API_CALL_TRACKER_ENABLED,
    API_OBSERVABILITY_ROUTE_PREFIXES,
} from "@sv/config/constants.js";

export interface OutboundAttempt {
    trackingId: string;
    attempt: number;
    status: number | null;
    durationMs: number;
}

export interface RequestContext {
    requestId: string;
    route: string;
    method: string;
    firstCaller?: string;
    outboundAttempts: OutboundAttempt[];
    databaseResultUsed: boolean;
    forcedRefreshRequested: boolean;
    staleFallbackUsed: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
    return storage.getStore();
}

export function setFirstCallerIfUnset(serviceFile: string, functionName: string): string {
    const store = storage.getStore();
    const caller = `${serviceFile}:${functionName}`;

    if (!store) {
        return caller;
    }

    if (!store.firstCaller) {
        store.firstCaller = caller;
    }

    return store.firstCaller;
}

function recordOutboundAttempt(
    context: RequestContext | undefined,
    attempt: OutboundAttempt,
): void {
    context?.outboundAttempts.push(attempt);
}

export type DataAccessMark =
    | "db_result"
    | "forced_refresh"
    | "stale_fallback";

function record(...usage: DataAccessMark[]): void {
    const store = storage.getStore();
    if (!store) {
        return;
    }

    for (const item of usage) {
        switch (item) {
            case "db_result":
                store.databaseResultUsed = true;
                break;
            case "forced_refresh":
                store.forcedRefreshRequested = true;
                break;
            case "stale_fallback":
                store.staleFallbackUsed = true;
                break;
        }
    }
}

export const dataUsage = {
    record,
};

export const captureUsageContext = getRequestContext;
export const recordProviderAttempt = recordOutboundAttempt;

export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
    const requestId = c.req.header("x-request-id")?.trim() || randomUUID();
    const ctx: RequestContext = {
        requestId,
        route: c.req.path,
        method: c.req.method,
        outboundAttempts: [],
        databaseResultUsed: false,
        forcedRefreshRequested: false,
        staleFallbackUsed: false,
    };

    await storage.run(ctx, async () => {
        await next();
    });

    const isObservedRoute = API_OBSERVABILITY_ROUTE_PREFIXES.some((prefix) =>
        ctx.route.startsWith(prefix),
    );
    if (API_CALL_TRACKER_ENABLED && isObservedRoute) {
        const requestSucceeded = c.res.status >= 200 && c.res.status < 400;
        console.info("API data access summary", {
            requestId: ctx.requestId,
            method: ctx.method,
            route: ctx.route,
            status: c.res.status,
            requestSucceeded,
            databaseResultUsed: ctx.databaseResultUsed,
            forcedRefreshRequested: ctx.forcedRefreshRequested,
            staleFallbackUsed: ctx.staleFallbackUsed,
            outboundAttempts: ctx.outboundAttempts,
        });
    }

    c.header("x-request-id", requestId);
};
