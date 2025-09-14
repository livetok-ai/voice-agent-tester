import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { VoiceAgentTester } from '../src/voice-agent-tester.js';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

describe('Integration Tests', () => {
  let tester;

  beforeEach(() => {
    tester = new VoiceAgentTester({ 
      verbose: false, 
      headless: true 
    });
  });

  afterEach(async () => {
    if (tester) {
      await tester.close();
    }
  });

  test('should run a complete scenario', async () => {
    // Create a simple test page
    const testPageContent = `
      <html>
        <body>
          <h1>Voice Agent Test Page</h1>
          <button id="start">Start Test</button>
          <div id="status">Not started</div>
          <div id="speech-output"></div>
          <script>
            document.getElementById('start').addEventListener('click', () => {
              document.getElementById('status').textContent = 'Test started';
            });
            
            // Mock speech synthesis for testing
            window.speechSynthesis = {
              speak: (utterance) => {
                document.getElementById('speech-output').textContent = utterance.text;
              }
            };
            window.SpeechSynthesisUtterance = function(text) {
              this.text = text;
            };
          </script>
        </body>
      </html>
    `;

    // Use data URL to avoid file system dependencies
    const testUrl = `data:text/html,${encodeURIComponent(testPageContent)}`;

    const steps = [
      { action: 'click', element: '#start' },
      { action: 'speak', text: 'Hello, this is a test.' }
    ];

    // Override waitForTimeout to speed up tests
    await tester.launch();
    const originalTimeout = tester.page.waitForTimeout;
    tester.page.waitForTimeout = async (ms) => {
      if (ms === 10000) return Promise.resolve(); // Skip the 10s speech wait
      if (ms === 5000) return Promise.resolve(); // Skip the 5s final wait
      return originalTimeout.call(tester.page, Math.min(ms, 100)); // Cap other waits at 100ms
    };

    await tester.runScenario(testUrl, steps);

    // The scenario should complete without throwing errors
    expect(true).toBe(true);
  });

  test('should handle scenario with wait step', async () => {
    const testPageContent = `
      <html>
        <body>
          <h1>Wait Test Page</h1>
          <button id="trigger">Trigger</button>
          <script>
            document.getElementById('trigger').addEventListener('click', () => {
              setTimeout(() => {
                const newDiv = document.createElement('div');
                newDiv.id = 'dynamic-element';
                newDiv.textContent = 'Dynamic content appeared';
                document.body.appendChild(newDiv);
              }, 50);
            });
          </script>
        </body>
      </html>
    `;

    const testUrl = `data:text/html,${encodeURIComponent(testPageContent)}`;

    const steps = [
      { action: 'click', element: '#trigger' },
      { action: 'wait', element: '#dynamic-element' }
    ];

    await tester.launch();
    
    // Override timeouts for faster testing
    const originalTimeout = tester.page.waitForTimeout;
    tester.page.waitForTimeout = async (ms) => {
      if (ms === 5000) return Promise.resolve(); // Skip final wait
      return originalTimeout.call(tester.page, Math.min(ms, 100));
    };

    await tester.runScenario(testUrl, steps);

    // Verify the dynamic element exists
    const element = await tester.page.$('#dynamic-element');
    expect(element).not.toBe(null);
  });

  test('should handle JavaScript injection', async () => {
    // Create a minimal test scenario to verify JS injection works
    const testPageContent = `
      <html>
        <body>
          <div id="js-test">No JS loaded</div>
        </body>
      </html>
    `;

    const testUrl = `data:text/html,${encodeURIComponent(testPageContent)}`;

    await tester.launch();
    await tester.page.goto(testUrl);
    
    // Call injectJavaScriptFiles (should handle missing directory gracefully)
    await tester.injectJavaScriptFiles();

    // Verify the page still works after injection attempt
    const content = await tester.page.evaluate(() => document.getElementById('js-test').textContent);
    expect(content).toBe('No JS loaded');
  });
});