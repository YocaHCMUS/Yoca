import { useLocalization } from "@/contexts/LocalizationContext";
import type { EChartsOption, TreemapSeriesOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

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
  height?: number;
  title?: string;
  className?: string;
}

type TreeNode = NonNullable<TreemapSeriesOption["data"]>[number] & {
  link?: string;
  raw: TokenTreeMapNode;
};

function getTrendColor(trend: number | null): string {
  if (trend == null || trend == 0) return "#343434ff";
  return trend > 0 ? "#41e23eff" : "#d94d4dff";
}

function buildTrendLabel(
  symbol: string,
  trend: number | null,
  trendFormatter: (v: number | null) => string,
) {
  const trendStr = trendFormatter(trend);
  return `{symbol|${symbol}}\n{trendValue|${trendStr}}`;
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

const treeMapLabel: TreemapSeriesOption["label"] = {
  formatter: (params: any) => {
    const node: TokenTreeMapNode = params.data.raw;

    return buildTrendLabel(node.symbol, node.trendValue, node.trendValueFmtr);
  },
  rich: {
    symbol: {
      padding: [32, 0, 0, 0],
      fontSize: 16,
      fontWeight: "bold",
      align: "center",
    },
    trendValue: {
      fontSize: 11,
      align: "center",
    },
  },
};

function buildTooltip() {
  return {
    trigger: "item" as const,
    formatter: () => {
      console.log(params);
      const node: TokenTreeMapNode = params.data.raw;

      const rows = node.tooltips
        .map((t) => {
          const value = t.valueFmtr(t.value);
          return `<div style="display:flex;justify-content:space-between;">
            <span>${t.label}</span>
            <span>${value}</span>
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

function buildTreemapOption(data: TokenTreeMapNode[]): EChartsOption {
  return {
    tooltip: buildTooltip(),
    series: [
      {
        type: "treemap",
        data: buildTreeNodes(data),
        scaleLimit: {
          min: 1.0,
        },

        label: treeMapLabel,

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
  height = 300,
  className,
}: TokenTreeMapProps) {
  const { fmt } = useLocalization();

  const options = useMemo(() => {
    return buildTreemapOption(data);
  }, [data, fmt]);

  return (
    <ReactECharts
      option={options}
      style={{ height }}
      onEvents={{
        treemapRoam: (e: any, chart: any) => {
          const zoom = chart.getOption().series[0].zoom;

          chart.dispatchAction({
            type: "treemapRootToNode",
            targetNode: null,
          });

          chart.setOption({
            series: [{ zoom }],
          });
        },
      }}
      className={className}
    />
  );
}
