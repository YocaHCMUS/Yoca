import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { BaseChart } from "@/components/charts/Base/BaseChart";
import { ChartContainer, ChartGridItem, ChartSection } from "@/components/charts/shared";
import { getThemedChartBaseOption, useChartTheme } from "@/hooks/useChartTheme";
import type { ActivityHeatmapCell } from "@/types/profile";
import sharedStyles from "@/components/charts/shared/ChartStyle.module.scss";

type HeatmapWindow = "3D" | "7D";

interface ProfileTradeFrequencyHeatmapProps {
    cells: ActivityHeatmapCell[];
    maxCount?: number;
    title?: string;
    minHeight?: number;
}

function formatDateInput(dateInput: Date): string {
    const year = dateInput.getUTCFullYear();
    const month = String(dateInput.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateInput.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseIsoDate(dateInput: string): Date | null {
    const parsed = new Date(`${dateInput}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}

function getLatestDate(cells: ActivityHeatmapCell[]): Date | null {
    const parsed = cells
        .map((cell) => parseIsoDate(cell.date))
        .filter((value): value is Date => value !== null)
        .sort((a, b) => a.getTime() - b.getTime());

    if (parsed.length === 0) {
        return null;
    }

    return parsed[parsed.length - 1];
}

function getWindowDates(latestDate: Date, window: HeatmapWindow): string[] {
    const length = window === "3D" ? 3 : 7;
    const values: string[] = [];

    for (let offset = length - 1; offset >= 0; offset -= 1) {
        const next = new Date(latestDate);
        next.setUTCDate(next.getUTCDate() - offset);
        values.push(formatDateInput(next));
    }

    return values;
}

export function ProfileTradeFrequencyHeatmap({
    cells,
    maxCount,
    title = "Trade frequency heatmap",
    minHeight = 320,
}: ProfileTradeFrequencyHeatmapProps) {
    const chartTheme = useChartTheme();
    const [selectedWindow, setSelectedWindow] = useState<HeatmapWindow>("7D");

    const latestDate = useMemo(() => getLatestDate(cells), [cells]);

    const windowCells = useMemo(() => {
        if (!latestDate) {
            return [] as Array<{ date: string; count: number }>;
        }

        const dateList = getWindowDates(latestDate, selectedWindow);
        const countByDate = new Map<string, number>();

        cells.forEach((cell) => {
            if (!dateList.includes(cell.date)) {
                return;
            }

            const nextCount = Number.isFinite(cell.count) ? cell.count : 0;
            countByDate.set(cell.date, nextCount);
        });

        return dateList.map((date) => ({
            date,
            count: countByDate.get(date) ?? 0,
        }));
    }, [cells, latestDate, selectedWindow]);

    const chartMaxCount = useMemo(() => {
        if (typeof maxCount === "number" && Number.isFinite(maxCount) && maxCount > 0) {
            return maxCount;
        }

        const localMax = windowCells.reduce((largest, cell) => Math.max(largest, cell.count), 0);
        return localMax;
    }, [maxCount, windowCells]);

    const hasNonZeroData = windowCells.some((cell) => cell.count > 0);
    const isEmpty = windowCells.length === 0 || !hasNonZeroData;

    const chartOption = useMemo((): EChartsOption | null => {
        if (isEmpty) {
            return null;
        }

        const baseOption = getThemedChartBaseOption(chartTheme);
        const firstDate = windowCells[0]?.date;
        const lastDate = windowCells[windowCells.length - 1]?.date;

        if (!firstDate || !lastDate) {
            return null;
        }

        return {
            ...baseOption,
            tooltip: {
                ...baseOption.tooltip,
                trigger: "item",
                formatter: (params: any) => {
                    const pointDate = params?.data?.[0] ?? "-";
                    const tradeCount = params?.data?.[1] ?? 0;
                    return `${pointDate}<br/>Trades: ${tradeCount}`;
                },
            },
            visualMap: {
                min: 0,
                max: Math.max(1, chartMaxCount),
                calculable: true,
                orient: "horizontal",
                left: "center",
                bottom: 8,
                text: ["High", "Low"],
                inRange: {
                    color: ["#edf5ff", "#0f62fe"],
                },
                textStyle: {
                    color: chartTheme.textColorSecondary,
                },
            },
            calendar: {
                top: 56,
                left: 24,
                right: 24,
                range: [firstDate, lastDate],
                cellSize: ["auto", 32],
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: chartTheme.borderColor,
                        width: 1,
                    },
                },
                dayLabel: {
                    firstDay: 1,
                    nameMap: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                    color: chartTheme.textColorSecondary,
                },
                monthLabel: {
                    show: false,
                },
                yearLabel: {
                    show: false,
                },
                itemStyle: {
                    color: chartTheme.backgroundColor,
                    borderColor: chartTheme.borderColor,
                    borderWidth: 1,
                },
            },
            series: [
                {
                    type: "heatmap",
                    coordinateSystem: "calendar",
                    data: windowCells.map((cell) => [cell.date, cell.count]),
                },
            ],
        };
    }, [chartMaxCount, chartTheme, isEmpty, windowCells]);

    const loadingState = {
        status: "success" as const,
        retryCount: 0,
    };

    const controls = (
        <div className={sharedStyles.filterSegmentedGroup}>
            <button
                type="button"
                className={`${sharedStyles.filterSegmentedButton} ${selectedWindow === "3D" ? sharedStyles.filterSegmentedButtonActive : ""}`}
                onClick={() => setSelectedWindow("3D")}
                aria-pressed={selectedWindow === "3D"}
            >
                3D
            </button>
            <button
                type="button"
                className={`${sharedStyles.filterSegmentedButton} ${selectedWindow === "7D" ? sharedStyles.filterSegmentedButtonActive : ""}`}
                onClick={() => setSelectedWindow("7D")}
                aria-pressed={selectedWindow === "7D"}
            >
                7D
            </button>
        </div>
    );

    return (
        <BaseChart
            title={title}
            loadingState={loadingState}
            isEmpty={isEmpty}
            onRetry={() => undefined}
            actions={controls}
        >
            <ChartContainer gap="0">
                <ChartSection minHeight={`${minHeight}px`}>
                    {chartOption && (
                        <ChartGridItem minHeight={minHeight}>
                            <ReactECharts
                                option={chartOption}
                                style={{
                                    height: "100%",
                                    width: "100%",
                                    minHeight: `${minHeight}px`,
                                }}
                                notMerge
                                lazyUpdate
                            />
                        </ChartGridItem>
                    )}
                </ChartSection>
            </ChartContainer>
        </BaseChart>
    );
}

export default ProfileTradeFrequencyHeatmap;
