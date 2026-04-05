// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Table } from "./Table";

vi.mock("./TableWrapper", () => ({
    TableWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../charts/shared/ExportMenu", () => ({}));

vi.mock("@carbon/react", () => ({
    DataTable: ({ rows, headers, children }: any) => {
        const mappedRows = rows.map((row: any) => ({
            id: row.id,
            cells: headers.map((header: any) => ({
                id: `${row.id}-${header.key}`,
                value: row[header.key],
            })),
        }));

        return children({
            rows: mappedRows,
            headers,
            getTableProps: () => ({}),
            getHeaderProps: ({ header }: any) => ({ key: header.key, header }),
            getRowProps: ({ row }: any) => ({ key: row.id }),
        });
    },
    DataTableSkeleton: () => <div>loading</div>,
    Table: ({ children }: any) => <table>{children}</table>,
    TableHead: ({ children }: any) => <thead>{children}</thead>,
    TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
    TableHeader: ({ children, ...props }: any) => <th {...props}>{children}</th>,
    TableBody: ({ children }: any) => <tbody>{children}</tbody>,
    TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
    Pagination: () => <div>pagination</div>,
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    IconButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Slider: () => <div>slider</div>,
    Checkbox: () => <div>checkbox</div>,
    CheckboxGroup: ({ children }: any) => <div>{children}</div>,
    TableContainer: ({ children }: any) => <div>{children}</div>,
    Tag: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@carbon/react/icons", () => ({
    Filter: () => <span>filter</span>,
}));

describe("Table", () => {
    it("renders object fallback values as strings instead of React children", () => {
        render(
            <Table
                title="Test"
                headers={["Token"]}
                initialFilters={{}}
                fetcher={Promise.resolve([])}
                filterSchema={{}}
                dataEntries={[[{ symbol: "OBJ" }]]}
            />,
        );

        expect(screen.getByText('{"symbol":"OBJ"}')).toBeInTheDocument();
    });
});
