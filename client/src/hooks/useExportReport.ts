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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function toProxyImageUrl(url: string): string {
  const apiDomain = import.meta.env.VITE_CLIENT_API_DOMAIN;
  const base = typeof apiDomain === "string" && apiDomain.length > 0
    ? apiDomain.replace(/\/$/, "")
    : "";
  return `${base}/api/misc/image-proxy?url=${encodeURIComponent(url)}`;
}

function rewriteCrossOriginImagesForCapture(element: HTMLElement): () => void {
  const images = Array.from(element.querySelectorAll<HTMLImageElement>("img"));
  const rollback: Array<() => void> = [];

  for (const image of images) {
    const originalSrc = image.getAttribute("src") ?? "";
    if (!originalSrc || originalSrc.startsWith("data:") || originalSrc.startsWith("blob:")) {
      continue;
    }

    let absoluteUrl: URL;
    try {
      absoluteUrl = new URL(originalSrc, window.location.href);
    } catch {
      continue;
    }

    if (absoluteUrl.origin === window.location.origin) {
      continue;
    }

    const previousCrossOrigin = image.getAttribute("crossorigin");
    const previousReferrerPolicy = image.getAttribute("referrerpolicy");

    image.setAttribute("src", toProxyImageUrl(absoluteUrl.toString()));
    image.setAttribute("crossorigin", "anonymous");
    image.setAttribute("referrerpolicy", "no-referrer");

    rollback.push(() => {
      image.setAttribute("src", originalSrc);
      if (previousCrossOrigin == null) {
        image.removeAttribute("crossorigin");
      } else {
        image.setAttribute("crossorigin", previousCrossOrigin);
      }
      if (previousReferrerPolicy == null) {
        image.removeAttribute("referrerpolicy");
      } else {
        image.setAttribute("referrerpolicy", previousReferrerPolicy);
      }
    });
  }

  return () => {
    for (const restore of rollback) {
      restore();
    }
  };
}

function hideExportOnlyElements(element: HTMLElement): () => void {
  const targets = Array.from(
    element.querySelectorAll<HTMLElement>(
      '[data-export-hide="copy-button"], button[title="Copy"], button[aria-label="Copy"]',
    ),
  );

  const rollback: Array<() => void> = [];
  for (const target of targets) {
    const previousDisplay = target.style.display;
    target.style.display = "none";
    rollback.push(() => {
      target.style.display = previousDisplay;
    });
  }

  return () => {
    for (const restore of rollback) {
      restore();
    }
  };
}

async function waitForReportReady(element: HTMLElement): Promise<void> {
  const timeoutMs = 8000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const hasSkeleton = element.querySelector(
      ".cds--skeleton, .cds--skeleton__placeholder",
    ) !== null;
    const hasBusyNode = element.querySelector('[aria-busy="true"]') !== null;

    const images = Array.from(element.querySelectorAll<HTMLImageElement>("img"));
    const hasPendingImages = images.some((img) => !img.complete);

    if (!hasSkeleton && !hasBusyNode && !hasPendingImages) {
      return;
    }

    await wait(150);
  }
}

function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll<HTMLImageElement>("img"));
  if (images.length === 0) {
    return Promise.resolve();
  }

  const waiters = images.map((img) => new Promise<void>((resolve) => {
    if (!img.getAttribute("loading")) {
      img.setAttribute("loading", "eager");
    }
    if (!img.getAttribute("decoding")) {
      img.setAttribute("decoding", "async");
    }

    if (img.complete) {
      resolve();
      return;
    }

    const handleDone = () => {
      img.removeEventListener("load", handleDone);
      img.removeEventListener("error", handleDone);
      resolve();
    };

    img.addEventListener("load", handleDone, { once: true });
    img.addEventListener("error", handleDone, { once: true });
  }));

  const timeout = new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 5000);
  });

  return Promise.race([
    Promise.all(waiters).then(() => undefined),
    timeout,
  ]);
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

    let restoreImageSources: (() => void) | null = null;
    let restoreExportOnlyElements: (() => void) | null = null;

    try {
      reportElement.style.display = "block";
      reportElement.style.visibility = "visible";
      reportElement.style.position = "fixed";
      reportElement.style.top = "0";
      reportElement.style.left = "0";
      reportElement.style.width = `${REPORT_CAPTURE_WIDTH_PX}px`;
      reportElement.style.height = "max-content";
      reportElement.style.maxHeight = "none";
      reportElement.style.overflow = "visible";
      reportElement.style.zIndex = "2147483647";
      reportElement.style.opacity = "0";
      reportElement.style.pointerEvents = "none";

      restoreImageSources = rewriteCrossOriginImagesForCapture(reportElement);
      restoreExportOnlyElements = hideExportOnlyElements(reportElement);

      await waitForFonts();
      await waitForReportReady(reportElement);
      await waitForImages(reportElement);
      await waitForPaint();
      await wait(200);

      const captureScale = REPORT_CAPTURE_SCALE;
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
      if (restoreImageSources) {
        restoreImageSources();
      }
      if (restoreExportOnlyElements) {
        restoreExportOnlyElements();
      }
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
