import { useCallback } from "react";
import type { RefObject } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const REPORT_CAPTURE_WIDTH_PX = 1024;
const REPORT_CAPTURE_SCALE = 2;

interface ExportReportOptions {
  filenameBase: string;
  reportRef: RefObject<HTMLElement | null>;
}

interface UseExportReportResult {
  exportReportAsPdf: () => Promise<void>;
}

function waitForFonts(): Promise<void> {
  if (!("fonts" in document) || !document.fonts?.ready) {
    return Promise.resolve();
  }

  return document.fonts.ready.then(() => undefined);
}

function waitForPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function appendCanvasAsSinglePdfPage(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirstPdfPage: boolean,
): boolean {
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const widthScale = pageWidthMm / canvas.width;
  const heightScale = pageHeightMm / canvas.height;
  const scale = Math.min(widthScale, heightScale);
  const imageWidthMm = canvas.width * scale;
  const imageHeightMm = canvas.height * scale;
  const imageData = canvas.toDataURL("image/png");

  if (!isFirstPdfPage) {
    pdf.addPage();
  }

  const offsetX = (pageWidthMm - imageWidthMm) / 2;
  const offsetY = (pageHeightMm - imageHeightMm) / 2;

  pdf.addImage(
    imageData,
    "PNG",
    offsetX,
    offsetY,
    imageWidthMm,
    imageHeightMm,
    undefined,
    "FAST",
  );

  return false;
}

export function useExportReport({
  filenameBase,
  reportRef,
}: ExportReportOptions): UseExportReportResult {
  const exportReportAsPdf = useCallback(async () => {
    const reportElement = reportRef.current;
    if (!reportElement) {
      throw new Error("Report template element is not available");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `${filenameBase}-${timestamp}.pdf`;

    const previousInlineStyle = {
      display: reportElement.style.display,
      visibility: reportElement.style.visibility,
      position: reportElement.style.position,
      top: reportElement.style.top,
      left: reportElement.style.left,
      width: reportElement.style.width,
      height: reportElement.style.height,
      maxHeight: reportElement.style.maxHeight,
      overflow: reportElement.style.overflow,
      zIndex: reportElement.style.zIndex,
      opacity: reportElement.style.opacity,
      pointerEvents: reportElement.style.pointerEvents,
    };

    try {
      reportElement.style.display = "block";
      reportElement.style.visibility = "visible";
      reportElement.style.position = "absolute";
      reportElement.style.top = "0";
      reportElement.style.left = "-9999px";
      reportElement.style.width = `${REPORT_CAPTURE_WIDTH_PX}px`;
      reportElement.style.height = "max-content";
      reportElement.style.maxHeight = "none";
      reportElement.style.overflow = "visible";
      reportElement.style.zIndex = "1";
      reportElement.style.opacity = "1";
      reportElement.style.pointerEvents = "none";

      await waitForFonts();
      await waitForPaint();

      const captureScale = Math.max(REPORT_CAPTURE_SCALE, window.devicePixelRatio || 1);
      const reportPages = Array.from(
        reportElement.querySelectorAll<HTMLElement>('[data-report-page="true"]'),
      );
      const captureTargets = reportPages.length > 0 ? reportPages : [reportElement];
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      let isFirstPdfPage = true;

      for (const captureTarget of captureTargets) {
        const canvas = await html2canvas(captureTarget, {
          useCORS: true,
          allowTaint: true,
          scale: captureScale,
          backgroundColor: "#ffffff",
          width: REPORT_CAPTURE_WIDTH_PX,
          windowWidth: REPORT_CAPTURE_WIDTH_PX,
          scrollX: 0,
          scrollY: 0,
          logging: false,
          foreignObjectRendering: false,
        });

        if (canvas.width <= 0 || canvas.height <= 0) {
          throw new Error("Report canvas dimensions are invalid");
        }

        isFirstPdfPage = appendCanvasAsSinglePdfPage(pdf, canvas, isFirstPdfPage);
      }

      pdf.save(filename);
    } finally {
      reportElement.style.display = previousInlineStyle.display;
      reportElement.style.visibility = previousInlineStyle.visibility;
      reportElement.style.position = previousInlineStyle.position;
      reportElement.style.top = previousInlineStyle.top;
      reportElement.style.left = previousInlineStyle.left;
      reportElement.style.width = previousInlineStyle.width;
      reportElement.style.height = previousInlineStyle.height;
      reportElement.style.maxHeight = previousInlineStyle.maxHeight;
      reportElement.style.overflow = previousInlineStyle.overflow;
      reportElement.style.zIndex = previousInlineStyle.zIndex;
      reportElement.style.opacity = previousInlineStyle.opacity;
      reportElement.style.pointerEvents = previousInlineStyle.pointerEvents;
    }
  }, [filenameBase, reportRef]);

  return { exportReportAsPdf };
}
