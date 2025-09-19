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

        // Calculate p50 (median)
        const sortedTimes = [...times].sort((a, b) => a - b);
        let p50;
        if (sortedTimes.length % 2 === 0) {
          // Even number of samples: average of two middle values
          const mid1 = sortedTimes[sortedTimes.length / 2 - 1];
          const mid2 = sortedTimes[sortedTimes.length / 2];
          p50 = (mid1 + mid2) / 2;
        } else {
          // Odd number of samples: middle value
          p50 = sortedTimes[Math.floor(sortedTimes.length / 2)];
        }

        console.log(`${columnName}:`);
        console.log(`  Average: ${Math.round(average)}ms`);
        console.log(`  Min: ${Math.round(min)}ms`);
        console.log(`  Max: ${Math.round(max)}ms`);
        console.log(`  p50: ${Math.round(p50)}ms`);
        console.log('');
      }
    });
  }
}