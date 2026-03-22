/**
 * useChartExport Hook
 * 
 * Manages chart data export functionality (PNG, SVG, CSV formats).
 * 
 * @module useChartExport
 */

import { useState, useCallback } from 'react';
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

function resolvePdfExportUrl(): string {
  const apiDomain = (import.meta.env.VITE_CLIENT_API_DOMAIN as string | undefined)?.trim();
  if (apiDomain && apiDomain.length > 0) {
    return `${apiDomain}/api/charts/export/pdf`;
  }
  return `${window.location.origin}/api/charts/export/pdf`;
}

function createPageSnapshotHtml(): { html: string; width: number; height: number } {
  const rootClone = document.documentElement.cloneNode(true) as HTMLElement;

  const originalControls = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
  const clonedControls = rootClone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');

  originalControls.forEach((control, index) => {
    const clone = clonedControls[index];
    if (!clone) return;

    if (control instanceof HTMLInputElement) {
      clone.value = control.value;
      clone.setAttribute('value', control.value);
      clone.checked = control.checked;
      if (control.checked) clone.setAttribute('checked', 'checked');
      if (!control.checked) clone.removeAttribute('checked');
      return;
    }

    if (control instanceof HTMLTextAreaElement) {
      clone.value = control.value;
      clone.textContent = control.value;
      return;
    }

    if (control instanceof HTMLSelectElement) {
      clone.value = control.value;
      Array.from(clone.options).forEach((option) => {
        if (option.value === control.value) {
          option.setAttribute('selected', 'selected');
        } else {
          option.removeAttribute('selected');
        }
      });
    }
  });

  const originalCanvases = document.querySelectorAll<HTMLCanvasElement>('canvas');
  const clonedCanvases = rootClone.querySelectorAll<HTMLCanvasElement>('canvas');

  originalCanvases.forEach((canvas, index) => {
    const clonedCanvas = clonedCanvases[index];
    if (!clonedCanvas || !clonedCanvas.parentNode) return;

    try {
      const image = document.createElement('img');
      image.src = canvas.toDataURL('image/png');
      image.width = canvas.width;
      image.height = canvas.height;
      image.style.width = `${canvas.clientWidth}px`;
      image.style.height = `${canvas.clientHeight}px`;
      image.style.display = 'block';
      clonedCanvas.parentNode.replaceChild(image, clonedCanvas);
    } catch {
      // Ignore canvases that cannot be serialized due to browser security restrictions.
    }
  });

  rootClone.querySelectorAll('script').forEach((script) => script.remove());

  const head = rootClone.querySelector('head');
  if (head) {
    const base = document.createElement('base');
    base.href = `${window.location.origin}/`;
    head.prepend(base);
  }

  const html = `<!doctype html>${rootClone.outerHTML}`;
  const doc = document.documentElement;
  const body = document.body;
  const measuredWidth = Math.max(
    1024,
    window.innerWidth,
    doc.scrollWidth,
    doc.offsetWidth,
    body?.scrollWidth ?? 0,
    body?.offsetWidth ?? 0
  );
  const measuredHeight = Math.max(
    768,
    window.innerHeight,
    doc.scrollHeight,
    doc.offsetHeight,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0
  );
  const width = Math.min(3000, measuredWidth);
  const height = Math.min(14000, measuredHeight);

  return { html, width, height };
}

export async function exportCurrentPageAsPdf(options?: {
  title?: string;
  baseFilename?: string;
  filename?: string;
}): Promise<void> {
  const snapshot = createPageSnapshotHtml();
  const response = await fetch(resolvePdfExportUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: options?.title || document.title || 'page',
      html: snapshot.html,
      width: snapshot.width,
      height: snapshot.height,
    }),
  });

  if (!response.ok) {
    throw new Error(`Page PDF export failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const filename = options?.filename || generatePagePdfFilename(options?.baseFilename || 'page-export');
  downloadFile(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

        const response = await fetch(resolvePdfExportUrl(), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: chartTitle,
            svg,
            width,
            height,
          }),
        });

        if (!response.ok) {
          throw new Error(`PDF export failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const filename = generateFilename(baseFilename, filters, 'pdf');
        downloadFile(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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
