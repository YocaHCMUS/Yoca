type CursorPaginationResult<T> = {
    items: T[];
    cursor: string | null;
    hasMore: boolean;
    pagesFetched: number;
    stopReason:
    | "provider-end"
    | "max-pages"
    | "max-items"
    | "empty-page"
    | "stagnant";
};

type OffsetPaginationResult<T> = {
    items: T[];
    offset: number;
    hasMore: boolean;
    pagesFetched: number;
    stopReason:
    | "provider-end"
    | "max-pages"
    | "max-items"
    | "empty-page"
    | "stagnant";
};

export async function runCursorPagination<T>(input: {
    initialCursor?: string | null;
    maxPages: number;
    maxItems: number;
    stagnantPageLimit?: number;
    fetchPage: (cursor: string | null, page: number) => Promise<{
        pageItems: T[];
        nextCursor: string | null;
        hasMore: boolean;
    }>;
}): Promise<CursorPaginationResult<T>> {
    const items: T[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = input.initialCursor ?? null;
    let hasMore = true;
    let pagesFetched = 0;
    let stagnantPages = 0;
    let stopReason: CursorPaginationResult<T>["stopReason"] = "provider-end";

    while (hasMore && pagesFetched < input.maxPages && items.length < input.maxItems) {
        pagesFetched += 1;

        const page = await input.fetchPage(cursor, pagesFetched);
        const nextCursor = page.nextCursor;
        const pageItems = page.pageItems;

        if (pageItems.length === 0) {
            stopReason = "empty-page";
            hasMore = false;
            cursor = null;
            break;
        }

        items.push(...pageItems);
        if (items.length >= input.maxItems) {
            stopReason = "max-items";
            break;
        }

        if (input.stagnantPageLimit != null && pageItems.length === 0) {
            stagnantPages += 1;
            if (stagnantPages >= input.stagnantPageLimit) {
                stopReason = "stagnant";
                break;
            }
        } else {
            stagnantPages = 0;
        }

        hasMore = page.hasMore && Boolean(nextCursor);
        if (!hasMore) {
            stopReason = "provider-end";
            cursor = null;
            break;
        }

        if (nextCursor == null || seenCursors.has(nextCursor)) {
            stopReason = "stagnant";
            hasMore = false;
            cursor = null;
            break;
        }

        seenCursors.add(nextCursor);
        cursor = nextCursor;
    }

    if (
        stopReason === "provider-end" &&
        hasMore &&
        pagesFetched >= input.maxPages &&
        items.length < input.maxItems
    ) {
        stopReason = "max-pages";
    }

    return {
        items,
        cursor,
        hasMore,
        pagesFetched,
        stopReason,
    };
}

export async function runOffsetPagination<T>(input: {
    initialOffset?: number;
    maxPages: number;
    maxItems: number;
    pageSize: number;
    stagnantPageLimit?: number;
    fetchPage: (offset: number, page: number) => Promise<{
        pageItems: T[];
        hasMore: boolean;
    }>;
}): Promise<OffsetPaginationResult<T>> {
    const items: T[] = [];
    let offset = Math.max(0, Math.floor(input.initialOffset ?? 0));
    let hasMore = true;
    let pagesFetched = 0;
    let stagnantPages = 0;
    let stopReason: OffsetPaginationResult<T>["stopReason"] = "provider-end";

    while (hasMore && pagesFetched < input.maxPages && items.length < input.maxItems) {
        pagesFetched += 1;
        const page = await input.fetchPage(offset, pagesFetched);

        if (page.pageItems.length === 0) {
            stopReason = "empty-page";
            hasMore = false;
            break;
        }

        items.push(...page.pageItems);
        if (items.length >= input.maxItems) {
            stopReason = "max-items";
            break;
        }

        if (input.stagnantPageLimit != null && page.pageItems.length === 0) {
            stagnantPages += 1;
            if (stagnantPages >= input.stagnantPageLimit) {
                stopReason = "stagnant";
                break;
            }
        } else {
            stagnantPages = 0;
        }

        hasMore = page.hasMore;
        if (!hasMore) {
            stopReason = "provider-end";
            break;
        }

        offset += input.pageSize;
    }

    if (
        stopReason === "provider-end" &&
        hasMore &&
        pagesFetched >= input.maxPages &&
        items.length < input.maxItems
    ) {
        stopReason = "max-pages";
    }

    return {
        items,
        offset,
        hasMore,
        pagesFetched,
        stopReason,
    };
}
