import fs from 'fs';
import path from 'path';

export class ReportGenerator {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.allRunsData = [];
    // Map: "app|scenario|repetition" -> { metadata, stepMetrics, startTime }
    this.runs = new Map();
    this.stepColumns = new Map(); // Map of stepIndex -> Map of metricName -> column name
  }

  // Create a unique key for each run
  _getRunKey(appName, scenarioName, repetition) {
    return `${appName}|${scenarioName}|${repetition}`;
  }

  beginRun(appName, scenarioName, repetition) {
    const key = this._getRunKey(appName, scenarioName, repetition);
    this.runs.set(key, {
      metadata: {
        app: appName,
        scenario: scenarioName,
        repetition: repetition,
        startTime: Date.now()
      },
      stepMetrics: new Map() // Map of stepIndex -> Map of metricName -> value
    });
  }

  recordStepMetric(appName, scenarioName, repetition, stepIndex, action, name, value) {
    const key = this._getRunKey(appName, scenarioName, repetition);
    const run = this.runs.get(key);

    if (!run) {
      console.warn(`Warning: Attempting to record metric for non-existent run: ${key}`);
      return;
    }

    // Initialize step metrics map if it doesn't exist
    if (!run.stepMetrics.has(stepIndex)) {
      run.stepMetrics.set(stepIndex, new Map());
    }

    // Record the metric value
    run.stepMetrics.get(stepIndex).set(name, value);

    // Track column names based on step index, action, and metric name
    if (!this.stepColumns.has(stepIndex)) {
      this.stepColumns.set(stepIndex, new Map());
    }
    if (!this.stepColumns.get(stepIndex).has(name)) {
      this.stepColumns.get(stepIndex).set(name, `step_${stepIndex + 1}_${action}_${name}`);
    }
  }

  endRun(appName, scenarioName, repetition, success = true) {
    const key = this._getRunKey(appName, scenarioName, repetition);
    const run = this.runs.get(key);

    if (!run) {
      console.warn(`Warning: Attempting to end non-existent run: ${key}`);
      return;
    }

    // Calculate duration
    const duration = Date.now() - run.metadata.startTime;

    // Deep copy the nested Map structure
    const runCopy = new Map();
    run.stepMetrics.forEach((metricsMap, stepIndex) => {
      runCopy.set(stepIndex, new Map(metricsMap));
    });

    this.allRunsData.push({
      metadata: {
        app: run.metadata.app,
        scenario: run.metadata.scenario,
        repetition: run.metadata.repetition,
        success: success ? 1 : 0,
        duration: duration
      },
      stepMetrics: runCopy
    });

    // Remove the run from active runs map
    this.runs.delete(key);
  }

  generateCSV() {
    if (this.allRunsData.length === 0) {
      console.warn('No step times recorded for report generation');
      return;
    }

    // Collect all step indices and their metrics
    const allStepMetrics = new Map(); // Map of stepIndex -> Set of metricNames
    this.allRunsData.forEach(run => {
      run.stepMetrics.forEach((metrics, stepIndex) => {
        if (!allStepMetrics.has(stepIndex)) {
          allStepMetrics.set(stepIndex, new Set());
        }
        metrics.forEach((_, metricName) => {
          allStepMetrics.get(stepIndex).add(metricName);
        });
      });
    });

    // Sort step indices
    const sortedStepIndices = Array.from(allStepMetrics.keys()).sort((a, b) => a - b);

    // Build column headers - start with app, scenario, repetition, success, and duration
    const headers = ['app', 'scenario', 'repetition', 'success', 'duration'];
    sortedStepIndices.forEach(stepIndex => {
      const metricNames = Array.from(allStepMetrics.get(stepIndex)).sort();
      metricNames.forEach(metricName => {
        const columnName = this.stepColumns.get(stepIndex)?.get(metricName) ||
                          `step_${stepIndex + 1}_${metricName}`;
        headers.push(columnName);
      });
    });

    // Create CSV data rows
    const dataRows = this.allRunsData.map(run => {
      // Start with metadata columns
      const row = [
        run.metadata.app,
        run.metadata.scenario,
        run.metadata.repetition,
        run.metadata.success,
        run.metadata.duration
      ];

      // Add step metrics
      sortedStepIndices.forEach(stepIndex => {
        const stepMetrics = run.stepMetrics.get(stepIndex) || new Map();
        const metricNames = Array.from(allStepMetrics.get(stepIndex)).sort();
        metricNames.forEach(metricName => {
          const value = stepMetrics.get(metricName);
          row.push(value !== undefined ? value : '');
        });
      });
      return row.join(', ');
    });

    const csvContent = `${headers.join(', ')}\n${dataRows.join('\n')}\n`;

    // Write to file
    fs.writeFileSync(this.filePath, csvContent, 'utf8');
    console.log(`Report generated: ${this.filePath}`);
  }

  generateMetricsSummary() {
    if (this.allRunsData.length === 0) {
      return;
    }

    console.log('\n=== METRICS SUMMARY ===');

    // Collect all step indices and their metrics
    const allStepMetrics = new Map(); // Map of stepIndex -> Set of metricNames
    this.allRunsData.forEach(run => {
      run.stepMetrics.forEach((metrics, stepIndex) => {
        if (!allStepMetrics.has(stepIndex)) {
          allStepMetrics.set(stepIndex, new Set());
        }
        metrics.forEach((_, metricName) => {
          allStepMetrics.get(stepIndex).add(metricName);
        });
      });
    });

    const sortedStepIndices = Array.from(allStepMetrics.keys()).sort((a, b) => a - b);

    if (sortedStepIndices.length === 0) {
      console.log('No metrics collected during test runs.');
      return;
    }

    sortedStepIndices.forEach(stepIndex => {
      const metricNames = Array.from(allStepMetrics.get(stepIndex)).sort();

      metricNames.forEach(metricName => {
        const columnName = this.stepColumns.get(stepIndex)?.get(metricName) ||
                          `step_${stepIndex + 1}_${metricName}`;
        const values = [];

        this.allRunsData.forEach(run => {
          const stepMetrics = run.stepMetrics.get(stepIndex);
          if (stepMetrics && stepMetrics.has(metricName)) {
            values.push(stepMetrics.get(metricName));
          }
        });

        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const average = sum / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);

          // Calculate p50 (median)
          const sortedValues = [...values].sort((a, b) => a - b);
          let p50;
          if (sortedValues.length % 2 === 0) {
            // Even number of samples: average of two middle values
            const mid1 = sortedValues[sortedValues.length / 2 - 1];
            const mid2 = sortedValues[sortedValues.length / 2];
            p50 = (mid1 + mid2) / 2;
          } else {
            // Odd number of samples: middle value
            p50 = sortedValues[Math.floor(sortedValues.length / 2)];
          }

          // Only add "ms" unit for elapsed_time metrics
          const unit = metricName === 'elapsed_time' ? 'ms' : '';
          const formatValue = (val) => unit ? `${Math.round(val)}${unit}` : val.toFixed(2);

          console.log(`${columnName}:`);
          console.log(`  Average: ${formatValue(average)}`);
          console.log(`  Min: ${formatValue(min)}`);
          console.log(`  Max: ${formatValue(max)}`);
          console.log(`  p50: ${formatValue(p50)}`);
          console.log('');
        }
      });
    });
  }
}