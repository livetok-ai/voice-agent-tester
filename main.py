import argparse
import yaml
import asyncio
import os
import glob
from pyppeteer import launch
import time

# Parse command-line arguments
parser = argparse.ArgumentParser(description="Run browser automation with audio capture.")
parser.add_argument('--config', type=str, default='config.yaml', help='Path to the YAML config file (default: config.yaml)')
parser.add_argument('--verbose', action='store_true', help='Show browser console logs')
args = parser.parse_args()

# Load YAML config
with open(args.config, 'r') as f:
    config = yaml.safe_load(f)

url = config.get('url')
steps = config.get('steps', [])
headless = config.get('headless', False)

print(f"Config file loaded: {args.config} - URL: {url}")

async def inject_javascript_files(page):
    """Inject all JavaScript files from the javascript folder"""
    js_folder = os.path.join(os.path.dirname(__file__), 'voice_agent_tester', 'javascript')
    js_files = glob.glob(os.path.join(js_folder, '*.js'))
    
    for js_file in js_files:
        try:
            await page.addScriptTag(path=js_file)
            print(f"Injected: {os.path.basename(js_file)}")
        except Exception as e:
            print(f"Error injecting {js_file}: {e}")

async def execute_step(step, page):
    """Execute a single step from the scenario"""
    action = step.get('action')
    begin_time = time.time()
    
    if action == 'click':
        element = step.get('element')
        if element:
            print(f"Clicking element: {element}")
            try:
                await page.click(element)
                await asyncio.sleep(0.5)  # Brief wait after click
            except Exception as e:
                print(f"Error clicking element {element}: {e}")
        else:
            print("Error: No element specified for click action")
    elif action == 'wait_for_voice':
        print("Waiting for voice input...")
        await asyncio.sleep(1000)  # Wait 3 seconds for voice
    elif action == 'wait_for_silence':
        print("Waiting for silence...")
        await asyncio.sleep(1000)  # Wait 3 seconds for voice
    elif action == 'wait':
        element = step.get('element')
        if element:
            print(f"Waiting for element: {element}")
            await page.waitForSelector(element)
        else:
            print("Error: No element specified for wait action")
        pass
    elif action == 'speak':
        text = step.get('text')
        if text:
            print(f"Speaking: {text}")
            # Use speech synthesis API to speak the text
            await page.evaluate(f'speechSynthesis.speak(new SpeechSynthesisUtterance("{text}"))')

            await asyncio.sleep(10)  # Wait for speech to complete
    else:
        print(f"Unknown action: {action}")

    elapsed_time = time.time() - begin_time
    print(f"Elapsed time: {elapsed_time:.3f} seconds")

async def run_scenario(url, steps):
    try:
        browser = await launch(headless=headless, args=[
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--use-fake-ui-for-media-stream',
            # '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--no-first-run',
            '--no-default-browser-check'
        ])
        page = await browser.newPage()
        
        # Enable console logging if verbose mode is enabled
        if args.verbose:
            page.on('console', lambda msg: print(f"[BROWSER] {msg.text}"))
        
        await page.goto(url)
        
        # Inject JavaScript files after the page has loaded
        await inject_javascript_files(page)
        
        # Execute all configured steps
        for i, step in enumerate(steps, 1):
            print(f"Executing step {i}: {step}")
            await execute_step(step, page)
        
        # Keep the browser open for a bit after all steps
        await asyncio.sleep(5)
        await browser.close()
    except Exception as e:
        print(f"Error running scenario: {e}")

if __name__ == "__main__":
    asyncio.run(run_scenario(url, steps))
