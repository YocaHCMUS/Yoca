import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import type { InferResponseType } from "hono/client";
import { useMemo } from "react";
import { useParams } from "react-router";

type TransactionResponse = InferResponseType<
  (typeof client.api.transactions)[":transactions"]["$get"],
  200
>;

type TransactionDetails = TransactionResponse[number];

type EdgeAccumulator = {
  labels: string[];
};

function shortAddress(address: string): string {
  if (address.length <= 16) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function TransactionGraphDemo() {
  const { txHash } = useParams<{ txHash: string }>();
  const { fmt } = useLocalization();

  const transactionDetails = useGet(
    client.api.transactions[":transactions"],
    200,
    {
      param: {
        transactions: txHash || "",
      },
    },
    {
      enabled: !!txHash,
      select: (txDetails) => txDetails[0],
    },
  );

  const option = useMemo((): EChartsOption => {
    if (!transactionDetails.data || !txHash) {
      return {};
    }
    const transaction = transactionDetails.data;

    const addressSet = new Set<string>();
    for (const t of transaction.tokenTransfers) {
      addressSet.add(t.fromWallet);
      addressSet.add(t.toWallet);
    }

    for (const t of transaction.nativeTransfers) {
      addressSet.add(t.fromWallet);
      addressSet.add(t.toWallet);
    }

    const addresses = Array.from(addressSet);
    const nodeCount = addresses.length;
    const radius = Math.max(180, nodeCount * 24);
    const centerX = 640;
    const centerY = 360;

    const data = addresses.map((address, index) => {
      const angle = (2 * Math.PI * index) / Math.max(nodeCount, 1);

      return {
        id: address,
        name: shortAddress(address),
        value: address,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        itemStyle: {
          color: "#0f62fe",
          borderColor: "#001d6c",
          borderWidth: 1.5,
        },
      };
    });

    const links = [
      ...transaction.tokenTransfers.map((t, index) => ({
        source: t.fromWallet,
        target: t.toWallet,
        value: t.amount,
        label: {
          show: true,
          formatter: fmt.num.unit(
            t.amount,
            fmt.text.address(t.tokenAddress, {
              maxLength: 4,
            }),
          ),
        },
        lineStyle: {
          width: 2,
          opacity: 0.9,
          curveness: (index % 3) * 0.2, // helps separate overlapping edges
        },
      })),

      ...transaction.nativeTransfers.map((t, index) => ({
        source: t.fromWallet,
        target: t.toWallet,
        value: t.amount,
        label: {
          show: true,
          formatter: fmt.num.unit(t.amount, "SOL"),
        },
        lineStyle: {
          width: 2,
          opacity: 0.9,
          curveness: (index % 3) * 0.2,
        },
      })),
    ];

    type LinkType = (typeof links)[number];

    return {
      title: {
        text: `Transaction Graph - ${shortAddress(txHash)}`,
        left: 12,
        top: 10,
        textStyle: {
          fontSize: 14,
          fontWeight: 600,
        },
      },

      animationDurationUpdate: 1500,
      animationEasingUpdate: "quinticInOut",
      series: [
        {
          type: "graph" as const,
          layout: "none",
          roam: true,
          draggable: true,
          label: {
            show: true,
            fontSize: 10,
            color: "#fff",
          },
          symbol: "rect",
          symbolSize: [120, 120],
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [4, 10],
          edgeLabel: {
            show: true,
            fontSize: 11,
            formatter: "{b}",
            backgroundColor: "rgba(255,255,255,0.75)",
            borderRadius: 4,
            padding: [2, 4],
          },
          data,
          links,
          lineStyle: {
            opacity: 0.9,
            width: 2,
            curveness: 0,
            color: "#6f6f6f",
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: {
              width: 3,
            },
          },
        },
      ],
    };
  }, [transactionDetails.data, txHash, fmt]);

  if (!txHash) {
    return <div style={{ padding: 20 }}>Missing transaction hash.</div>;
  }

  if (transactionDetails.isLoading) {
    return <div style={{ padding: 20 }}>Loading transaction graph...</div>;
  }

  if (transactionDetails.error) {
    return <div style={{ padding: 20 }}>Failed to load transaction graph.</div>;
  }

  if (!option) {
    return (
      <div style={{ padding: 20 }}>No transaction transfer data found.</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: 12, fontSize: 14, color: "#666" }}>
        Transaction Graph - {shortAddress(txHash)}
      </div>
      <div style={{ flex: 1, minHeight: 480 }}>
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
