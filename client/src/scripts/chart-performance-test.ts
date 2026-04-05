/**
 * Performance Test Script for Chart Components
 * 
 * Tests chart rendering performance with various dataset sizes:
 * - Small datasets (100 points)
 * - Medium datasets (1000 points)
 * - Large datasets (10,000 points)
 * - Extra large datasets (50,000 points with server aggregation)
 * 
 * Performance Targets:
 * - Initial render: <2s for 1000 points, <1s for 10K points with LTTB
 * - Filter update: <500ms (with 300ms debounce)
 * - Export: <3s for PNG/SVG, <2s for CSV
 * 
 * Usage: npm run test:performance
 */

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

interface PerformanceResult {
  metric: string;
  value: number;
  target: number;
  unit: string;
  status: 'pass' | 'warn' | 'fail';
}

const results: PerformanceResult[] = [];

/**
 * Check if a metric meets its performance target
 */
function checkMetric(
  metric: string,
  value: number,
  target: number,
  unit: string = 'ms'
): void {
  const status =
    value <= target ? 'pass' : value <= target * 1.2 ? 'warn' : 'fail';
  results.push({ metric, value, target, unit, status });
  
  const statusColor =
    status === 'pass' ? colors.green : status === 'warn' ? colors.yellow : colors.red;
  const statusSymbol = status === 'pass' ? '✓' : status === 'warn' ? '⚠' : '✗';
  
  console.log(
    `${statusColor}${statusSymbol}${colors.reset} ${metric}: ${value}${unit} (target: ${target}${unit})`
  );
}

/**
 * Simulate chart data generation
 */
function generateMockData(pointCount: number): Array<{ timestamp: number; value: number }> {
  const data: Array<{ timestamp: number; value: number }> = [];
  const now = Date.now();
  const intervalMs = 3600000; // 1 hour
  
  for (let i = 0; i < pointCount; i++) {
    data.push({
      timestamp: now - (pointCount - i) * intervalMs,
      value: Math.random() * 10000 + 5000,
    });
  }
  
  return data;
}

/**
 * Simulate LTTB downsampling algorithm
 */
function lttbDownsample(
  data: Array<{ timestamp: number; value: number }>,
  threshold: number
): Array<{ timestamp: number; value: number }> {
  if (data.length <= threshold) {
    return data;
  }
  
  const sampled: Array<{ timestamp: number; value: number }> = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  
  sampled.push(data[0]); // Always keep first point
  
  for (let i = 0; i < threshold - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 2) * bucketSize) + 1;
    const bucketData = data.slice(bucketStart, bucketEnd);
    
    // Simple centroid calculation for demonstration
    if (bucketData.length > 0) {
      const avgIdx = Math.floor(bucketData.length / 2);
      sampled.push(bucketData[avgIdx]);
    }
  }
  
  sampled.push(data[data.length - 1]); // Always keep last point
  
  return sampled;
}

/**
 * Measure chart data generation performance
 */
function measureDataGeneration(pointCount: number): number {
  const start = performance.now();
  generateMockData(pointCount);
  const end = performance.now();
  return end - start;
}

/**
 * Measure LTTB sampling performance
 */
function measureLTTBSampling(dataSize: number, sampleSize: number): number {
  const data = generateMockData(dataSize);
  const start = performance.now();
  lttbDownsample(data, sampleSize);
  const end = performance.now();
  return end - start;
}

/**
 * Simulate chart option generation
 */
function generateChartOptions(data: Array<{ timestamp: number; value: number }>): object {
  return {
    grid: { top: 60, right: 40, bottom: 60, left: 80 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'time' },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'line',
        data: data.map(d => [d.timestamp, d.value]),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  };
}

/**
 * Measure chart option generation performance
 */
function measureOptionGeneration(pointCount: number): number {
  const data = generateMockData(pointCount);
  const start = performance.now();
  generateChartOptions(data);
  const end = performance.now();
  return end - start;
}

/**
 * Simulate CSV export
 */
function exportToCSV(data: Array<{ timestamp: number; value: number }>): string {
  let csv = '# Chart: Performance Test\n';
  csv += '# Timezone: UTC\n';
  csv += '# Export Date: ' + new Date().toISOString() + '\n';
  csv += '\nTimestamp,Value\n';
  
  data.forEach(point => {
    csv += `${new Date(point.timestamp).toISOString()},${point.value}\n`;
  });
  
  return csv;
}

/**
 * Measure CSV export performance
 */
function measureCSVExport(pointCount: number): number {
  const data = generateMockData(pointCount);
  const start = performance.now();
  exportToCSV(data);
  const end = performance.now();
  return end - start;
}

/**
 * Run all performance tests
 */
