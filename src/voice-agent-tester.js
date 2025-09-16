import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import puppeteer from 'puppeteer';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VoiceAgentTester {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.headless = options.headless || false;
    this.browser = null;
    this.page = null;
    this.audioEventQueue = [];
    this.pendingPromises = new Map(); // Map of eventType -> Array of {resolve, reject, timeoutId}
    const defaultPort = process.env.HTTP_PORT || process.env.PORT || 3000;
    this.assetsServerUrl = options.assetsServerUrl || `http://localhost:${defaultPort}`;
    this.reportGenerator = options.reportGenerator || null;
  }

  sleep(time) {
    return new Promise(r => setTimeout(r, time));
  }

  waitForAudioEvent(eventType, timeout = 30000) {
    return new Promise((resolve, reject) => {
      // First check if we already have the event in queue
      const existingEventIndex = this.audioEventQueue.findIndex(event => event.eventType === eventType);
      if (existingEventIndex !== -1) {
        const event = this.audioEventQueue.splice(existingEventIndex, 1)[0];
        resolve(event);
        return;
      }

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
    this.audioEventQueue = [];
    // Also clear any pending promises and reject them
    for (const [eventType, promises] of this.pendingPromises.entries()) {
      for (const { reject, timeoutId } of promises) {
        clearTimeout(timeoutId);
        reject(new Error(`Event queue cleared while waiting for ${eventType}`));
      }
    }
    this.pendingPromises.clear();
  }

  async launch() {
    if (this.browser) {
      return;
    }

    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });

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
      } else {
        // No pending promises, add to queue for later
        this.audioEventQueue.push(event);
      }
    });

    // Enable console logging if verbose mode is enabled
    if (this.verbose) {
      this.page.on('console', (msg) => {
        console.log(`[BROWSER] ${msg.text()}`);
      });
    }
  }

  async close() {
    if (this.browser) {
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
    }
  }

  async injectJavaScriptFiles() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const jsFolder = path.join(__dirname, '..', 'javascript');

    if (!fs.existsSync(jsFolder)) {
      console.log('JavaScript folder not found, skipping injection');
      return;
    }

    const jsFiles = await glob(path.join(jsFolder, '*.js'));

    for (const jsFile of jsFiles) {
      try {
        await this.page.addScriptTag({ path: jsFile });
        console.log(`Injected: ${path.basename(jsFile)}`);
      } catch (error) {
        console.error(`Error injecting ${jsFile}:`, error.message);
      }
    }
  }

  async executeStep(step, stepIndex) {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const action = step.action;
    const beginTime = Date.now();

    try {
      switch (action) {
        case 'click':
          await this.handleClick(step);
          break;
        case 'wait_for_voice':
          await this.handleWaitForVoice(step);
          break;
        case 'wait_for_silence':
          await this.handleWaitForSilence(step);
          break;
        case 'wait':
          await this.handleWait(step);
          break;
        case 'speak':
          await this.handleSpeak(step);
          break;
        case 'listen':
          await this.handleListen(step);
          break;
        case 'sleep':
          await this.handleSleep(step);
          break;
        case 'wait_for_element':
          await this.handleWaitForElement(step);
          break;
        case 'type':
          await this.handleType(step);
          break;
        case 'screenshot':
          await this.handleScreenshot(step);
          break;
        default:
          console.log(`Unknown action: ${action}`);
      }

      // Record elapsed time for all steps
      const elapsedTimeMs = Date.now() - beginTime;
      const elapsedTimeSec = elapsedTimeMs / 1000;
      console.log(`\tElapsed time: ${elapsedTimeSec.toFixed(3)} seconds`);

      // Record step time for report if enabled and step has metrics attribute
      if (this.reportGenerator && step.metrics) {
        this.reportGenerator.recordStepTime(stepIndex, elapsedTimeMs, step.action);
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

  async handleWaitForVoice(step) {
    try {
      await this.waitForAudioEvent('audiostart');
    } catch (error) {
      console.error('Timeout waiting for voice input:', error.message);
      throw error;
    }
  }

  async handleWaitForSilence(step) {
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
    const file = step.file;

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

      await this.page.evaluate((url) => {
        if (typeof window.__speakFromUrl === 'function') {
          window.__speakFromUrl(url);
        } else {
          throw new Error('__speakFromUrl method not available');
        }
      }, fileUrl);
    } else {
      await this.page.evaluate((textToSpeak) => {
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

      // Wait for recording to start
      await this.waitForAudioEvent('recordingstart');
      console.log('Recording started successfully');

      // Wait for voice input (audiostart event)
      await this.waitForAudioEvent('audiostart');
      console.log('Voice input detected');

      // Wait for silence (audiostop event)
      await this.waitForAudioEvent('audiostop');
      console.log('Silence detected, stopping recording');

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
      console.log('Recording completed');

      // Process the audio with OpenAI
      const audioMetadata = {
        mimeType: recordingEvent.data.mimeType,
        sampleRate: recordingEvent.data.sampleRate,
        channels: recordingEvent.data.channels,
        bitsPerSample: recordingEvent.data.bitsPerSample
      };
      const transcription = await this.transcribeAudio(recordingEvent.data.audioData, audioMetadata);
      console.log(`Transcription: ${transcription}`);

      // Evaluate the transcription against the evaluation prompt
      const evaluationResult = await this.evaluateTranscription(transcription, evaluation);
      console.log(`Evaluation result: ${evaluationResult}`);
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

  async transcribeAudio(base64Audio, audioMetadata) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for transcription');
    }

    try {
      // Convert base64 to buffer
      const pcmBuffer = Buffer.from(base64Audio, 'base64');

      // Convert PCM to WAV format for OpenAI API
      const wavBuffer = this.pcmToWav(pcmBuffer, audioMetadata.sampleRate, audioMetadata.channels, audioMetadata.bitsPerSample);

      // Create a temporary WAV file
      const tempAudioPath = path.join(__dirname, '..', 'temp_audio.wav');
      fs.writeFileSync(tempAudioPath, wavBuffer);

      // Create a file stream for OpenAI
      const audioFile = fs.createReadStream(tempAudioPath);

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });

      // Clean up temporary file
      fs.unlinkSync(tempAudioPath);

      return transcription.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  pcmToWav(pcmBuffer, sampleRate, channels, bitsPerSample) {
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;
    const dataSize = pcmBuffer.length;
    const fileSize = 36 + dataSize;

    const wavBuffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // RIFF chunk descriptor
    wavBuffer.write('RIFF', offset); offset += 4;
    wavBuffer.writeUInt32LE(fileSize, offset); offset += 4;
    wavBuffer.write('WAVE', offset); offset += 4;

    // fmt sub-chunk
    wavBuffer.write('fmt ', offset); offset += 4;
    wavBuffer.writeUInt32LE(16, offset); offset += 4; // Sub-chunk size
    wavBuffer.writeUInt16LE(1, offset); offset += 2; // Audio format (1 = PCM)
    wavBuffer.writeUInt16LE(channels, offset); offset += 2;
    wavBuffer.writeUInt32LE(sampleRate, offset); offset += 4;
    wavBuffer.writeUInt32LE(byteRate, offset); offset += 4;
    wavBuffer.writeUInt16LE(blockAlign, offset); offset += 2;
    wavBuffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data sub-chunk
    wavBuffer.write('data', offset); offset += 4;
    wavBuffer.writeUInt32LE(dataSize, offset); offset += 4;
    pcmBuffer.copy(wavBuffer, offset);

    return wavBuffer;
  }

  async evaluateTranscription(transcription, evaluationPrompt) {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for evaluation');
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant that evaluates transcribed speech against given criteria. Provide a clear, concise evaluation result."
          },
          {
            role: "user",
            content: `Evaluation criteria: ${evaluationPrompt}\n\nTranscribed speech: "${transcription}"\n\nPlease evaluate whether the transcribed speech meets the criteria and provide your assessment.`
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error evaluating transcription:', error);
      throw new Error(`Evaluation failed: ${error.message}`);
    }
  }

  async runScenario(url, steps) {
    try {
      await this.launch();

      await this.page.goto(url);

      // Inject JavaScript files after the page has loaded
      await this.injectJavaScriptFiles();

      // Execute all configured steps
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`Executing step ${i + 1}: ${JSON.stringify(step)}`);
        await this.executeStep(step, i);
      }

      // Keep the browser open for a bit after all steps
      await this.sleep(5000);

      // Finish this run for report generation
      if (this.reportGenerator) {
        this.reportGenerator.finishRun();
      }

    } finally {
      await this.close();
    }
  }
}