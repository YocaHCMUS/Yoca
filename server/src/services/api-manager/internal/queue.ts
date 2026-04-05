// Per-provider throttled queue (token bucket)
type Task<T> = () => Promise<T>;

export class ThrottledQueue {
    private queue: Array<() => void> = [];
    private tokens: number;
    private lastRefill: number;
    private readonly rate: number; // tokens per second
    private readonly capacity: number;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(rate = 1, capacity = 1) {
        this.rate = rate;
        this.capacity = capacity;
        this.tokens = capacity;
        this.lastRefill = Date.now();
        // No continuous interval in tests; we'll schedule ticks when queue has items.
    }

    private refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        // Use fractional refill so tokens accumulate smoothly between ticks
        if (elapsed > 0) {
            this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
            this.lastRefill = now;

        }
    }

    async push<T>(task: Task<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // `runner` will be placed in the queue and, when invoked by the
            // internal processor, will execute the provided `task` directly
            // without calling `refill()` again (the processor handles refill).
            const runner = () => {
                task().then(resolve, reject);
            };

            const attempt = () => {
                this.refill();
                if (this.tokens >= 1) {
                    this.tokens -= 1;
                    runner();
                } else {
                    this.queue.push(runner);
                    if (!this.timer) {
                        const delayMs = Math.ceil(1000 / this.rate);
                        this.timer = setTimeout(() => {
                            this.timer = null;
                            this._processOnce(delayMs);
                        }, delayMs);
                    }
                }
            };

            attempt();
        });
    }

    // Call this periodically to process the queue
    tick() {
        this.refill();
        while (this.tokens >= 1 && this.queue.length > 0) {
            this.tokens -= 1;
            const fn = this.queue.shift();
            if (fn) fn();
        }
        // If there are still queued tasks, ensure a timer is set to continue processing
        if (this.queue.length > 0 && !this.timer) {
            const delayMs = Math.ceil(1000 / this.rate);
            this.timer = setTimeout(() => {
                this.timer = null;
                this.tick();
            }, delayMs);
        }
    }

    // Process a single queued task (if any) and chain the next run after delayMs.
    private _processOnce(delayMs: number) {
        this.refill();
        if (this.tokens >= 1 && this.queue.length > 0) {
            this.tokens -= 1;
            const fn = this.queue.shift();
            if (fn) fn();
            if (this.queue.length > 0) {
                this.timer = setTimeout(() => {
                    this.timer = null;
                    this._processOnce(delayMs);
                }, delayMs);
            }
        } else if (this.queue.length > 0) {
            // Not enough tokens yet; schedule another check after delayMs
            this.timer = setTimeout(() => {
                this.timer = null;
                this._processOnce(delayMs);
            }, delayMs);
        }
    }
}
