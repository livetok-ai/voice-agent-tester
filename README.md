# Voice Agent Tester

A command-line tool for automated testing of voice agents using Puppeteer. This tool allows you to create test scenarios that interact with voice-enabled web applications by simulating user actions, speaking audio, listening for responses, and measuring performance metrics.

## Features

- **Browser Automation**: Headless or visual browser control using Puppeteer
- **Voice Interaction**: Speak audio files or use text-to-speech
- **Recordings**: Record sessions for subjective evaluation
- **Transcriptions**: Generate and process transcriptions
- **Performance Metrics**: Measure elapsed times for steps
- **LLM Evaluation**: LLM as a judge support to validate responses
- **Multiple Test Runs**: Repeat scenarios multiple times for consistent testing
- **Configurable Scenarios**: YAML-based test scenario definitions
- **Reporting**: Generate CSV reports with metrics and results

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Optional: Port for assets server (default: 3333)
export HTTP_PORT=3333

# Required for 'listen' action with transcription and evaluation
export OPENAI_API_KEY=your-openai-api-key-here
```

**Note:** The `OPENAI_API_KEY` is only required if you're using the `listen` action, which transcribes audio using OpenAI's Whisper API and evaluates responses using GPT-4.

## Usage

### Basic Usage

```bash
# Run with application and scenario
npm start -- -a apps/livetok.yaml -s suites/appointment.yaml

# Run with multiple applications and scenarios (creates matrix)
npm start -- -a apps/app1.yaml,apps/app2.yaml -s suites/scenario1.yaml,suites/scenario2.yaml

# Run all apps in a folder with all scenarios in another folder
npm start -- -a apps/ -s suites/

# Run in non-headless mode (show browser)
npm start -- -a apps/livetok.yaml -s suites/appointment.yaml --headless false

# Generate performance report
npm start -- -a apps/livetok.yaml -s suites/appointment.yaml --report test-metrics-report.csv

# Run each combination multiple times
npm start -- -a apps/livetok.yaml -s suites/appointment.yaml --repeat 5
```

### Command Line Arguments

| Argument | Alias | Type | Required | Description |
|----------|--------|------|----------|-------------|
| `--applications` | `-a` | string | Yes | Comma-separated application paths or folder path |
| `--scenarios` | `-s` | string | Yes | Comma-separated scenario paths or folder path |
| `--verbose` | `-v` | boolean | No | Show browser console logs (default: false) |
| `--report` | `-r` | string | No | Generate CSV report with step elapsed times |
| `--repeat` | | number | No | Number of repetitions to run each combination (default: 1) |
| `--headless` | | boolean | No | Run browser in headless mode (default: true) |
| `--assets-server` | | string | No | Assets server URL (default: http://localhost:3333) |

## Configuration

The configuration is split in two parts, application configuration and scenario configuration but they have the same format and the same type of steps.   The separation is only to be able to run the same scenarios with multiple applications and multiple scenarios with a single application while avoiding duplication of shared steps.

### Application Configuration

Application configs define the URL and initial setup steps. They should be placed in the `apps/` folder.

**Structure:**
```yaml
url: "http://localhost:8080/demo/index.html"
steps:
  - action: fill
    selector: "input[type='password']"
    text: "your-api-key"
  - action: click
    selector: "#start"
  - action: wait_for_voice
  - action: wait_for_silence
```

**Key points:**
- Must contain either `url` or `html` field
- `steps` are optional but typically include setup actions
- Steps run first, before scenario steps

### Scenario Configuration

Scenario configs define test steps to execute after the application is set up. They should be placed in the `suites/` folder.

**Structure:**
```yaml
steps:
  - action: speak
    file: hello_make_an_appointment.mp3
  - action: wait_for_voice
    metrics: elapsed_time
  - action: wait_for_silence
  - action: listen
    evaluation: "The response should greet the user"
