import { CARBON } from "@/config/constants";
import { useUserTheme } from "@/contexts";
import { useLocalization } from "@/contexts/LocalizationContext";
import { InlineLoading, Stack } from "@carbon/react";
import type { EChartsOption, TreemapSeriesOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useCallback, useMemo, useRef, useState } from "react";

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

type RichStyles = NonNullable<
  NonNullable<TreemapSeriesOption["label"]>["rich"]
>;

type RectSize = {
  width: number;
  height: number;
};

const labelSizes = ["tiny", "small", "medium", "full"] as const;

type LabelFormatter = (node: TokenTreeMapNode) => string;
type LabelSize = (typeof labelSizes)[number];
const labelThresholds: Record<
  LabelSize,
  {
    rectSize: number;
    iconSize: number;
    format: LabelFormatter;
    rich?: RichStyles;
  }
> = {
  tiny: {
    rectSize: 8,
    iconSize: 4,
    format: (node) => `{icon_tiny_${node.symbol}|}`,
  },
  small: {
    rectSize: 40,
    iconSize: 20,
    format: (node) => `{icon_small_${node.symbol}|}`,
  },
  medium: {
    rectSize: 80,
    iconSize: 32,
    format: (node) =>
      `{icon_medium_${node.symbol}|}\n{symbol_md|${node.symbol}}\n{trendValue_md|${node.trendValueFmtr(node.trendValue)}}`,
    rich: {
      symbol_md: {
        padding: [8, 0, 0, 0],
        fontSize: 10,
        align: "center",
      },
      trendValue_md: {
        fontSize: 7,
        align: "center",
      },
    },
  },
  full: {
    rectSize: 120,
    iconSize: 60,
    format: (node) =>
      `{icon_full_${node.symbol}|}\n{symbol_full|${node.symbol}}\n{trendValue_full|${node.trendValueFmtr(node.trendValue)}}`,
    rich: {
      symbol_full: {
        padding: [8, 0, 0, 0],
        fontSize: 16,
        fontWeight: "bold",
        align: "center",
      },
      trendValue_full: {
        fontSize: 10,
        align: "center",
      },
    },
  },
};

const richStyles = Object.values(labelThresholds)
  .map((threshold) => threshold.rich)
  .filter((styles) => styles != undefined)
  .reduce((acc, cur) => ({ ...acc, ...cur }), {});

function getTrendColor(trend: number | null): string {
  if (trend == null || trend == 0) return CARBON.info;
  return trend > 0 ? CARBON.success : CARBON.error;
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

function buildTreemapOption(
  data: TokenTreeMapNode[],
  rectSizes: Record<string, RectSize>,
  onSizeCollected: (symbol: string, size: RectSize) => void,
  theme: "light" | "dark",
  iconRichEntries: Record<string, any>,
): EChartsOption {
  return {
    tooltip: {
      trigger: "item" as const,
      formatter: (params) => {
        if (Array.isArray(params)) {
          return "";
        }
        const node: TokenTreeMapNode = (params.data as TreeNode).raw;

        const rows = node.tooltips
          .map((t) => {
            const value = t.valueFmtr(t.value);
            return `<div style="display:flex;gap:16px;justify-content:space-between;">
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
    },
    series: [
      {
        type: "treemap",
        data: buildTreeNodes(data),

        label: {
          formatter: (params) => {
            const node: TokenTreeMapNode = (params.data as TreeNode).raw;

            const rectSize = rectSizes[node.symbol];
            if (!rectSize) {
              return node.symbol;
            }

            const maxRectSize = Math.min(rectSize.width, rectSize.height);

            for (let i = 0; i < labelSizes.length; i++) {
              const threshold = labelThresholds[labelSizes[i]];
              if (maxRectSize < threshold.rectSize) {
                if (i == 0) {
                  return "";
                } else {
                  return labelThresholds[labelSizes[i - 1]].format(node);
                }
              }
            }

            return labelThresholds[labelSizes[labelSizes.length - 1]].format(
              node,
            );
          },
          rich: {
            ...iconRichEntries,
            ...richStyles,
          },
        },

        roam: false,

        visibleMin: 0,

        itemStyle: {
          gapWidth: 1,
          borderColor: theme == "dark" ? "black" : "white",
        },

        labelLayout: (params) => {
          const rect = params.rect;
          const labelRect = params.labelRect;

          const symbol = data[params.dataIndex! - 1].symbol;
          onSizeCollected(symbol, {
            width: rect.width,
            height: rect.height,
          });

          return {
            x: rect.x,
            y: rect.y + rect.height / 2 - labelRect.height / 2,
          };
        },
        breadcrumb: { show: false },
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
  console.log("re-render");
  const { fmt } = useLocalization();
  const [rectSizes, setRectSizes] = useState<Record<string, RectSize>>({});
  const collectedSizesRef = useRef<Record<string, RectSize>>({});
  const { theme } = useUserTheme();

  const handleSizeCollected = useCallback(
    (symbol: string, size: RectSize) => {
      const prev = collectedSizesRef.current[symbol];

      if (prev && prev.width == size.width && prev.height == size.height) {
        return;
      }

      collectedSizesRef.current[symbol] = size;

      if (Object.keys(collectedSizesRef.current).length == data.length) {
        setRectSizes({ ...collectedSizesRef.current });
      }
    },
    [data.length],
  );

  // Build icon rich entries only for the size we expect to render for each node.
  // Fallback to 'tiny' when the rect size is unknown.
  const iconRichEntries = useMemo(() => {
    return Object.fromEntries(
      data.flatMap((node) => {
        const rect = rectSizes[node.symbol];
        let size: LabelSize = "tiny";

        if (rect) {
          const maxRect = Math.min(rect.width, rect.height);
          for (let i = 0; i < labelSizes.length; i++) {
            const sizeKey = labelSizes[i];
            const threshold = labelThresholds[sizeKey];
            if (maxRect < threshold.rectSize) {
              size = i == 0 ? "tiny" : labelSizes[i - 1];
              break;
            }
            if (i == labelSizes.length - 1) {
              size = labelSizes[labelSizes.length - 1];
            }
          }
        }

        const entryKey = `icon_${size}_${node.symbol}`;
        const entryValue = {
          backgroundColor: { image: node.imgUrl },
          align: "center",
          width: labelThresholds[size].iconSize,
          height: labelThresholds[size].iconSize,
        };

        return [[entryKey, entryValue]];
      }),
    );
  }, [data, rectSizes]);

  const options = useMemo(() => {
    return buildTreemapOption(
      data,
      rectSizes,
      handleSizeCollected,
      theme,
      iconRichEntries,
    );
  }, [data, rectSizes, handleSizeCollected, theme, iconRichEntries]);

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
