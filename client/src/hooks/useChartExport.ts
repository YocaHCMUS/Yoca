/**
 * useChartExport Hook
 * 
 * Manages chart data export functionality (PNG, SVG, CSV formats).
 * 
 * @module useChartExport
 */

import { useState, useCallback } from 'react';
import type { RefObject } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { EChartsInstance } from '../util/echarts-setup';
import type { ExportFormat, ExportMetadata } from '../types/chart-filters.types';
import type { ChartFilters } from '../types/chart-filters.types';
import type { ChartDataSeries } from '../types/chart-data.types';

/**
 * Hook configuration options
 */
interface UseChartExportOptions {
  /** Chart title for metadata */
  chartTitle: string;
  
  /** Current timezone */
  timezone: string;
  
  /** Base filename (without extension) */
  baseFilename?: string;
}

/**
 * Hook return value
 */
interface UseChartExportReturn {
  /** Whether export is in progress */
  isExporting: boolean;
  
  /** Last export error */
  exportError: Error | null;
  
  /** Export chart as PNG */
  exportPNG: (chartInstance: EChartsInstance, filters: ChartFilters) => void;
  
  /** Export chart as SVG */
  exportSVG: (chartInstance: EChartsInstance, filters: ChartFilters) => void;

  /** Export chart as PDF */
  exportPDF: (chartInstance: EChartsInstance, filters: ChartFilters) => Promise<void>;
  
  /** Export chart data as CSV */
  exportCSV: (data: ChartDataSeries[], filters: ChartFilters, extraFilters?: Record<string, string>) => void;
  
  /** Export with custom configuration */
  exportChart: (
    format: ExportFormat,
    chartInstance: EChartsInstance | null,
    data: ChartDataSeries[],
    filters: ChartFilters
  ) => void;
}

/**
 * Generate filename following convention: data_name-filters-timestamp.ext
 */
function generateFilename(
  baseName: string,
  filters: ChartFilters,
  format: ExportFormat
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5); // Remove milliseconds and Z
  
  const filterParts: string[] = [
    filters.timePeriod,
    filters.tokens?.join(',') || 'all-tokens',
    filters.transactionType !== 'all' ? filters.transactionType : null,
  ].filter(Boolean) as string[];
  
  const filterStr = filterParts.join('-');
  return `${baseName}-${filterStr}-${timestamp}.${format}`;
}

/**
 * Trigger browser download
 */
function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function decodeSvgDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Invalid SVG data URL');
  }

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);

  if (metadata.includes(';base64')) {
    return atob(payload);
  }

  return decodeURIComponent(payload);
}

function generatePagePdfFilename(baseName: string): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  return `${baseName}-${timestamp}.pdf`;
}

function exportCanvasAsSinglePagePdf(canvas: HTMLCanvasElement, filename: string): void {
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
    compress: true,
  });
  const image = canvas.toDataURL('image/png');
  pdf.addImage(image, 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
  pdf.save(filename);
}

function exportLongCanvasAsA4Pdf(canvas: HTMLCanvasElement, filename: string): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageWidth = pageWidth;
  const imageHeight = (canvas.height * imageWidth) / canvas.width;
  const image = canvas.toDataURL('image/png');

  let remainingHeight = imageHeight;
  let positionY = 0;

  pdf.addImage(image, 'PNG', 0, positionY, imageWidth, imageHeight, undefined, 'FAST');
  remainingHeight -= pageHeight;

  while (remainingHeight > 0) {
    positionY = remainingHeight - imageHeight;
    pdf.addPage();
    pdf.addImage(image, 'PNG', 0, positionY, imageWidth, imageHeight, undefined, 'FAST');
    remainingHeight -= pageHeight;
  }

  pdf.save(filename);
}

interface ExportElementPdfOptions {
  filename?: string;
  baseFilename?: string;
  scale?: number;
  backgroundColor?: string;
  imageType?: 'PNG' | 'JPEG';
  imageQuality?: number;
  maxPdfDimensionPx?: number;
}

const DEFAULT_CAPTURE_BLOCKING_SELECTORS = [
  '.cds--skeleton',
  '.cds--skeleton__text',
  '.cds--loading',
  '.cds--inline-loading',
  '[aria-busy="true"]',
];

type InlineStyleSnapshot = Partial<Record<'height' | 'maxHeight' | 'overflow' | 'overflowX' | 'overflowY' | 'width', string>>;

