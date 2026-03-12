import { CARBON } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { InlineLoading, Stack } from "@carbon/react";
import type { EChartsOption, TreemapSeriesOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef, useState } from "react";

export interface TokenTreeMapNode {
  imgUrl: string;
  symbol: string;
  value: number;

  tooltips: Array<{
    label: string;
    value: number | null;
    valueFmtr: (value: number | null) => string;
  }>;

  trendValue: number | null;
  trendValueFmtr: (value: number | null) => string;

  link?: string;
}

interface TokenTreeMapProps {
  data: TokenTreeMapNode[];
  loading?: boolean;
  height?: number;
  title?: string;
  className?: string;
}

type TreeNode = NonNullable<TreemapSeriesOption["data"]>[number] & {
  link?: string;
  raw: TokenTreeMapNode;
};

interface RectSize {
  width: number;
  height: number;
}

const MIN_WIDTH_FOR_FULL_LABEL = 120;
const MIN_HEIGHT_FOR_FULL_LABEL = 100;
const MIN_SIZE_FOR_ICON = 10;

function getTrendColor(trend: number | null): string {
  if (trend == null || trend == 0) return CARBON.info;
  return trend > 0 ? CARBON.success : CARBON.error;
}

function buildTrendLabel(symbol: string, trendStr: string) {
  return `{icon_${symbol}|}\n{symbol|${symbol}}\n{trendValue|${trendStr}}`;
}

function buildIconOnly(symbol: string) {
  return `{icon_${symbol}|}`;
}

function buildTreeNodes(nodes: TokenTreeMapNode[]): TreeNode[] {
  return nodes.map((node) => ({
    name: node.symbol,
    value: [node.value, node.trendValue ?? 0],
    itemStyle: {
      color: getTrendColor(node.trendValue),
    },
    link: node.link,
    raw: node,
  }));
}

function buildTooltip() {
  return {
    trigger: "item" as const,
    formatter: (params: any) => {
      const node: TokenTreeMapNode = params.data.raw;

      const rows = node.tooltips
        .map((t) => {
          const value = t.valueFmtr(t.value);
          return `<div style="display:flex;justify-content:space-between;">
            <small>${t.label}</small>
            <strong>${value}</strong>
          </div>`;
        })
        .join("");

      return `
        <div>
          <div style="font-weight:bold;margin-bottom:4px;">
            ${node.symbol}
          </div>
          ${rows}
        </div>
      `;
    },
  };
}

function buildTreemapOption(
  data: TokenTreeMapNode[],
  rectSizes: Record<string, RectSize>,
  onSizeCollected: (symbol: string, size: RectSize) => void,
): EChartsOption {
  return {
    tooltip: buildTooltip(),
    series: [
      {
        type: "treemap",
        data: buildTreeNodes(data),
        scaleLimit: {
          min: 1.0,
          max: 1.0,
        },

        label: {
          formatter: (params) => {
            const node: TokenTreeMapNode = (params.data as TreeNode).raw;
            const trendStr = node.trendValueFmtr(node.trendValue);
            const rectSize = rectSizes[node.symbol];

            if (!rectSize) {
              return buildTrendLabel(node.symbol, trendStr);
            }

            if (
              rectSize.width < MIN_SIZE_FOR_ICON ||
              rectSize.height < MIN_SIZE_FOR_ICON
            ) {
              return "";
            }

            if (
              rectSize.width < MIN_WIDTH_FOR_FULL_LABEL ||
              rectSize.height < MIN_HEIGHT_FOR_FULL_LABEL
            ) {
              console.log("icon only", node);
              return buildIconOnly(node.symbol);
            }

            return buildTrendLabel(node.symbol, trendStr);
          },
          rich: {
            topPad: {
              padding: [16, 0, 0, 0],
            },
            ...Object.fromEntries(
              data.map((node) => {
                const rectSize = rectSizes[node.symbol];
                const iconSize = rectSize
                  ? Math.max(
                      24,
                      Math.min(
                        48,
                        Math.min(rectSize.width, rectSize.height) * 0.4,
                      ),
                    )
                  : 48;

                return [
                  `icon_${node.symbol}`,
                  {
                    backgroundColor: {
                      image: node.imgUrl,
                    },
                    align: "center" as const,
                    height: iconSize,
                  },
                ];
              }),
            ),
            symbol: {
              padding: [8, 0, 0, 0],
              fontSize: 16,
              fontWeight: "bold" as const,
              align: "center" as const,
            },
            trendValue: {
              fontSize: 11,
              align: "center" as const,
            },
          },
        },

        visibleMin: 0,

        labelLayout: (params) => {
          const rect = params.rect;
          const labelRect = params.labelRect;

          if (!rect || !labelRect) {
            return { x: 0, y: 0 };
          }

          if (params.dataIndex !== undefined && data[params.dataIndex]) {
            const symbol = data[params.dataIndex].symbol;
            onSizeCollected(symbol, { width: rect.width, height: rect.height });
          }

          return {
            x: rect.x,
            y: rect.y + rect.height / 2 - labelRect.height / 2,
          };
        },

        breadcrumb: {
          show: false,
        },

        itemStyle: {
          gapWidth: 1,
        },

        nodeClick: "link",
      },
    ],
  };
}

export default function TokenTreeMap({
  data,
  loading = false,
  height = 300,
  className,
}: TokenTreeMapProps) {
  const { fmt } = useLocalization();
  const [rectSizes, setRectSizes] = useState<Record<string, RectSize>>({});
  const collectedSizesRef = useRef<Record<string, RectSize>>({});

  const handleSizeCollected = (symbol: string, size: RectSize) => {
    collectedSizesRef.current[symbol] = size;

    if (Object.keys(collectedSizesRef.current).length === data.length) {
      setRectSizes(collectedSizesRef.current);
      collectedSizesRef.current = {};
    } else {
      console.log(data.at(-1));
    }
  };

  const options = useMemo(() => {
    return buildTreemapOption(data, rectSizes, handleSizeCollected);
  }, [data, rectSizes]);

  if (loading) {
    return (
      <Stack style={{ height, alignItems: "center", justifyContent: "center" }}>
        <InlineLoading description="Loading..." />
      </Stack>
    );
  }
  if (data.length == 0) {
    return (
      <Stack style={{ height, alignItems: "center", justifyContent: "center" }}>
        <p>No data</p>
      </Stack>
    );
  }

  return (
    <ReactECharts option={options} style={{ height }} className={className} />
  );
}