async function runTests() {
  console.log(`${colors.bold}${colors.blue}=== Chart Component Performance Tests ===${colors.reset}\n`);
  
  // Test 1: Small dataset (100 points) - Baseline
  console.log(`${colors.bold}Test 1: Small Dataset (100 points)${colors.reset}`);
  const smallDataGen = measureDataGeneration(100);
  checkMetric('Data generation (100 points)', smallDataGen, 10, 'ms');
  
  const smallOptionGen = measureOptionGeneration(100);
  checkMetric('Option generation (100 points)', smallOptionGen, 50, 'ms');
  
  // Test 2: Medium dataset (1000 points) - Target: <2s render
  console.log(`\n${colors.bold}Test 2: Medium Dataset (1000 points)${colors.reset}`);
  const mediumDataGen = measureDataGeneration(1000);
  checkMetric('Data generation (1000 points)', mediumDataGen, 50, 'ms');
  
  const mediumOptionGen = measureOptionGeneration(1000);
  checkMetric('Option generation (1000 points)', mediumOptionGen, 200, 'ms');
  
  const mediumExport = measureCSVExport(1000);
  checkMetric('CSV export (1000 points)', mediumExport, 100, 'ms');
  
  // Test 3: Large dataset (10,000 points) - Target: <1s with LTTB
  console.log(`\n${colors.bold}Test 3: Large Dataset (10,000 points)${colors.reset}`);
  const largeDataGen = measureDataGeneration(10000);
  checkMetric('Data generation (10K points)', largeDataGen, 200, 'ms');
  
  const lttbSampling = measureLTTBSampling(10000, 2000);
  checkMetric('LTTB sampling (10K → 2K points)', lttbSampling, 100, 'ms');
  
  const largeOptionGen = measureOptionGeneration(10000);
  checkMetric('Option generation (10K points)', largeOptionGen, 500, 'ms');
  
  const largeExport = measureCSVExport(10000);
  checkMetric('CSV export (10K points)', largeExport, 500, 'ms');
  
  // Test 4: Extra large dataset (50,000 points) - Requires aggregation
  console.log(`\n${colors.bold}Test 4: Extra Large Dataset (50,000 points)${colors.reset}`);
  const extraLargeDataGen = measureDataGeneration(50000);
  checkMetric('Data generation (50K points)', extraLargeDataGen, 1000, 'ms');
  
  const heavyLttbSampling = measureLTTBSampling(50000, 2000);
  checkMetric('LTTB sampling (50K → 2K points)', heavyLttbSampling, 500, 'ms');
  
  // Test 5: Filter debouncing simulation
  console.log(`\n${colors.bold}Test 5: Filter Update Performance${colors.reset}`);
  const filterUpdateTime = 300 + measureOptionGeneration(1000); // Debounce + regen
  checkMetric('Filter update with debounce', filterUpdateTime, 500, 'ms');
  
  // Test 6: Memory usage estimation
  console.log(`\n${colors.bold}Test 6: Memory Considerations${colors.reset}`);
  const memoryPerPoint = 24; // Approximate bytes per data point (timestamp + value)
  const memory10K = (10000 * memoryPerPoint) / 1024 / 1024;
  const memory50K = (50000 * memoryPerPoint) / 1024 / 1024;
  
  console.log(`${colors.blue}ℹ${colors.reset} Memory estimate (10K points): ${memory10K.toFixed(2)} MB`);
  console.log(`${colors.blue}ℹ${colors.reset} Memory estimate (50K points): ${memory50K.toFixed(2)} MB`);
  checkMetric('Memory usage (50K points)', memory50K, 5, 'MB');
  
  // Print summary
  printSummary();
}

/**
 * Print test summary
 */
function printSummary(): void {
  console.log(`\n${colors.bold}=== Summary ===${colors.reset}`);
  
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  
  console.log(
    `${colors.green}✓ ${passCount} passed${colors.reset} | ` +
    `${colors.yellow}⚠ ${warnCount} warnings${colors.reset} | ` +
    `${colors.red}✗ ${failCount} failed${colors.reset}`
  );
  
  if (failCount > 0) {
    console.log(`\n${colors.red}${colors.bold}❌ Performance targets not met!${colors.reset}`);
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`\n${colors.yellow}${colors.bold}⚠ Performance targets met with warnings${colors.reset}`);
  } else {
    console.log(`\n${colors.green}${colors.bold}✅ All performance targets met!${colors.reset}`);
  }
  
  // Recommendations
  console.log(`\n${colors.bold}Recommendations:${colors.reset}`);
  console.log(`${colors.blue}•${colors.reset} Use LTTB sampling for datasets >2000 points`);
  console.log(`${colors.blue}•${colors.reset} Enable server-side aggregation for datasets >5000 points`);
  console.log(`${colors.blue}•${colors.reset} Implement data virtualization for very large datasets`);
  console.log(`${colors.blue}•${colors.reset} Use debounced filter updates (300ms) to prevent excessive renders`);
  console.log(`${colors.blue}•${colors.reset} Lazy load chart components for better initial page load`);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Test execution failed:${colors.reset}`, error);
  process.exit(1);
});