```

**Key points:**
- Only contains `steps` (no URL)
- Steps run after application steps
- Can be combined with any application

### Matrix Execution

When you provide multiple applications and scenarios, the tool creates a matrix and runs all combinations:

```bash
# This will run 4 combinations:
# app1 + scenario1
# app1 + scenario2
# app2 + scenario1
# app2 + scenario2
npm start -- -a apps/app1.yaml,apps/app2.yaml -s suites/scenario1.yaml,suites/scenario2.yaml
```

### Supported Actions

#### `click`
Click on a web element.
```yaml
- action: click
  selector: "#button-id"
```

#### `wait_for_voice`
Wait for voice input to start (audio detection).
```yaml
- action: wait_for_voice
  metrics: elapsed_time  # Optional: include in performance report
```

#### `wait_for_silence`
Wait for voice input to stop (silence detection).
```yaml
- action: wait_for_silence
  metrics: elapsed_time
```

#### `speak`
Play audio or synthesize speech. Use either `file` or `text`, not both.  Only the file option is properly supported for now.
```yaml
# Play audio file from assets/ directory
- action: speak
  file: greeting.mp3

# Text-to-speech
- action: speak
  text: "Hello, how can I help you?"
```

#### `listen`
Record audio output from the agent, transcribe it, and evaluate against criteria using AI.

**Requirements:**
- OpenAI API key must be set in `OPENAI_API_KEY` environment variable
- Uses Whisper API for transcription
- Uses GPT-4 for evaluation

```yaml
- action: listen
  evaluation: "The response should contain appointment scheduling information"
```

**How it works:**
1. Starts recording audio output
2. Waits for agent to start speaking (audiostart event)
3. Waits for agent to stop speaking (audiostop event after 1s silence)
4. Saves recording as WAV file in `output/` directory
5. Transcribes audio using OpenAI Whisper
6. Evaluates transcription against the criteria using GPT-4

#### `wait`
Wait for a web element to appear.
```yaml
- action: wait
  selector: ".loading-complete"
```

#### `wait_for_element`
Alias for `wait` action.
```yaml
- action: wait_for_element
  selector: ".ready-indicator"
```

#### `type`
Type text into a form field.
```yaml
- action: type
  selector: "#input-field"
  text: "John Doe"
```

#### `sleep`
Pause execution for specified milliseconds.
```yaml
- action: sleep
  time: 2000
```

### Performance Metrics

Add `metrics: elapsed_time` to any step to include its execution time in the performance report:

```yaml
- action: wait_for_voice
  metrics: elapsed_time
```

When using `--report`, a CSV file will be generated with columns for each step that has metrics enabled.

## Project Structure

```
├── src/
│   ├── index.js              # Main CLI entry point
│   ├── voice-agent-tester.js # Core testing logic
│   ├── report.js             # CSV report generation
│   └── server.js             # Assets HTTP server
├── javascript/               # Browser-injected scripts
│   ├── audio_input_hooks.js  # Audio recording functionality
│   ├── audio_output_hooks.js # Speech synthesis functionality
│   └── recording-processor.js # Audio processing utilities
├── apps/                     # Application configurations (URL + setup steps)
│   └── livetok.yaml         # Example application config
├── suites/                   # Scenario configurations (test steps)
│   └── appointment.yaml     # Example scenario config
├── assets/                   # Audio files for speak action
└── package.json
```

## Example

### Complete Example

**Application config** (`apps/my_app.yaml`):
```yaml
url: "http://localhost:8080/voice-app"
steps:
  - action: click
    selector: "#start-button"
  - action: wait_for_voice
  - action: wait_for_silence
```

**Scenario config** (`suites/greeting_test.yaml`):
```yaml
steps:
  - action: speak
    text: "Hello, I need help with my account"
  - action: wait_for_voice
    metrics: elapsed_time
  - action: listen
    evaluation: "Response should acknowledge the account help request"
```

**Run the test:**
```bash
npm start -- -a apps/my_app.yaml -s suites/greeting_test.yaml
```


## Requirements

- Node.js 18+
- OpenAI API key (for `listen` action)
- Chrome/Chromium browser (automatically managed by Puppeteer)

## Troubleshooting

### Browser Issues
- Try running with `--headless false` to see browser interactions
- Use `--verbose` flag to see browser console logs
- Check if target URL is accessible

## License

MIT