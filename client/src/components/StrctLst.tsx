import {
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListSkeleton,
  StructuredListWrapper,
} from "@carbon/react";

interface StrctLstRw {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
  noWrapLabel?: boolean;
  noWrapValue?: boolean;
}

interface StrctLstProps {
  title?: string;
  loading?: boolean;
  rows: StrctLstRw[];
  className?: string;
}

export default function StrctLst({
  loading = false,
  rows,
  title,
  className,
}: StrctLstProps) {
  if (loading) {
    return <StructuredListSkeleton />;
  }

  return (
    <StructuredListWrapper className={className} isFlush>
      {title && (
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>{title}</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
      )}
      <StructuredListBody>
        {rows.map((row) => (
          <StructuredListRow key={row.id}>
            <StructuredListCell noWrap={row.noWrapLabel}>
              {row.label}
            </StructuredListCell>
            <StructuredListCell noWrap={row.noWrapValue}>
              <Stack style={{ justifyContent: "end" }}>{row.value}</Stack>
            </StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredListBody>
    </StructuredListWrapper>
  );
}
