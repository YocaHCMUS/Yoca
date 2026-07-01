import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ChartSelect } from "./ChartSelect";
import { ChartTag } from "./ChartTag";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("calls onChange and marks the active option", () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        ariaLabel="View mode"
        options={[
          { value: "daily", label: "Daily" },
          { value: "both", label: "Both" },
        ]}
        value="daily"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Both" }));

    expect(onChange).toHaveBeenCalledWith("both");
  });
});

describe("ChartSelect", () => {
  const tokens = [
    { address: "token-a", symbol: "AAA", name: "Alpha" },
    { address: "token-b", symbol: "BBB", name: "Beta" },
  ];

  it("filters options, selects an item, closes, and fires the action", () => {
    const onChange = vi.fn();
    const onAction = vi.fn();

    render(
      <ChartSelect
        id="token-select"
        label="Select token"
        placeholder="Search token"
        value={null}
        items={tokens}
        onChange={onChange}
        getKey={(token) => token.address}
        getSearchText={(token) => `${token.symbol} ${token.name}`}
        renderValue={(token) => token.symbol}
        renderOption={(token) => <span>{token.name}</span>}
        actionIcon={Plus}
        actionLabel="Add token"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select token" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
      target: { value: "beta" },
    });

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));

    expect(onChange).toHaveBeenCalledWith(tokens[1]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add token" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("ChartTag", () => {
  it("fires dismiss only when dismissible", () => {
    const onDismiss = vi.fn();

    const { rerender } = render(
      <ChartTag label="SOL" value="+4%" onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<ChartTag label="SOL" value="+4%" />);

    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
