import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import styles from "./Tble.module.scss";

interface TblePaginationProps {
  page: number;
  pageSize: number;
  pageSizes?: number[];
  totalItems: number;
  pageUnknown?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

// Shares Tble's own pagination markup/styles so every table's page-size
// picker is a themed custom dropdown, not a native <select> popup.
export function TblePagination({
  page,
  pageSize,
  pageSizes = [8, 16, 24, 32],
  totalItems,
  pageUnknown = false,
  onPageChange,
  onPageSizeChange,
}: TblePaginationProps) {
  const { tr } = useLocalization();
  const { themeRef } = useUserTheme();
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [pageSizePos, setPageSizePos] = useState<CSSProperties>({});
  const pageSizeTriggerRef = useRef<HTMLButtonElement>(null);
  const pageSizePopupRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (!pageSizeOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        !pageSizePopupRef.current?.contains(event.target as Node) &&
        !pageSizeTriggerRef.current?.contains(event.target as Node)
      ) {
        setPageSizeOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPageSizeOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pageSizeOpen]);

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationText}>
        {pageUnknown
          ? tr("table.page", { count: page })
          : tr("table.pageRangeText", { count: page, total: totalPages })}
      </span>
      {pageSizes.length > 1 && (
        <label className={styles.pageSizeControl}>
          <span>{tr("table.itemsPerPageText")}</span>
          <div className={styles.customSelect}>
            <button
              ref={pageSizeTriggerRef}
              type="button"
              className={styles.customSelectTrigger}
              onClick={() => {
                if (!pageSizeOpen) {
                  const rect = pageSizeTriggerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setPageSizePos({ top: rect.bottom + 4, left: Math.max(4, rect.left) });
                  }
                }
                setPageSizeOpen((prev) => !prev);
              }}
            >
              {pageSize}
              <ChevronDown size={13} />
            </button>
            {pageSizeOpen && (() => {
              const pageSizePopup = (
                <div ref={pageSizePopupRef} className={styles.pageSizePopup} style={pageSizePos}>
                  {pageSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={styles.pageSizeOption}
                      aria-selected={size === pageSize}
                      onClick={() => {
                        onPageSizeChange(size);
                        setPageSizeOpen(false);
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              );
              const portalTarget = themeRef.current;
              return portalTarget ? createPortal(pageSizePopup, portalTarget) : pageSizePopup;
            })()}
          </div>
        </label>
      )}
      <div className={styles.pageButtons}>
        <button
          type="button"
          aria-label={tr("table.previousPage")}
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          aria-label={tr("table.nextPage")}
          disabled={!pageUnknown && page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
