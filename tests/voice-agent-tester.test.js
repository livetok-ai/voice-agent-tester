import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { VoiceAgentTester } from '../src/voice-agent-tester.js';
import fs from 'fs';
import path from 'path';

describe('VoiceAgentTester', () => {
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

  test('should create instance with default options', () => {
    const defaultTester = new VoiceAgentTester();
    expect(defaultTester.verbose).toBe(false);
    expect(defaultTester.headless).toBe(false);
    expect(defaultTester.browser).toBe(null);
    expect(defaultTester.page).toBe(null);
  });

  test('should create instance with custom options', () => {
    const customTester = new VoiceAgentTester({ 
      verbose: true, 
      headless: true 
    });
    expect(customTester.verbose).toBe(true);
    expect(customTester.headless).toBe(true);
  });

  test('should launch browser successfully', async () => {
    await tester.launch();
    expect(tester.browser).not.toBe(null);
    expect(tester.page).not.toBe(null);
  });

  test('should close browser successfully', async () => {
    await tester.launch();
    expect(tester.browser).not.toBe(null);
    
    await tester.close();
    expect(tester.browser).toBe(null);
    expect(tester.page).toBe(null);
  });

  test('should handle basic navigation', async () => {
    await tester.launch();
    
    // Navigate to a basic page
    await tester.page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    
    const title = await tester.page.evaluate(() => document.querySelector('h1').textContent);
    expect(title).toBe('Test Page');
  });

  test('should execute click step', async () => {
    await tester.launch();
    
    // Create a simple page with a clickable button
    await tester.page.goto('data:text/html,<html><body><button id="test-btn">Click Me</button><div id="result"></div></body></html>');
    
    // Add click handler
    await tester.page.evaluate(() => {
      document.getElementById('test-btn').addEventListener('click', () => {
        document.getElementById('result').textContent = 'clicked';
      });
    });
    
    // Execute click step
    await tester.executeStep({
      action: 'click',
      selector: '#test-btn'
    }, 0, 'scenario');
    
    // Verify the click worked
    const result = await tester.page.evaluate(() => document.getElementById('result').textContent);
    expect(result).toBe('clicked');
  });

  test('should execute wait step', async () => {
    await tester.launch();
    
    // Create a page with an element that appears after a delay
    await tester.page.goto('data:text/html,<html><body><div id="container"></div></body></html>');
    
    // Add the element after a short delay
    await tester.page.evaluate(() => {
      setTimeout(() => {
        const newDiv = document.createElement('div');
        newDiv.id = 'delayed-element';
        newDiv.textContent = 'I appeared!';
        document.getElementById('container').appendChild(newDiv);
      }, 100);
    });
    
    // Execute wait step
    await tester.executeStep({
      action: 'wait',
      selector: '#delayed-element'
    }, 0, 'scenario');
    
    // Verify the element exists
    const element = await tester.page.$('#delayed-element');
    expect(element).not.toBe(null);
  });

  test('should handle speak step', async () => {
    await tester.launch();
    
    await tester.page.goto('data:text/html,<html><body><div id="speech-test"></div></body></html>');
    
    // Mock speechSynthesis to capture the speak call
    await tester.page.evaluate(() => {
      window.speechSynthesis = {
        speak: (utterance) => {
          document.getElementById('speech-test').textContent = utterance.text;
        }
      };
      window.SpeechSynthesisUtterance = function(text) {
        this.text = text;
      };
    });
    
    // Execute speak step with shorter timeout for testing
    const originalTimeout = tester.page.waitForTimeout;
    tester.page.waitForTimeout = async (ms) => {
      if (ms === 10000) return Promise.resolve(); // Skip the 10s wait
      return originalTimeout.call(tester.page, ms);
    };
    
    await tester.executeStep({
      action: 'speak',
      text: 'Hello, this is a test'
    }, 0, 'scenario');
    
    // Verify speech was triggered
    const speechText = await tester.page.evaluate(() => document.getElementById('speech-test').textContent);
    expect(speechText).toBe('Hello, this is a test');
  });

  test('should handle unknown action gracefully', async () => {
    await tester.launch();
    await tester.page.goto('data:text/html,<html><body></body></html>');
    
    // Mock console.log to capture the output
    const originalLog = console.log;
    let logMessage = '';
    console.log = (message) => {
      logMessage = message;
    };
    
    await tester.executeStep({
      action: 'unknown_action'
    }, 0, 'scenario');
    
    expect(logMessage).toBe('Unknown action: unknown_action');
    
    // Restore console.log
    console.log = originalLog;
  });

  test('should throw error for missing required parameters', async () => {
    await tester.launch();
    await tester.page.goto('data:text/html,<html><body></body></html>');
    
    // Test click without selector
    await expect(tester.executeStep({ action: 'click' }, 0, 'scenario'))
      .rejects.toThrow('No selector specified for click action');

    // Test wait without selector
    await expect(tester.executeStep({ action: 'wait' }, 0, 'scenario'))
      .rejects.toThrow('No selector specified for wait action');

    // Test speak without text
    await expect(tester.executeStep({ action: 'speak' }, 0, 'scenario'))
      .rejects.toThrow('No text or file specified for speak action');
  });
});