import { beforeEach, describe, expect, it, vi } from "vitest";
import { snapToNearest, attachChartDayClick } from "../chart-click";

describe("snapToNearest", () => {
  const sorted = [100, 200, 300, 400, 500];

  it("returns exact match", () => {
    expect(snapToNearest(200, sorted)).toBe(200);
  });

  it("snaps to closest lower neighbor", () => {
    expect(snapToNearest(249, sorted)).toBe(200);
  });

  it("snaps to closest higher neighbor", () => {
    expect(snapToNearest(251, sorted)).toBe(300);
  });

  it("returns first element when value is below start", () => {
    expect(snapToNearest(50, sorted)).toBe(100);
  });

  it("returns last element when value is above end", () => {
    expect(snapToNearest(999, sorted)).toBe(500);
  });

  it("returns lower on tie (value <= midpoint)", () => {
    expect(snapToNearest(250, sorted)).toBe(200);
  });

  it("handles single-element list", () => {
    expect(snapToNearest(42, [100])).toBe(100);
  });

  it("returns value unchanged for empty list", () => {
    expect(snapToNearest(42, [])).toBe(42);
  });
});

describe("attachChartDayClick", () => {
  const timestamps = [1000, 2000, 3000, 4000];
  let onDayClick: (timestamp: number) => void;

  type EventHandler = (...args: unknown[]) => void;

  interface MockZr {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  }

  interface MockChart {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    getZr: ReturnType<typeof vi.fn>;
    convertFromPixel: ReturnType<typeof vi.fn>;
    handlers: Map<string, Set<EventHandler>>;
    mockZr: MockZr;
  }

  function createMockChart(): MockChart {
    const handlers = new Map<string, Set<EventHandler>>();

    const mockZr: MockZr = {
      on: vi.fn((_event: string, handler: EventHandler) => {
        if (!handlers.has(`zr:${_event}`)) handlers.set(`zr:${_event}`, new Set());
        handlers.get(`zr:${_event}`)!.add(handler);
      }),
      off: vi.fn((_event: string, handler: EventHandler) => {
        handlers.get(`zr:${_event}`)?.delete(handler);
      }),
    };

    const mockChart: MockChart = {
      on: vi.fn((_event: string, handler: EventHandler) => {
        if (!handlers.has(_event)) handlers.set(_event, new Set());
        handlers.get(_event)!.add(handler);
      }),
      off: vi.fn((_event: string, handler: EventHandler) => {
        handlers.get(_event)?.delete(handler);
      }),
      getZr: vi.fn(() => mockZr),
      convertFromPixel: vi.fn(),
      handlers,
      mockZr,
    };

    return mockChart;
  }

  beforeEach(() => {
    onDayClick = vi.fn() as unknown as (timestamp: number) => void;
  });

  it("fires onDayClick for series click with valid dataIndex", () => {
    const chart = createMockChart();
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const seriesHandler = chart.handlers.get("click")?.values().next().value;
    seriesHandler!({ componentType: "series", dataIndex: 2 });

    expect(onDayClick).toHaveBeenCalledWith(3000);
    cleanup();
  });

  it("ignores non-series component clicks", () => {
    const chart = createMockChart();
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const seriesHandler = chart.handlers.get("click")?.values().next().value;
    seriesHandler!({ componentType: "xAxis", dataIndex: 2 });

    expect(onDayClick).not.toHaveBeenCalled();
    cleanup();
  });

  it("ignores series click with null dataIndex", () => {
    const chart = createMockChart();
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const seriesHandler = chart.handlers.get("click")?.values().next().value;
    seriesHandler!({ componentType: "series", dataIndex: null });

    expect(onDayClick).not.toHaveBeenCalled();
    cleanup();
  });

  it("fires onDayClick for blank area click (category axis)", () => {
    const chart = createMockChart();
    chart.convertFromPixel.mockReturnValue([2, 150]);
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const blankHandler = chart.handlers.get("zr:click")?.values().next().value;
    blankHandler!({ offsetX: 100, offsetY: 200, target: undefined });

    expect(chart.convertFromPixel).toHaveBeenCalledWith(
      { xAxisIndex: 0 },
      [100, 200],
    );
    expect(onDayClick).toHaveBeenCalledWith(3000);
    cleanup();
  });

  it("fires onDayClick for blank area click (time axis, snap nearest)", () => {
    const chart = createMockChart();
    chart.convertFromPixel.mockReturnValue([2499, 150]);
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick, "time");

    const blankHandler = chart.handlers.get("zr:click")?.values().next().value;
    blankHandler!({ offsetX: 100, offsetY: 200, target: undefined });

    expect(onDayClick).toHaveBeenCalledWith(2000);
    cleanup();
  });

  it("ignores blank area click when event.target exists", () => {
    const chart = createMockChart();
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const blankHandler = chart.handlers.get("zr:click")?.values().next().value;
    blankHandler!({ offsetX: 100, offsetY: 200, target: { some: "element" } });

    expect(onDayClick).not.toHaveBeenCalled();
    cleanup();
  });

  it("ignores blank area click when convertFromPixel returns null", () => {
    const chart = createMockChart();
    chart.convertFromPixel.mockReturnValue(null);
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const blankHandler = chart.handlers.get("zr:click")?.values().next().value;
    blankHandler!({ offsetX: 100, offsetY: 200, target: undefined });

    expect(onDayClick).not.toHaveBeenCalled();
    cleanup();
  });

  it("returns cleanup function that removes all handlers", () => {
    const chart = createMockChart();
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);

    const [seriesHandler] = chart.handlers.get("click")!.values();
    const [blankHandler] = chart.handlers.get("zr:click")!.values();

    cleanup();

    expect(chart.off).toHaveBeenCalledWith("click", seriesHandler);
    expect(chart.mockZr.off).toHaveBeenCalledWith("click", blankHandler);
  });

  it("does not fire after cleanup", () => {
    const chart = createMockChart();
    const cleanup = attachChartDayClick(chart as unknown as never, timestamps, onDayClick);
    cleanup();

    const seriesHandlers = chart.handlers.get("click");
    const zrHandlers = chart.handlers.get("zr:click");

    expect(seriesHandlers?.size ?? 0).toBe(0);
    expect(zrHandlers?.size ?? 0).toBe(0);
  });
});
