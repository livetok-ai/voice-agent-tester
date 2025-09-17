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

// Parse command-line arguments
const argv = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to the YAML config file',
    default: 'config.yaml'
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Show browser console logs',
    default: false
  })
  .option('assets-server', {
    alias: 'a',
    type: 'string',
    description: 'Assets server URL',
    default: `http://localhost:${process.env.HTTP_PORT || process.env.PORT || 3000}`
  })
  .option('report', {
    alias: 'r',
    type: 'string',
    description: 'Generate CSV report with step elapsed times to specified file',
    default: null
  })
  .option('repeat', {
    type: 'number',
    description: 'Number of repetitions to run the whole scenario (closes and recreates browser for each)',
    default: 1
  })
  .option('headless', {
    type: 'boolean',
    description: 'Run browser in headless mode',
    default: true
  })
  .help()
  .argv;

async function main() {
  let server;
  let tempHtmlPath = null;
  try {
    // Start the assets server
    server = createServer();

    // Load YAML config
    const configPath = path.resolve(argv.config);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = YAML.parse(configFile);

    // Handle HTML content vs URL
    let targetUrl;
    if (config.html) {
      // Create temporary HTML file and serve it
      const assetsDir = path.join(__dirname, '..', 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      tempHtmlPath = path.join(assetsDir, 'temp.html');
      fs.writeFileSync(tempHtmlPath, config.html, 'utf8');
      targetUrl = `${argv.assetsServer}/assets/temp.html`;
      console.log(`Config file loaded: ${argv.config} - HTML content served at: ${targetUrl}`);
    } else if (config.url) {
      targetUrl = config.url;
      console.log(`Config file loaded: ${argv.config} - URL: ${config.url}`);
    } else {
      throw new Error('Config must contain either "url" or "html" field');
    }

    const repetitions = argv.repeat || 1;
    console.log(`Running scenario ${repetitions} time(s)`);

    // Create a single report generator if report is requested
    const reportGenerator = argv.report ? new ReportGenerator(argv.report) : null;

    for (let i = 1; i <= repetitions; i++) {
      if (repetitions > 1) {
        console.log(`\n=== Starting repetition ${i} of ${repetitions} ===`);
      }

      const tester = new VoiceAgentTester({
        verbose: argv.verbose,
        headless: argv.headless,
        assetsServerUrl: argv.assetsServer,
        reportGenerator: reportGenerator
      });

      try {
        await tester.runScenario(targetUrl, config.steps || []);
        
        if (repetitions > 1) {
          console.log(`=== Completed repetition ${i} of ${repetitions} ===`);
        }
      } catch (error) {
        console.error(`Error in repetition ${i}:`, error.message);
        throw error;
      }
      
      // Browser is automatically closed after each runScenario call
      // No need to manually close it here
    }

    // Generate the final report if requested
    if (reportGenerator) {
      reportGenerator.generateCSV();
    }

    if (repetitions > 1) {
      console.log(`\n✅ All ${repetitions} repetitions completed successfully`);
    }
  } catch (error) {
    console.error('Error running scenario:', error.message);
    process.exit(1);
  } finally {
    // Clean up temporary HTML file if created
    if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
      console.log('Temporary HTML file cleaned up');
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