import type { EChartsInstance } from '@/util/echarts-setup';
import type { ChartDataSeries } from '@/types/chart-data.types';
import type { ChartFilters, ExportFormat } from '@/types/chart-filters.types';

interface ChartExportHandlers {
  exportPNG: (chartInstance: EChartsInstance, filters: ChartFilters) => void;
  exportSVG: (chartInstance: EChartsInstance, filters: ChartFilters) => void;
  exportCSV: (
    data: ChartDataSeries[],
    filters: ChartFilters,
    extraFilters?: Record<string, string>
  ) => void;
}

interface RunChartExportOptions {
  format: ExportFormat;
  filters: ChartFilters;
  chartInstance: EChartsInstance | null;
  csvData?: ChartDataSeries[];
  csvFilters?: ChartFilters;
  extraFilters?: Record<string, string>;
}

export function runChartExport(
  options: RunChartExportOptions,
  handlers: ChartExportHandlers
): void {
  const {
    format,
    filters,
    chartInstance,
    csvData,
    csvFilters,
    extraFilters,
  } = options;

  if (format === 'csv') {
    if (!csvData || csvData.length === 0) {
      console.error('CSV export failed: no chart data available');
      return;
    }

    handlers.exportCSV(csvData, csvFilters ?? filters, extraFilters);
    return;
  }

  if (!chartInstance) {
    console.error('Chart instance not available for image export');
    return;
  }

  if (format === 'png') {
    handlers.exportPNG(chartInstance, filters);
    return;
  }

  handlers.exportSVG(chartInstance, filters);
}
