import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetLegend } from "./AssetDistribution";

vi.mock("echarts-for-react", () => ({
  default: () => null,
}));

describe("AssetLegend", () => {
  it("renders Others as one row without hidden token names", () => {
    render(
      <AssetLegend
        othersLabel="Others"
        items={[
          { name: "USDC", value: 100, percentage: 80, color: "#2775ca" },
          {
            name: "Others",
            value: 25,
            percentage: 20,
            hiddenNames: ["HYPE", "ANSEM"],
            hiddenItems: [
              { name: "HYPE", value: 15, percentage: 12 },
              { name: "ANSEM", value: 10, percentage: 8 },
            ],
          },
        ] as never}
      />,
    );

    expect(screen.getByTestId("asset-distribution-legend")).toBeInTheDocument();
    expect(screen.getByText("Others")).toBeInTheDocument();
    expect(screen.queryByText("HYPE")).not.toBeInTheDocument();
    expect(screen.queryByText("ANSEM")).not.toBeInTheDocument();
  });
});
