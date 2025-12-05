import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import puppeteer from 'puppeteer';
import { launch as launchWithStream, getStream, wss } from 'puppeteer-stream';
import { getInstalledBrowsers } from '@puppeteer/browsers';
import { transcribeAudio, evaluateTranscription, pcmToWav } from './transcription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VoiceAgentTester {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.headless = options.headless || false;
    this.browser = null;
    this.page = null;
    this.pendingPromises = new Map(); // Map of eventType -> Array of {resolve, reject, timeoutId}
    const defaultPort = process.env.HTTP_PORT || process.env.PORT || 3333;
    this.assetsServerUrl = options.assetsServerUrl || `http://localhost:${defaultPort}`;
    this.reportGenerator = options.reportGenerator || null;
    this.record = options.record || false;
    this.recordingStream = null;
    this.recordingFile = null;
  }

  sleep(time) {
    return new Promise(r => setTimeout(r, time));
  }

  waitForAudioEvent(eventType, timeout = 30000) {
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        // Remove this promise from pending list
        const promises = this.pendingPromises.get(eventType) || [];
        const index = promises.findIndex(p => p.resolve === resolve);
        if (index !== -1) {
          promises.splice(index, 1);
          if (promises.length === 0) {
            this.pendingPromises.delete(eventType);
          }
        }
        reject(new Error(`Timeout waiting for ${eventType} event after ${timeout}ms`));
      }, timeout);

      // Register this promise to be resolved when event arrives
      if (!this.pendingPromises.has(eventType)) {
        this.pendingPromises.set(eventType, []);
      }
      this.pendingPromises.get(eventType).push({ resolve, reject, timeoutId });
    });
  }

  clearAudioEventQueue() {
    // Also clear any pending promises and reject them
    for (const [eventType, promises] of this.pendingPromises.entries()) {
      for (const { reject, timeoutId } of promises) {
        clearTimeout(timeoutId);
        reject(new Error(`Event queue cleared while waiting for ${eventType}`));
      }
    }
    this.pendingPromises.clear();
  }

  async launch(url) {
    if (this.browser) {
      return;
    }

    // Log installed browsers
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const cacheDir = path.join(homeDir, '.cache', 'puppeteer');
    const browsers = await getInstalledBrowsers({ cacheDir });
    console.log(`Installed browsers: ${browsers.map(b => b.browser + ' ' + b.buildId).join(', ')}`);

    const launchOptions = {
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // This is not compatible with puppeteer-stream
        // Use context.overridePermissions instead
        // '--use-fake-ui-for-media-stream', 
        '--autoplay-policy=no-user-gesture-required',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--no-first-run',
        '--no-default-browser-check',
        '--allowlisted-extension-id=jjndjgheafjngoipoacpjgeicjeomjli' // puppeteer-stream extension id
      ]
    };

    // Use puppeteer-stream launch when recording is enabled
    if (this.record) {
      this.browser = await launchWithStream({
        ...launchOptions,
        headless: launchOptions.headless ? 'new' : launchOptions.headless,
        executablePath: browsers
          .filter(b => b.browser === 'chrome')
          .sort((a, b) => (a.buildId < b.buildId ? 1 : a.buildId > b.buildId ? -1 : 0))
          .at(0).executablePath
      });
    } else {
      this.browser = await puppeteer.launch(launchOptions);
    }

    // Log browser info
    const browserVersion = await this.browser.version();
    console.log(`Browser launched: ${browserVersion}`);

    // Override permissions for media stream (only for http/https URLs, not data: or file: URLs)
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      const context = this.browser.defaultBrowserContext();
      await context.clearPermissionOverrides();
      await context.overridePermissions(url, ['camera', 'microphone']);
    }

    this.page = await this.browser.newPage();

    // Register __publishEvent function for browser to call back to Node.js
    await this.page.exposeFunction('__publishEvent', (eventType, data) => {
      const event = { eventType, data, timestamp: Date.now() };

      console.log(`\t📢 Event received: ${eventType}`);

      // Check if there are any pending promises waiting for this event type
      const pendingPromises = this.pendingPromises.get(eventType);
      if (pendingPromises && pendingPromises.length > 0) {
        // Resolve the first pending promise immediately
        const { resolve, timeoutId } = pendingPromises.shift();
        clearTimeout(timeoutId);

        // Clean up empty arrays
        if (pendingPromises.length === 0) {
          this.pendingPromises.delete(eventType);
        }

        resolve(event);
      }
    });

    // Enable console logging if verbose mode is enabled
    if (this.verbose) {
      this.page.on('console', (msg) => {
        console.log(`[BROWSER] ${msg.text()}`);
      });
    }

    // Always listen for page errors
    this.page.on('pageerror', (error) => {
      console.error(`[PAGE ERROR] ${error.message}`);
      if (this.verbose) {
        console.error(error.stack);
      }
    });
  }

  async close() {
    if (this.browser) {
      // Stop recording if active
      if (this.recordingStream) {
        await this.stopRecording();
      }

      // Clear any pending promises before closing
      for (const [eventType, promises] of this.pendingPromises.entries()) {
        for (const { reject, timeoutId } of promises) {
          clearTimeout(timeoutId);
          reject(new Error(`Browser closed while waiting for ${eventType}`));
        }
      }
      this.pendingPromises.clear();

      await this.browser.close();
      this.browser = null;
      this.page = null;

      // Close the websocket server if recording was used
      if (this.record) {
        try {
          (await wss).close();
        } catch (error) {
          // Ignore errors when closing wss
        }
      }
    }
  }

  async startRecording(appName, scenarioName, repetition) {
    if (!this.record || !this.page) {
      return;
    }

    // Ensure output directory exists
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create filename with timestamp and test info
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedAppName = appName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedScenarioName = scenarioName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `recording_${sanitizedAppName}_${sanitizedScenarioName}_${repetition}_${timestamp}.webm`;
    const filePath = path.join(outputDir, filename);

    // Create write stream for the recording
    this.recordingFile = fs.createWriteStream(filePath);

    console.log('Starting stream');
    // Start the stream with audio and video
    this.recordingStream = await getStream(this.page, {
      audio: true,
      video: true,
      mimeType: 'video/webm;codecs=vp8,opus'
    });

    console.log('Stream started');

    // Pipe the stream to the file
    this.recordingStream.pipe(this.recordingFile);

    console.log(`🎥 Recording started: ${filename}`);
    this.recordingFilePath = filePath;
  }

  async stopRecording() {
    if (!this.recordingStream) {
      return;
    }

    return new Promise((resolve) => {
      // Destroy the stream to stop recording
      this.recordingStream.destroy();

      // Close the file stream
      this.recordingFile.on('close', () => {
        console.log(`🎥 Recording saved: ${this.recordingFilePath}`);
        this.recordingStream = null;
        this.recordingFile = null;
        this.recordingFilePath = null;
        resolve();
      });

      this.recordingFile.close();
    });
  }

  async injectJavaScriptFiles() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    // Set the assets server URL in the page context before injecting scripts
    await this.page.evaluate((url) => {
      window.__assetsServerUrl = url;
    }, this.assetsServerUrl);

    const jsFolder = path.join(__dirname, '..', 'javascript');

    if (!fs.existsSync(jsFolder)) {
      console.log('JavaScript folder not found, skipping injection');
      return;
    }

    const jsFiles = await glob(path.join(jsFolder, '*.js'));

    for (const jsFile of jsFiles) {
      try {
        await this.page.addScriptTag({ path: jsFile });
        if (this.verbose) {
          console.log(`Injected: ${path.basename(jsFile)}`);
        }
      } catch (error) {
        console.error(`Error injecting ${jsFile}:`, error.message);
      }
    }
  }

  async executeStep(step, stepIndex, appName = '', scenarioName = '', repetition = 1) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const action = step.action;
    const beginTime = Date.now();

    try {
      let handlerResult;
      switch (action) {
        case 'click':
          handlerResult = await this.handleClick(step);
          break;
        case 'wait_for_voice':
          handlerResult = await this.handleWaitForVoice();
          break;
        case 'wait_for_silence':
          handlerResult = await this.handleWaitForSilence();
          break;
        case 'wait':
          handlerResult = await this.handleWait(step);
          break;
        case 'speak':
          handlerResult = await this.handleSpeak(step);
          break;
        case 'listen':
          handlerResult = await this.handleListen(step);
          break;
        case 'sleep':
          handlerResult = await this.handleSleep(step);
          break;
        case 'wait_for_element':
          handlerResult = await this.handleWaitForElement(step);
          break;
        case 'type':
          handlerResult = await this.handleType(step);
          break;
        case 'fill':
          handlerResult = await this.handleFill(step);
          break;
        case 'select':
          handlerResult = await this.handleSelect(step);
          break;
        case 'screenshot':
          handlerResult = await this.handleScreenshot(step);
          break;
        default:
          console.log(`Unknown action: ${action}`);
      }

      // Record elapsed time for all steps
      const elapsedTimeMs = Date.now() - beginTime;
      const elapsedTimeSec = elapsedTimeMs / 1000;
      console.log(`\tElapsed time: ${elapsedTimeSec.toFixed(3)} seconds`);

      // Record metrics for report if enabled and step has metrics attribute
      if (this.reportGenerator && step.metrics) {
        if (step.metrics.includes('elapsed_time')) {
          this.reportGenerator.recordStepMetric(appName, scenarioName, repetition, stepIndex, step.action, 'elapsed_time', elapsedTimeMs);
        }
        // Record any additional metrics returned by the handler
        if (handlerResult && typeof handlerResult === 'object') {
          for (const [metricName, metricValue] of Object.entries(handlerResult)) {
            if (step.metrics.includes(metricName)) {
              this.reportGenerator.recordStepMetric(appName, scenarioName, repetition, stepIndex, step.action, metricName, metricValue);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error executing step ${action}:`, error.message);
      throw error;
    }
  }

  async handleClick(step) {
    const selector = step.selector;
    if (!selector) {
      throw new Error('No selector specified for click action');
    }

    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  async handleWaitForVoice() {
    try {
      await this.waitForAudioEvent('audiostart');
    } catch (error) {
      console.error('Timeout waiting for voice input:', error.message);
      throw error;
    }
  }

  async handleWaitForSilence() {
    try {
      await this.waitForAudioEvent('audiostop');
    } catch (error) {
      console.error('Timeout waiting for silence:', error.message);
      throw error;
    }
  }

  async handleWait(step) {
    const selector = step.selector;
    if (!selector) {
      throw new Error('No selector specified for wait action');
    }

    console.log(`Waiting for selector: ${selector}`);
    await this.page.waitForSelector(selector);
  }

  async handleSpeak(step) {
    const text = step.text;
    const file = step.file

    if (!text && !file) {
      throw new Error('No text or file specified for speak action');
    }

    if (text && file) {
      throw new Error('Cannot specify both text and file for speak action');
    }

    if (file) {
      const assetsPath = path.join(__dirname, '..', 'assets');
      const filePath = path.join(assetsPath, file);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Audio file not found: ${file}`);
      }

      const fileUrl = `${this.assetsServerUrl}/assets/${file}`;

      await this.page.evaluate(async (url) => {
        if (typeof window.__waitForMediaStream === 'function') {
          try {
            await window.__waitForMediaStream();
          } catch (e) {
            console.error(e.message);
            throw e;
          }
        }

        console.log('Checking for __speakFromUrl function...');
        console.log('typeof window.__speakFromUrl:', typeof window.__speakFromUrl);
        console.log('typeof window.__speak:', typeof window.__speak);

        if (typeof window.__speakFromUrl === 'function') {
          console.log('Calling __speakFromUrl with:', url);
          window.__speakFromUrl(url);
        } else if (typeof window.__speak === 'function') {
          console.log('__speakFromUrl not available, but __speak is available. Calling __speak with URL:', url);
          window.__speak(url);
        } else {
          console.error('Neither __speakFromUrl nor __speak is available');
          console.log('Available window properties:', Object.keys(window).filter(k => k.startsWith('__')));
          throw new Error('__speakFromUrl method not available');
        }
      }, fileUrl);
    } else {
      await this.page.evaluate(async (textToSpeak) => {
        if (typeof window.__waitForMediaStream === 'function') {
          try {
            await window.__waitForMediaStream();
          } catch (e) {
            console.error(e.message);
            throw e;
          }
        }

        if (typeof window.__speak === 'function') {
          window.__speak(textToSpeak);
        } else {
          throw new Error('__speak method not available');
        }
      }, text);
    }

    // Wait for speech to complete by listening for speechend event
    try {
      await this.waitForAudioEvent('speechend');
    } catch (error) {
      console.error('Timeout waiting for speech to complete:', error.message);
      throw error;
    }
  }

  async handleListen(step) {
    const evaluation = step.evaluation;
    if (!evaluation) {
      throw new Error('No evaluation prompt specified for listen action');
    }

    try {
      // Start recording
      await this.page.evaluate(() => {
        if (typeof window.__startRecording === 'function') {
          window.__startRecording();
        } else {
          throw new Error('__startRecording method not available');
        }
      });

      await this.waitForAudioEvent('recordingstart');
      await this.waitForAudioEvent('audiostart');
      await this.waitForAudioEvent('audiostop');

      // Stop recording
      await this.page.evaluate(() => {
        if (typeof window.__stopRecording === 'function') {
          window.__stopRecording();
        } else {
          throw new Error('__stopRecording method not available');
        }
      });

      // Wait for recording to complete and get the audio data
      const recordingEvent = await this.waitForAudioEvent('recordingcomplete');

      const audioMetadata = {
        mimeType: recordingEvent.data.mimeType,
        sampleRate: recordingEvent.data.sampleRate,
        channels: recordingEvent.data.channels,
        bitsPerSample: recordingEvent.data.bitsPerSample
      };

      const audioFilePath = await this.saveAudioAsWAV(recordingEvent.data.audioData, audioMetadata);
      console.log(`\tAudio saved as: ${audioFilePath}`);

      // Process the audio with OpenAI
      const transcription = await transcribeAudio(audioFilePath);
      console.log(`\tTranscription: ${transcription}`);

      // Evaluate the transcription against the evaluation prompt
      const evaluationResult = await evaluateTranscription(transcription, evaluation);
      console.log(`\tEvaluation result: ${evaluationResult.score} "${evaluationResult.explanation}"`);

      return {
        score: evaluationResult.score,
      }
    } catch (error) {
      console.error('Error in listen command:', error.message);
      throw error;
    }
  }

  async handleSleep(step) {
    const time = step.time;
    if (!time) {
      throw new Error('No time specified for sleep action');
    }

    await this.sleep(time);
  }

  async handleWaitForElement(step) {
    const selector = step.selector;
    if (!selector) {
      throw new Error('No selector specified for wait_for_element action');
    }

    await this.page.waitForSelector(selector);
  }

  async handleType(step) {
    const selector = step.selector;
    const text = step.text;

    if (!selector) {
      throw new Error('No selector specified for type action');
    }

    if (!text) {
      throw new Error('No text specified for type action');
    }

    // Wait for the element to be available
    await this.page.waitForSelector(selector);

    // Focus the element and type the text
    await this.page.focus(selector);
    await this.page.type(selector, text);
  }

  async handleFill(step) {
    const selector = step.selector;
    const text = step.text;

    if (!selector) {
      throw new Error('No selector specified for fill action');
    }

    if (text === undefined) {
      throw new Error('No text specified for fill action');
    }

    // Wait for the element to be available
    await this.page.waitForSelector(selector);

    // Use $eval for cleaner element manipulation
    await this.page.$eval(selector, (el, value) => {
      // Check if it's an input or textarea element
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = value;
        // Trigger input event to notify any listeners
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        throw new Error(`Fill action can only be used on input or textarea elements, found: ${el.tagName}`);
      }
    }, text);
  }

  async handleSelect(step) {
    const selector = step.selector;
    const value = step.value;
    const values = step.values;
    const text = step.text;
    const checked = step.checked;

    if (!selector) {
      throw new Error('No selector specified for select action');
    }

    // Wait for the element to be available
    await this.page.waitForSelector(selector);

    // Determine the element type and handle accordingly
    const elementInfo = await this.page.$eval(selector, (el) => {
      return {
        tagName: el.tagName,
        type: el.type || null,
        multiple: el.multiple || false
      };
    });

    switch (elementInfo.tagName) {
      case 'SELECT':
        await this.handleSelectDropdown(selector, value, values, text, elementInfo.multiple);
        break;
      case 'INPUT':
        if (elementInfo.type === 'checkbox') {
          await this.handleSelectCheckbox(selector, checked);
        } else if (elementInfo.type === 'radio') {
          await this.handleSelectRadio(selector);
        } else {
          throw new Error(`Select action not supported for input type: ${elementInfo.type}`);
        }
        break;
      default:
        // For custom dropdowns or clickable elements, try clicking
        await this.handleSelectCustom(selector, text);
    }
  }

  async handleSelectDropdown(selector, value, values, text, isMultiple) {
    if (values && Array.isArray(values)) {
      // Multiple values for multi-select
      if (!isMultiple) {
        throw new Error('Cannot select multiple values on a single-select dropdown');
      }
      await this.page.select(selector, ...values);
    } else if (value !== undefined) {
      // Single value selection
      await this.page.select(selector, value);
    } else if (text !== undefined) {
      // Select by visible text when no value attribute
      await this.page.$eval(selector, (selectEl, optionText) => {
        const option = Array.from(selectEl.options).find(opt =>
          opt.textContent.trim() === optionText.trim()
        );
        if (!option) {
          throw new Error(`Option with text "${optionText}" not found`);
        }
        selectEl.value = option.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      }, text);
    } else {
      throw new Error('No value, values, or text specified for select dropdown');
    }
  }

  async handleSelectCheckbox(selector, checked) {
    const currentState = await this.page.$eval(selector, el => el.checked);
    const targetState = checked !== undefined ? checked : !currentState;

    if (currentState !== targetState) {
      await this.page.click(selector);
    }
  }

  async handleSelectRadio(selector) {
    // For radio buttons, always click to select
    await this.page.click(selector);
  }

  async handleSelectCustom(selector, text) {
    if (text !== undefined) {
      // For custom dropdowns, try to find and click an option with matching text
      await this.page.evaluate((parentSelector, optionText) => {
        const parent = document.querySelector(parentSelector);
        if (!parent) {
          throw new Error(`Custom dropdown not found: ${parentSelector}`);
        }

        // Try different selectors for options
        const possibleSelectors = ['[role="option"]', 'li', 'a', '.option', 'div'];
        let option = null;

        for (const sel of possibleSelectors) {
          const options = parent.querySelectorAll(sel);
          option = Array.from(options).find(opt =>
            opt.textContent.trim() === optionText.trim()
          );
          if (option) break;
        }

        if (!option) {
          throw new Error(`Option with text "${optionText}" not found in custom dropdown`);
        }

        option.click();
      }, selector, text);
    } else {
      // If no text specified, just click the element itself
      await this.page.click(selector);
    }
  }

  async handleScreenshot(step) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const filename = step.filename || `screenshot_${Date.now()}.png`;
    const outputDir = step.outputDir || path.join(__dirname, '..', 'output');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const screenshotPath = path.join(outputDir, filename);

    // Take screenshot with optional parameters
    const screenshotOptions = {
      path: screenshotPath,
    };

    await this.page.screenshot(screenshotOptions);

    return screenshotPath;
  }

  async saveAudioAsWAV(base64Audio, audioMetadata) {
    try {
      // Convert base64 to buffer
      const pcmBuffer = Buffer.from(base64Audio, 'base64');

      // Convert PCM to WAV format
      const wavBuffer = pcmToWav(pcmBuffer, audioMetadata.sampleRate, audioMetadata.channels, audioMetadata.bitsPerSample);

      // Save to file
      const outputDir = path.join(__dirname, '..', 'output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const wavFilePath = path.join(outputDir, `recording_${timestamp}.wav`);
      fs.writeFileSync(wavFilePath, wavBuffer);

      return wavFilePath;
    } catch (error) {
      console.error('Error saving audio as WAV:', error);
      throw new Error(`Failed to save WAV: ${error.message}`);
    }
  }

  async runScenario(url, appSteps, scenarioSteps, appName = '', scenarioName = '', repetition = 1, backgroundFile = null) {
    let success = true;
    try {
      // Start tracking this run with app and scenario names
      if (this.reportGenerator) {
        this.reportGenerator.beginRun(appName, scenarioName, repetition);
      }

      // Combine app steps and scenario steps
      const steps = [...appSteps, ...scenarioSteps];

      await this.launch(url);

      await this.page.goto(url, { waitUntil: 'load' });

      // Inject JavaScript files after the page has loaded
      await this.injectJavaScriptFiles();

      await this.page.waitForNetworkIdle({ timeout: 5000, concurrency: 2 });

      // Small wait to ensure injected scripts are fully loaded
      await this.sleep(500);

      // Start recording if enabled
      await this.startRecording(appName, scenarioName, repetition);

      // Execute all configured steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`Executing step ${i + 1}: ${JSON.stringify(step)}`);
        await this.executeStep(step, i, appName, scenarioName, repetition);
      }

      // Keep the browser open for a bit after all steps
      await this.sleep(500);

    } catch (error) {
      // Log the error but still finish the run for report generation
      success = false;
      console.error('Error during scenario execution:', error);
      throw error;
    } finally {
      // Always finish the run for report generation, even if there was an error
      if (this.reportGenerator) {
        this.reportGenerator.endRun(appName, scenarioName, repetition, success);
      }

      await this.close();
    }
  }
}