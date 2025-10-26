#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import YAML from 'yaml';
import { VoiceAgentTester } from './voice-agent-tester.js';
import { ReportGenerator } from './report.js';
import { createServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to resolve file paths from comma-separated input or folder
function resolveConfigPaths(input) {
  const paths = [];
  const items = input.split(',').map(s => s.trim());

  for (const item of items) {
    const resolvedPath = path.resolve(item);

    if (fs.existsSync(resolvedPath)) {
      const stat = fs.statSync(resolvedPath);

      if (stat.isDirectory()) {
        // If it's a directory, find all .yaml files
        const files = fs.readdirSync(resolvedPath)
          .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
          .map(f => path.join(resolvedPath, f));
        paths.push(...files);
      } else if (stat.isFile()) {
        paths.push(resolvedPath);
      }
    } else {
      throw new Error(`Path not found: ${resolvedPath}`);
    }
  }

  return paths;
}

// Helper function to load and validate application config
function loadApplicationConfig(configPath) {
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = YAML.parse(configFile);

  if (!config.url && !config.html) {
    throw new Error(`Application config must contain "url" or "html" field: ${configPath}`);
  }

  return {
    name: path.basename(configPath, path.extname(configPath)),
    path: configPath,
    url: config.url,
    html: config.html,
    steps: config.steps || [],
    tags: config.tags || []
  };
}

// Helper function to load scenario config
function loadScenarioConfig(configPath) {
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config = YAML.parse(configFile);

  return {
    name: path.basename(configPath, path.extname(configPath)),
    path: configPath,
    steps: config.steps || [],
    background: config.background || null,
    tags: config.tags || []
  };
}

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('applications', {
    alias: 'a',
    type: 'string',
    description: 'Comma-separated application paths or folder path',
    demandOption: true
  })
  .option('scenarios', {
    alias: 's',
    type: 'string',
    description: 'Comma-separated scenario paths or folder path',
    demandOption: true
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Show browser console logs',
    default: false
  })
  .option('assets-server', {
    type: 'string',
    description: 'Assets server URL',
    default: `http://localhost:${process.env.HTTP_PORT || process.env.PORT || 3333}`
  })
  .option('report', {
    alias: 'r',
    type: 'string',
    description: 'Generate CSV report with step elapsed times to specified file',
    default: null
  })
  .option('repeat', {
    type: 'number',
    description: 'Number of repetitions to run each app+scenario combination (closes and recreates browser for each)',
    default: 1
  })
  .option('headless', {
    type: 'boolean',
    description: 'Run browser in headless mode',
    default: true
  })
  .option('application-tags', {
    type: 'string',
    description: 'Comma-separated list of application tags to filter by',
    default: null
  })
  .option('scenario-tags', {
    type: 'string',
    description: 'Comma-separated list of scenario tags to filter by',
    default: null
  })
  .option('concurrency', {
    alias: 'c',
    type: 'number',
    description: 'Number of tests to run in parallel',
    default: 1
  })
  .help()
  .argv;

async function main() {
  let server;
  const tempHtmlPaths = [];

  try {
    // Start the assets server
    server = createServer();

    // Resolve application and scenario paths
    const applicationPaths = resolveConfigPaths(argv.applications);
    const scenarioPaths = resolveConfigPaths(argv.scenarios);

    if (applicationPaths.length === 0) {
      throw new Error('No application config files found');
    }

    if (scenarioPaths.length === 0) {
      throw new Error('No scenario config files found');
    }

    // Load all application and scenario configs
    let applications = applicationPaths.map(loadApplicationConfig);
    let scenarios = scenarioPaths.map(loadScenarioConfig);

    // Filter applications by tags if specified
    if (argv.applicationTags) {
      const filterTags = argv.applicationTags.split(',').map(t => t.trim());
      applications = applications.filter(app =>
        app.tags.some(tag => filterTags.includes(tag))
      );
      if (applications.length === 0) {
        throw new Error(`No applications found with tags: ${filterTags.join(', ')}`);
      }
    }

    // Filter scenarios by tags if specified
    if (argv.scenarioTags) {
      const filterTags = argv.scenarioTags.split(',').map(t => t.trim());
      scenarios = scenarios.filter(scenario =>
        scenario.tags.some(tag => filterTags.includes(tag))
      );
      if (scenarios.length === 0) {
        throw new Error(`No scenarios found with tags: ${filterTags.join(', ')}`);
      }
    }

    console.log(`\n📋 Loaded ${applications.length} application(s) and ${scenarios.length} scenario(s)`);
    console.log(`Applications: ${applications.map(a => a.name).join(', ')}`);
    console.log(`Scenarios: ${scenarios.map(s => s.name).join(', ')}`);

    // Create matrix of all combinations
    const combinations = [];
    for (const app of applications) {
      for (const scenario of scenarios) {
        combinations.push({ app, scenario });
      }
    }

    const totalRuns = combinations.length * argv.repeat;
    console.log(`\n🎯 Running ${combinations.length} combination(s) × ${argv.repeat} repetition(s) = ${totalRuns} total run(s)\n`);

    // Create a single report generator for metrics tracking
    const reportGenerator = new ReportGenerator(argv.report || 'temp_metrics.csv');

    // Helper function to execute a single test run
    async function executeRun({ app, scenario, repetition, runNumber }) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📱 Application: ${app.name}`);
      console.log(`📝 Scenario: ${scenario.name}`);
      if (argv.repeat > 1) {
        console.log(`🔁 Repetition: ${repetition}`);
      }
      console.log(`🏃 Run: ${runNumber}/${totalRuns}`);
      console.log(`${'='.repeat(80)}`);

      // Handle HTML content vs URL
      let targetUrl;
      let tempHtmlPath = null;

      if (app.html) {
        // Create temporary HTML file and serve it
        const assetsDir = path.join(__dirname, '..', 'assets');
        if (!fs.existsSync(assetsDir)) {
          fs.mkdirSync(assetsDir, { recursive: true });
        }
        tempHtmlPath = path.join(assetsDir, `temp_${app.name}_${Date.now()}.html`);
        fs.writeFileSync(tempHtmlPath, app.html, 'utf8');
        tempHtmlPaths.push(tempHtmlPath);
        targetUrl = `${argv.assetsServer}/assets/${path.basename(tempHtmlPath)}`;
        console.log(`HTML content served at: ${targetUrl}`);
      } else {
        targetUrl = app.url;
        console.log(`URL: ${targetUrl}`);
      }

      // Application and scenario steps are executed separately
      console.log(`Total steps: ${app.steps.length + scenario.steps.length} (${app.steps.length} from app + ${scenario.steps.length} from suite)\n`);

      const tester = new VoiceAgentTester({
        verbose: argv.verbose,
        headless: argv.headless,
        assetsServerUrl: argv.assetsServer,
        reportGenerator: reportGenerator
      });

      try {
        await tester.runScenario(targetUrl, app.steps, scenario.steps, app.name, scenario.name, repetition, scenario.background);
        console.log(`✅ Completed successfully (Run ${runNumber}/${totalRuns})`);
        return { success: true };
      } catch (error) {
        const errorInfo = {
          app: app.name,
          scenario: scenario.name,
          repetition,
          error: error.message
        };
        console.error(`❌ Error (Run ${runNumber}/${totalRuns}):`, error.message);
        return { success: false, error: errorInfo };
      }
    }

    // Build all test runs (combination x repetitions)
    const allRuns = [];
    let runNumber = 0;

    for (const { app, scenario } of combinations) {
      const repetitions = argv.repeat || 1;
      for (let i = 0; i < repetitions; i++) {
        runNumber++;
        allRuns.push({
          app,
          scenario,
          repetition: i,
          runNumber
        });
      }
    }

    // Execute runs with concurrency limit using a worker pool
    const concurrency = Math.min(argv.concurrency || 1, allRuns.length);
    console.log(`⚡ Concurrency level: ${concurrency}`);

    // Worker pool implementation - start new tests as soon as one finishes
    const allResults = [];
    let nextRunIndex = 0;

    // Create a pool of worker promises
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker(i + 1));
    }

    // Worker function that processes runs from the queue
    async function runWorker(workerId) {
      const workerResults = [];

      while (nextRunIndex < allRuns.length) {
        const runIndex = nextRunIndex++;
        const run = allRuns[runIndex];

        if (concurrency > 1) {
          console.log(`\n👷 Worker ${workerId}: Starting run ${run.runNumber}/${totalRuns}`);
        }

        const result = await executeRun(run);
        workerResults.push(result);
      }

      return workerResults;
    }

    // Wait for all workers to complete
    const workerResultArrays = await Promise.all(workers);

    // Flatten all worker results into a single array
    workerResultArrays.forEach(workerResults => {
      allResults.push(...workerResults);
    });

    // Aggregate results
    const results = {
      successful: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      errors: allResults.filter(r => !r.success).map(r => r.error)
    };

    // Generate the final report if requested, and always show metrics summary
    if (argv.report) {
      reportGenerator.generateCSV();
    }
    reportGenerator.generateMetricsSummary();

    // Print final summary
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 FINAL SUMMARY`);
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ Successful runs: ${results.successful}/${totalRuns}`);

    if (results.failed > 0) {
      console.log(`\n🔍 Failure Details:`);
      results.errors.forEach(({ app, scenario, repetition, error }) => {
        console.log(`  ${app} + ${scenario} (rep ${repetition}): ${error}`);
      });
    }

    if (results.failed === 0) {
      console.log(`\n🎉 All runs completed successfully!`);
    } else {
      console.log(`\n⚠️  Completed with ${results.failed} failure(s).`);
    }

    // Exit with appropriate code based on results
    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running scenarios:', error.message);
    process.exit(1);
  } finally {
    // Clean up temporary HTML files if created
    for (const tempHtmlPath of tempHtmlPaths) {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
    if (tempHtmlPaths.length > 0) {
      console.log('Temporary HTML files cleaned up');
    }

    // Close the server to allow process to exit
    if (server) {
      server.close(() => {
        console.log('Server closed');
      });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}