import {
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListSkeleton,
  StructuredListWrapper,
} from "@carbon/react";
import { ReactNode } from "react";

interface StrctLstHdr {
  key: string;
  header: ReactNode;
  textAlign?: "center" | "start" | "end";
}

interface StrctLstRw {
  [key: string]: ReactNode;
}

interface StrctLstProps {
  loading?: boolean;
  rows: StrctLstRw[];
  headers: StrctLstHdr[];
  className?: string;
}

export default function StrctLst({
  loading = false,
  rows,
  headers,
  className,
}: StrctLstProps) {
  if (loading) {
    return <StructuredListSkeleton />;
  }

  return (
    <StructuredListWrapper className={className}>
      <StructuredListHead>
        <StructuredListRow head>
          {headers.map((header) => (
            <StructuredListCell head style={{ textAlign: header.textAlign }}>
              {header.header}
            </StructuredListCell>
          ))}
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>
        {rows.map((row) => (
          <StructuredListRow>
            {headers.map((header) => (
              <StructuredListCell style={{ textAlign: header.textAlign }}>
                {row[header.key]}
              </StructuredListCell>
            ))}
          </StructuredListRow>
        ))}
      </StructuredListBody>
    </StructuredListWrapper>
  );
}