function createElementFilename(baseFilename?: string, filename?: string): string {
  if (filename && filename.trim().length > 0) {
    return filename;
  }

  return generatePagePdfFilename(baseFilename || 'dashboard-export');
}

function waitForFontsReady(): Promise<void> {
  if (!('fonts' in document) || !document.fonts?.ready) {
    return Promise.resolve();
  }

  return document.fonts.ready.then(() => undefined);
}

function waitForImagesInElement(target: HTMLElement): Promise<void> {
  const imageElements = Array.from(target.querySelectorAll('img'));
  const pending = imageElements.filter((img) => !img.complete);

  if (pending.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

function nextPaintFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function hasCaptureBlockingElements(target: HTMLElement): boolean {
  return DEFAULT_CAPTURE_BLOCKING_SELECTORS.some((selector) => {
    const matches = target.querySelector(selector);
    return Boolean(matches);
  });
}

async function waitForCaptureReadiness(target: HTMLElement, timeoutMs = 10000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime <= timeoutMs) {
    await waitForFontsReady();
    await waitForImagesInElement(target);

    if (!hasCaptureBlockingElements(target)) {
      return;
    }

    await sleep(200);
  }
}

function applyCloneCaptureStyles(target: HTMLElement): void {
  target.style.height = 'max-content';
  target.style.maxHeight = 'none';
  target.style.overflow = 'visible';
  target.style.overflowX = 'visible';
  target.style.overflowY = 'visible';
  target.style.width = `${Math.max(target.clientWidth, target.scrollWidth, 1)}px`;

  const descendants = Array.from(target.querySelectorAll<HTMLElement>('*'));
  for (const element of descendants) {
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';
    element.style.overflowX = 'visible';
    element.style.overflowY = 'visible';
  }
}

function clampPdfPageSize(canvasWidth: number, canvasHeight: number, maxDimensionPx: number): {
  pageWidth: number;
  pageHeight: number;
} {
  const widthScale = maxDimensionPx / canvasWidth;
  const heightScale = maxDimensionPx / canvasHeight;
  const scale = Math.min(1, widthScale, heightScale);

  return {
    pageWidth: Math.max(1, Math.floor(canvasWidth * scale)),
    pageHeight: Math.max(1, Math.floor(canvasHeight * scale)),
  };
}

function exportCanvasAsLongSinglePagePdf(
  canvas: HTMLCanvasElement,
  filename: string,
  imageType: 'PNG' | 'JPEG',
  imageQuality: number,
  maxPdfDimensionPx: number,
): void {
  const { pageWidth, pageHeight } = clampPdfPageSize(canvas.width, canvas.height, maxPdfDimensionPx);
  const pdf = new jsPDF({
    orientation: pageWidth >= pageHeight ? 'landscape' : 'portrait',
    unit: 'px',
    format: [pageWidth, pageHeight],
    compress: true,
  });

  const imageFormat = imageType === 'JPEG' ? 'image/jpeg' : 'image/png';
  const imageData = canvas.toDataURL(imageFormat, imageQuality);

  pdf.addImage(imageData, imageType, 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  pdf.save(filename);
}

export async function exportElementRefAsPdf(
  targetRef: RefObject<HTMLElement | null>,
  options?: ExportElementPdfOptions,
): Promise<void> {
  const element = targetRef.current;

  if (!element) {
    throw new Error('Export target is unavailable');
  }

  const filename = createElementFilename(options?.baseFilename, options?.filename);
  const backgroundColor = options?.backgroundColor ?? '#ffffff';
  const imageType = options?.imageType ?? 'PNG';
  const imageQuality = options?.imageQuality ?? 1;
  const maxPdfDimensionPx = options?.maxPdfDimensionPx ?? 14000;

  const exportMarker = `pdf-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  element.setAttribute('data-pdf-export-target', exportMarker);

  try {
    await nextPaintFrame();
    await waitForCaptureReadiness(element);
    await nextPaintFrame();

    const captureWidth = Math.max(element.scrollWidth, element.clientWidth, element.offsetWidth, 1);
    const captureHeight = Math.max(element.scrollHeight, element.clientHeight, element.offsetHeight, 1);
    const scale = options?.scale ?? Math.min(2, Math.max(1, window.devicePixelRatio || 1));

    const canvas = await html2canvas(element, {
      backgroundColor,
      scale,
      useCORS: true,
      allowTaint: true,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      width: captureWidth,
      height: captureHeight,
      scrollX: 0,
      scrollY: 0,
      logging: false,
      foreignObjectRendering: false,
      onclone: (clonedDocument) => {
        const clonedTarget = clonedDocument.querySelector(`[data-pdf-export-target="${exportMarker}"]`) as HTMLElement | null;
        if (clonedTarget) {
          applyCloneCaptureStyles(clonedTarget);
        }
      },
    });

    exportCanvasAsLongSinglePagePdf(canvas, filename, imageType, imageQuality, maxPdfDimensionPx);
  } finally {
    element.removeAttribute('data-pdf-export-target');
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image for PDF export'));
    image.src = url;
  });
}

async function renderSvgToCanvas(svg: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function exportCurrentPageAsPdf(options?: {
  title?: string;
  baseFilename?: string;
  filename?: string;
}): Promise<void> {
  const rootRef: RefObject<HTMLElement | null> = { current: document.body as HTMLElement };
  await exportElementRefAsPdf(rootRef, {
    filename: options?.filename,
    baseFilename: options?.baseFilename || 'page-export',
  });
}

/**
 * Convert chart data to CSV format with metadata
 */
function dataToCSV(
  data: ChartDataSeries[],
  metadata: ExportMetadata
): string {
  const lines: string[] = [];
  
  // Add metadata header
  lines.push(`# Chart: ${metadata.chartTitle}`);
  lines.push(`# Timezone: ${metadata.timezone}`);
  lines.push(`# Export Date: ${metadata.exportDate}`);

  const f = metadata.filters;
  const filterParts: string[] = [];
  if (f.timePeriod) filterParts.push(`Period: ${f.timePeriod}`);
  if (f.wallets && f.wallets.length > 0) filterParts.push(`Wallets: ${f.wallets.join(', ')}`);
  if (f.tokens && f.tokens.length > 0) filterParts.push(`Tokens: ${f.tokens.join(', ')}`);
  if (f.transactionType && f.transactionType !== 'all') filterParts.push(`Transaction Type: ${f.transactionType}`);
  if (metadata.extraFilters) {
    Object.entries(metadata.extraFilters).forEach(([k, v]) => filterParts.push(`${k}: ${v}`));
  }
  lines.push(`# Filters: ${filterParts.join(' | ')}`);

  lines.push(`# Data Points: ${metadata.dataPointCount}`);
  lines.push('');
  
  // Determine CSV format based on data structure
  if (data.length > 0 && data[0].data.length > 0) {
    const firstPoint = data[0].data[0];
    
    // Time series data
    if ('timestamp' in firstPoint) {
      lines.push('Timestamp,Series,Value');
      
      data.forEach((series) => {
        series.data.forEach((point) => {
          if ('timestamp' in point) {
            const date = new Date(point.timestamp).toISOString();
            lines.push(`${date},${series.name},${point.value}`);
          }
        });
      });
    }
    // Categorical data
    else if ('category' in firstPoint) {
      lines.push('Category,Series,Value');
      
      data.forEach((series) => {
        series.data.forEach((point) => {
          if ('category' in point) {
            lines.push(`${point.category},${series.name},${point.value}`);
          }
        });
      });
    }
    // Distribution data — pivot: token names as rows, each series (wallet) as a column
    else if ('name' in firstPoint) {
      // Extract wallet address from series name (strip "Assets Distribution - " prefix if present)
      const walletHeaders = data.map(s =>
        s.name.replace(/^Assets Distribution\s*-\s*/i, '')
      );
      lines.push(`Name,${walletHeaders.join(',')}`);

      // Build a map: tokenName → { seriesIndex → value }
      const tokenMap = new Map<string, Map<number, number>>();
      data.forEach((series, si) => {
        series.data.forEach((point) => {
          if ('name' in point) {
            if (!tokenMap.has(point.name)) tokenMap.set(point.name, new Map());
            tokenMap.get(point.name)!.set(si, point.value as number);
          }
        });
      });

      tokenMap.forEach((valuesBySeries, tokenName) => {
        const row = data.map((_, si) => valuesBySeries.get(si) ?? '');
        lines.push(`${tokenName},${row.join(',')}`);
      });
    }
  }
  
  return lines.join('\n');
}

/**
 * Custom hook for managing chart export functionality
 * 
 * @example
 * ```tsx
 * const { isExporting, exportPNG, exportCSV } = useChartExport({
 *   chartTitle: 'Balance Trend',
 *   timezone: 'America/New_York',
 *   baseFilename: 'balance'
 * });
 * 
 * // Export as PNG
 * exportPNG(chartInstance, filters);
 * 
 * // Export as CSV
 * exportCSV(chartData, filters);
 * ```
 */
export function useChartExport(options: UseChartExportOptions): UseChartExportReturn {
  const { chartTitle, timezone, baseFilename = 'chart' } = options;
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  
  /**
   * Export as PNG
   */
  const exportPNG = useCallback(
    (chartInstance: EChartsInstance, filters: ChartFilters) => {
      setIsExporting(true);
      setExportError(null);
      
      try {
        const url = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2, // Retina quality
          backgroundColor: '#fff',
        });
        
        const filename = generateFilename(baseFilename, filters, 'png');
        downloadFile(url, filename);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('PNG export failed');
        setExportError(err);
        console.error('PNG export error:', error);
      } finally {
        setIsExporting(false);
      }
    },
    [baseFilename]
  );
  
  /**
   * Export as SVG
   */
  const exportSVG = useCallback(
    (chartInstance: EChartsInstance, filters: ChartFilters) => {
      setIsExporting(true);
      setExportError(null);
      
      try {
        const url = chartInstance.getDataURL({
          type: 'svg',
          backgroundColor: '#fff',
        });
        
        const filename = generateFilename(baseFilename, filters, 'svg');
        downloadFile(url, filename);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('SVG export failed');
        setExportError(err);
        console.error('SVG export error:', error);
      } finally {
        setIsExporting(false);
      }
    },
    [baseFilename]
  );

  const exportPDF = useCallback(
    async (chartInstance: EChartsInstance, filters: ChartFilters) => {
      setIsExporting(true);
      setExportError(null);

      try {
        const svgDataUrl = chartInstance.getDataURL({
          type: 'svg',
          backgroundColor: '#fff',
        });
        const svg = decodeSvgDataUrl(svgDataUrl);

        const chartDom = chartInstance.getDom() as HTMLElement;
        const width = Math.max(800, Math.round(chartDom.clientWidth || 1200));
        const height = Math.max(450, Math.round(chartDom.clientHeight || 600));
        const canvas = await renderSvgToCanvas(svg, width, height);
        const filename = generateFilename(baseFilename, filters, 'pdf');
        exportCanvasAsSinglePagePdf(canvas, filename);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('PDF export failed');
        setExportError(err);
        console.error('PDF export error:', error);
      } finally {
        setIsExporting(false);
      }
    },
    [baseFilename, chartTitle]
  );
  
  /**
   * Export as CSV
   */
  const exportCSV = useCallback(
    (data: ChartDataSeries[], filters: ChartFilters, extraFilters?: Record<string, string>) => {
      setIsExporting(true);
      setExportError(null);
      
      try {
        const metadata: ExportMetadata = {
          chartTitle,
          timezone,
          filters,
          exportDate: new Date().toISOString(),
          dataPointCount: data.reduce((sum, series) => sum + series.data.length, 0),
          extraFilters,
        };
        
        const csvContent = dataToCSV(data, metadata);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const filename = generateFilename(baseFilename, filters, 'csv');
        downloadFile(url, filename);
        
        // Clean up blob URL
        URL.revokeObjectURL(url);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('CSV export failed');
        setExportError(err);
        console.error('CSV export error:', error);
      } finally {
        setIsExporting(false);
      }
    },
    [baseFilename, chartTitle, timezone]
  );
  
  /**
   * Generic export function
   */
  const exportChart = useCallback(
    (
      format: ExportFormat,
      chartInstance: EChartsInstance | null,
      data: ChartDataSeries[],
      filters: ChartFilters
    ) => {
      if (format === 'csv') {
        exportCSV(data, filters);
      } else if (chartInstance) {
        if (format === 'png') {
          exportPNG(chartInstance, filters);
        } else if (format === 'pdf') {
          exportPDF(chartInstance, filters);
        } else if (format === 'svg') {
          exportSVG(chartInstance, filters);
        }
      } else {
        setExportError(new Error('Chart instance required for PNG/SVG export'));
      }
    },
    [exportPNG, exportSVG, exportPDF, exportCSV]
  );
  
  return {
    isExporting,
    exportError,
    exportPNG,
    exportSVG,
    exportPDF,
    exportCSV,
    exportChart,
  };
}
