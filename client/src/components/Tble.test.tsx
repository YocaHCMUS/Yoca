import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Tble, { TbleFilterType, TbleSortType } from "./Tble";

vi.mock("@/contexts/ThemeContext", () => ({
  useUserTheme: () => ({ themeRef: { current: null } }),
}));

vi.mock("@/contexts/LocalizationContext", () => ({
  useLocalization: () => ({
    tr: (key: string, params?: Record<string, unknown>) => {
      if (key === "table.filterLabel") return `Filter: ${params?.column ?? ""}`;
      if (key === "table.apply") return "Apply";
      if (key === "table.searchPlaceholder") return "Search table...";
      if (key === "table.searchAriaLabel") return "Search table";
      if (key === "table.filterSearchPlaceholder") return "Search table...";
      if (key === "table.pageRangeText") return `Page ${params?.count} of ${params?.total}`;
      if (key === "table.page") return `Page ${params?.count}`;
      if (key === "table.itemsPerPageText") return "Items per page";
      if (key === "table.previousPage") return "Previous page";
      if (key === "table.nextPage") return "Next page";
      if (key === "table.from") return "Min";
      if (key === "table.to") return "Max";
      if (key === "table.clearFilter") return "Clear filter";
      if (key === "common.cancel") return "Cancel";
      if (key === "common.loading") return "Loading";
      if (key === "common.noData") return "No data";
      return key;
    },
  }),
}));

const rows = [
  { id: "row-1", token: "Bravo", address: "mint-bravo", category: "Group B", value: 5 },
  { id: "row-2", token: "Alpha", address: "mint-alpha", category: "Group A", value: 10 },
  { id: "row-3", token: "Charlie", address: "mint-charlie", category: "Group A", value: 2 },
];

const headers = [
  { key: "token", header: "Token" },
  { key: "category", header: "Category" },
  { key: "value", header: "Value", align: "end" as const },
  { key: "mixed", header: "Mixed" },
];

function renderTable(extraProps: Partial<Parameters<typeof Tble>[0]> = {}) {
  return render(
    <Tble
      rows={rows}
      headers={headers}
      sortConfigs={{
        token: { type: TbleSortType.String },
        value: { type: TbleSortType.Number },
      }}
      filterSchema={{
        token: { type: TbleFilterType.Select },
        value: { type: TbleFilterType.Range, min: 0, max: 20, step: 1 },
        mixed: {
          type: TbleFilterType.Composite,
          filters: {
            category: { type: TbleFilterType.Select, field: "category" },
            value: { type: TbleFilterType.Range, field: "value", min: 0, max: 20, step: 1 },
          },
        },
      }}
      {...extraProps}
    />,
  );
}

describe("Tble native sort, search, and filters", () => {
  it("sorts numeric columns", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Value" }));

    expect(screen.getByText("Alpha").compareDocumentPosition(screen.getByText("Bravo"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(screen.getByRole("button", { name: "Value" }));

    expect(screen.getByText("Charlie").compareDocumentPosition(screen.getByText("Bravo"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("searches configured fields", () => {
    renderTable({ enableSearch: true, searchFields: ["address"] });

    fireEvent.change(screen.getByRole("textbox", { name: "Search table" }), {
      target: { value: "charlie" },
    });

    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
  });

  it("filters by selected token, searches checkbox options, and removes the active filter", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Filter: Token" }));
    const dialog = screen.getByRole("dialog", { name: "Filter: Token" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search table..." }), {
      target: { value: "alp" },
    });

    expect(within(dialog).queryByLabelText("Bravo")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText("Alpha"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
    expect(screen.getByText("Token: Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));

    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("filters numeric ranges with the slider", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Filter: Value" }));
    fireEvent.change(screen.getAllByLabelText("Min")[0], { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("applies composite child filters together", () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Filter: Mixed" }));
    const dialog = screen.getByRole("dialog", { name: "Filter: Mixed" });
    fireEvent.click(within(dialog).getByLabelText("Group A"));
    fireEvent.change(within(dialog).getAllByLabelText("Min")[0], { target: { value: "6" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
    expect(screen.getByText("Mixed: category: Group A; value: 6-*"))
      .toBeInTheDocument();
  });

  it("renders JSX row values without a cell renderer", () => {
    renderTable({
      rows: [
        {
          id: "jsx-row",
          token: <strong>Rendered token node</strong>,
          category: "Group A",
          value: 1,
        },
      ],
    });

    expect(screen.getByText("Rendered token node")).toBeInTheDocument();
  });

  it("uses cell renderers before raw JSX row values", () => {
    renderTable({
      rows: [
        {
          id: "jsx-renderer-row",
          token: <strong>Raw token node</strong>,
          category: "Group A",
          value: 1,
        },
      ],
      cellRenderers: {
        token: () => <span>Renderer token node</span>,
      },
    });

    expect(screen.getByText("Renderer token node")).toBeInTheDocument();
    expect(screen.queryByText("Raw token node")).not.toBeInTheDocument();
  });

  it("does not render plain object values without a cell renderer", () => {
    renderTable({
      rows: [
        {
          id: "object-row",
          token: { label: "Object token" },
          category: "Group A",
          value: 1,
        },
      ],
    });

    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
    expect(screen.queryByText("Object token")).not.toBeInTheDocument();
  });

  it("keeps cell renderers, pagination, and row click behavior", () => {
    const onRowClick = vi.fn();
    renderTable({
      enablePagination: true,
      pageSize: 1,
      cellRenderers: {
        token: (value) => <strong>Token {String(value)}</strong>,
      },
      onRowClick,
    });

    expect(screen.getByText("Token Bravo")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Token Bravo"));

    expect(onRowClick).toHaveBeenCalledWith(rows[0], 0);
  });
  it("keeps rows visible and emits search changes in server filtering mode", () => {
    const onSearchChange = vi.fn();
    renderTable({
      enableSearch: true,
      searchFields: ["address"],
      searchValue: "charlie",
      onSearchChange,
      clientFiltering: false,
    });

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search table" }), {
      target: { value: "alpha" },
    });

    expect(onSearchChange).toHaveBeenCalledWith("alpha");
  });

  it("emits controlled filter changes without local filtering in server mode", () => {
    const onFilterValuesChange = vi.fn();
    renderTable({
      clientFiltering: false,
      filterValues: {},
      onFilterValuesChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter: Token" }));
    const dialog = screen.getByRole("dialog", { name: "Filter: Token" });
    fireEvent.click(within(dialog).getByLabelText("Alpha"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(onFilterValuesChange).toHaveBeenCalledWith({ token: ["Alpha"] });
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("emits controlled sort changes without local sorting in server mode", () => {
    const onSortChange = vi.fn();
    renderTable({
      clientSorting: false,
      sortValue: null,
      onSortChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Value" }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "value", direction: "desc" });
    expect(screen.getByText("Bravo").compareDocumentPosition(screen.getByText("Alpha"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});




