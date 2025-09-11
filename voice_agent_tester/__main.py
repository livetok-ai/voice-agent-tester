import asyncio
import os
from pathlib import Path
import time

import typer
import yaml
from pyppeteer import launch
from pydantic import BaseModel, Field, ValidationError
from typing import Union

app = typer.Typer()

class Step(BaseModel):
    action: str
    value: Union[str, int]

class Scenario(BaseModel):
    name: str
    url: str
    javascript_file: Path
    steps: list[Step]

class Config(BaseModel):
    scenarios: list[Scenario]

async def run_scenario(scenario: Scenario):
    print(f"\nRunning scenario: {scenario.name}")
    browser = await launch(headless=False)
    page = await browser.newPage()

    # Set up console log capture
    def handle_console_log(msg):
        # Extract the text content from the console message
        text = msg.text
        print(f"JS> {text}")

    # Listen for console messages
    page.on('console', handle_console_log)

    try:
        print(f"Navigating to {scenario.url}")
        await page.goto(scenario.url)

        # Inject audio monitoring hooks first
        audio_hooks_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'javascript', 'audio_output_hooks.js')
        if os.path.exists(audio_hooks_path):
            with open(audio_hooks_path, 'r') as f:
                audio_hooks_content = f.read()
            print("Injecting audio output hooks")
            await page.evaluate(audio_hooks_content)
        else:
            print(f"Warning: Audio output hooks not found at {audio_hooks_path}")

        audio_input_hooks_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'javascript', 'audio_input_hooks.js')
        if os.path.exists(audio_input_hooks_path):
            with open(audio_input_hooks_path, 'r') as f:
                audio_input_content = f.read()
            print("Injecting audio input hooks")
            await page.evaluate(audio_input_content)
        else:
            print(f"Warning: Audio input hooks not found at {audio_input_hooks_path}")

        # Then inject the scenario-specific JavaScript
        js_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scenarios', scenario.javascript_file)
        if os.path.exists(js_file_path):
            with open(js_file_path, 'r') as f:
                js_content = f.read()
            print(f"Injecting JavaScript from {scenario.javascript_file}")
            await page.evaluate(js_content)
        else:
            print(f"Warning: JavaScript file not found at {js_file_path}")

        for step in scenario.steps:
            print(f"Executing step: {step.action} {step.value}")
            if step.action == "wait":
                time.sleep(int(step.value))
            elif step.action == "say":
                # This is a placeholder. In a real scenario, you'd interact with the voice agent.
                # For example, you might use page.evaluate to call a JS function that sends text to the agent.
                print(f"Simulating voice input: '{step.value}'")
            else:
                print(f"Unknown action: {step.action}")

    except Exception as e:
        print(f"An error occurred during scenario execution: {e}")
    finally:
        await browser.close()

@app.command()
def run(config_file: Path = typer.Option(
    "scenarios/scenarios.yaml",
    exists=True,
    file_okay=True,
    dir_okay=False,
    writable=False,
    readable=True,
    resolve_path=True,
    help="Path to the test scenarios YAML file."
)):
    """Run voice agent test scenarios."""
    print(f"Loading configuration from {config_file}")
    try:
        with open(config_file, 'r') as f:
            config_data = yaml.safe_load(f)
        config = Config(**config_data)

        for scenario in config.scenarios:
            asyncio.run(run_scenario(scenario))

    except FileNotFoundError:
        print(f"Error: Config file not found at {config_file}")
    except ValidationError as e:
        print(f"Error: Invalid configuration file format: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    app()
