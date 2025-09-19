import fs from 'fs';
import path from 'path';

export class ReportGenerator {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.allRunsData = [];
    this.currentRun = new Map(); // Map of stepIndex -> {time, action}
    this.stepColumns = new Map(); // Map of stepIndex -> column name
  }

  recordStepTime(stepIndex, elapsedTimeMs, action) {
    this.currentRun.set(stepIndex, { time: elapsedTimeMs, action });
    
    // Track column names based on step index and action
    if (!this.stepColumns.has(stepIndex)) {
      this.stepColumns.set(stepIndex, `step_${stepIndex + 1}_${action}_elapsed_time`);
    }
  }

  finishRun() {
    if (this.currentRun.size > 0) {
      this.allRunsData.push(new Map(this.currentRun));
      this.currentRun = new Map();
    }
  }

  generateCSV() {
    if (this.allRunsData.length === 0) {
      console.warn('No step times recorded for report generation');
      return;
    }

    // Get all step indices that have metrics across all runs
    const allStepIndices = new Set();
    this.allRunsData.forEach(run => {
      run.forEach((_, stepIndex) => allStepIndices.add(stepIndex));
    });

    const sortedStepIndices = Array.from(allStepIndices).sort((a, b) => a - b);

    // Create CSV header using column names from stepColumns
    const header = sortedStepIndices.map(stepIndex =>
      this.stepColumns.get(stepIndex) || `step_${stepIndex + 1}_elapsed_time`
    ).join(', ');

    // Create CSV data rows
    const dataRows = this.allRunsData.map(run => {
      return sortedStepIndices.map(stepIndex => {
        const stepData = run.get(stepIndex);
        return stepData ? stepData.time : '';
      }).join(', ');
    });

    const csvContent = `${header}\n${dataRows.join('\n')}\n`;

    // Write to file
    fs.writeFileSync(this.filePath, csvContent, 'utf8');
    console.log(`Report generated: ${this.filePath}`);
  }

  generateMetricsSummary() {
    if (this.allRunsData.length === 0) {
      return;
    }

    console.log('\n=== METRICS SUMMARY ===');

    // Get all step indices that have metrics across all runs
    const allStepIndices = new Set();
    this.allRunsData.forEach(run => {
      run.forEach((_, stepIndex) => allStepIndices.add(stepIndex));
    });

    const sortedStepIndices = Array.from(allStepIndices).sort((a, b) => a - b);

    if (sortedStepIndices.length === 0) {
      console.log('No metrics collected during test runs.');
      return;
    }

    sortedStepIndices.forEach(stepIndex => {
      const columnName = this.stepColumns.get(stepIndex) || `step_${stepIndex + 1}_elapsed_time`;
      const times = [];

      this.allRunsData.forEach(run => {
        const stepData = run.get(stepIndex);
        if (stepData) {
          times.push(stepData.time);
        }
      });

      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        const average = sum / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);

        console.log(`${columnName}:`);
        if (times.length > 1) {
          console.log(`  Average: ${(average / 1000).toFixed(3)} seconds`);
          console.log(`  Min: ${(min / 1000).toFixed(3)} seconds`);
          console.log(`  Max: ${(max / 1000).toFixed(3)} seconds`);
          console.log(`  Runs: ${times.length}`);
        } else {
          console.log(`  Time: ${(times[0] / 1000).toFixed(3)} seconds`);
        }
        console.log('');
      }
    });
  }
}