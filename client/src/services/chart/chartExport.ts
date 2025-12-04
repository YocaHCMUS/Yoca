/**
 * Chart Export Utility
 * 
 * Provides utility functions for chart export operations.
 * This module complements the useChartExport hook with additional export helpers.
 * 
 * @module chartExport
 */

import type { ChartDataSeries } from '../../types/chart-data.types';
import type { ExportMetadata } from '../../types/chart-filters.types';
import { isTimeSeriesPoint, isCategoricalPoint, isDistributionPoint } from '../../types/chart-data.types';

/**
 * Convert chart data series to CSV format
 */
export function convertToCSV(data: ChartDataSeries[], metadata: ExportMetadata): string {
  const lines: string[] = [];
  
  // Add metadata header
  lines.push(`# Chart: ${metadata.chartTitle}`);
  lines.push(`# Timezone: ${metadata.timezone}`);
  lines.push(`# Export Date: ${metadata.exportDate}`);
  lines.push(`# Time Period: ${metadata.filters.timePeriod}`);
  lines.push(`# Tokens: ${metadata.filters.tokens.join(', ')}`);
  lines.push(`# Transaction Type: ${metadata.filters.transactionType}`);
  if (metadata.filters.wallets) {
    lines.push(`# Wallets: ${metadata.filters.wallets.join(', ')}`);
  }
  lines.push(`# Data Points: ${metadata.dataPointCount}`);
  lines.push('');
  
  if (data.length === 0 || data[0].data.length === 0) {
    lines.push('No data available');
    return lines.join('\n');
  }
  
  const firstPoint = data[0].data[0];
  
  // Time series data format
  if (isTimeSeriesPoint(firstPoint)) {
    lines.push('Timestamp,ISO Date,Series,Value');
    
    data.forEach((series) => {
      series.data.forEach((point) => {
        if (isTimeSeriesPoint(point)) {
          const date = new Date(point.timestamp);
          lines.push(
            `${point.timestamp},${date.toISOString()},${escapeCsvValue(series.name)},${point.value}`
          );
        }
      });
    });
  }
  // Categorical data format
  else if (isCategoricalPoint(firstPoint)) {
    lines.push('Category,Series,Value');
    
    data.forEach((series) => {
      series.data.forEach((point) => {
        if (isCategoricalPoint(point)) {
          lines.push(`${escapeCsvValue(point.category)},${escapeCsvValue(series.name)},${point.value}`);
        }
      });
    });
  }
  // Distribution data format
  else if (isDistributionPoint(firstPoint)) {
    lines.push('Name,Series,Value');
    
    data.forEach((series) => {
      series.data.forEach((point) => {
        if (isDistributionPoint(point)) {
          lines.push(`${escapeCsvValue(point.name)},${escapeCsvValue(series.name)},${point.value}`);
        }
      });
    });
  }
  
  return lines.join('\n');
}

/**
 * Escape CSV values (handle commas, quotes, newlines)
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert data to JSON format
 */
export function convertToJSON(data: ChartDataSeries[], metadata: ExportMetadata): string {
  const exportData = {
    metadata,
    series: data,
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Calculate optimal image dimensions for export based on current chart size
 */
export function calculateExportDimensions(
  containerWidth: number,
  containerHeight: number,
  pixelRatio: number = 2
): { width: number; height: number } {
  return {
    width: containerWidth * pixelRatio,
    height: containerHeight * pixelRatio,
  };
}

/**
 * Validate export filename
 */
export function validateFilename(filename: string): boolean {
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
  if (invalidChars.test(filename)) {
    return false;
  }
  
  // Check length (Windows MAX_PATH limit)
  if (filename.length > 255) {
    return false;
  }
  
  return true;
}

/**
 * Sanitize filename by removing/replacing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Replace invalid characters with underscores
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
  let sanitized = filename.replace(invalidChars, '_');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > 200) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'));
    sanitized = sanitized.slice(0, 200 - ext.length) + ext;
  }
  
  return sanitized;
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: 'png' | 'svg' | 'csv' | 'json'): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    svg: 'image/svg+xml',
    csv: 'text/csv',
    json: 'application/json',
  };
  
  return mimeTypes[format] || 'application/octet-stream';
}

/**
 * Create a download link and trigger download
 */
export function triggerDownload(content: string | Blob, filename: string, mimeType?: string): void {
  let url: string;
  
  if (typeof content === 'string') {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    url = URL.createObjectURL(blob);
  } else {
    url = URL.createObjectURL(content);
  }
  
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizeFilename(filename);
  
  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Export utilities object
 */
export const chartExport = {
  convertToCSV,
  convertToJSON,
  calculateExportDimensions,
  validateFilename,
  sanitizeFilename,
  getMimeType,
  triggerDownload,
};
