import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export interface RequestContext {
    requestId: string;
    route: string;
    method: string;
    firstCaller?: string;
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

export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
    const requestId = c.req.header("x-request-id")?.trim() || randomUUID();
    const ctx: RequestContext = {
        requestId,
        route: c.req.path,
        method: c.req.method,
    };

    await storage.run(ctx, async () => {
        await next();
    });

    c.header("x-request-id", requestId);
};
