# Voice Agent Tester

A command-line tool for automated testing of voice agents using Puppeteer. This tool allows you to create test scenarios that interact with voice-enabled web applications by simulating user actions, speaking audio, listening for responses, and measuring performance metrics.

## Features

- **Browser Automation**: Headless or visual browser control using Puppeteer
- **Voice Interaction**: Speak audio files or text-to-speech
- **Audio Recording & Transcription**: Record audio responses and transcribe using OpenAI Whisper
- **Performance Metrics**: Measure elapsed times for steps and generate CSV reports
- **Multiple Test Runs**: Repeat scenarios multiple times for consistent testing
- **Configurable Scenarios**: YAML-based test scenario definitions

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export HTTP_PORT=3000  # Optional: Port for assets server (default: 3000)
```

## Usage

### Basic Usage

```bash
# Run with default config file (config.yaml)
npm start

# Run with specific config file
npm start -- --config config_livekit.yaml

# Run in non-headless mode (show browser)
npm start -- --headless false

# Generate performance report
npm start -- --report test-metrics-report.csv

# Run scenario multiple times
npm start -- --repeat 5
```

### Command Line Arguments

| Argument | Alias | Type | Default | Description |
|----------|--------|------|---------|-------------|
| `--config` | `-c` | string | `config.yaml` | Path to YAML configuration file |
| `--verbose` | `-v` | boolean | `false` | Show browser console logs |
| `--report` | `-r` | string | `null` | Generate CSV report with step elapsed times |
| `--repeat` | | number | `1` | Number of repetitions to run the scenario |
| `--headless` | | boolean | `true` | Run browser in headless mode |

## Scenario Configuration

Test scenarios are defined in YAML files. Here's the basic structure:

```yaml
url: "http://localhost:8080/demo/index.html"
steps:
  - action: click
    selector: "#start"
  - action: wait_for_voice
    metrics: elapsed_time
  - action: speak
    file: hello_make_an_appointment.mp3
  - action: listen
    evaluation: "The response should greet the user"
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

#### `listen (WIP)`
Record audio, transcribe it, and evaluate against criteria.
```yaml
- action: listen
  evaluation: "The response should contain appointment scheduling information"
```

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
├── assets/                   # Audio files for speak action
├── config.yaml              # Default scenario configuration
├── config_*.yaml            # Additional scenario configurations
└── package.json
```

## Example Scenarios

### Basic Voice Interaction Test
```yaml
url: "http://localhost:8080/voice-app"
steps:
  - action: click
    selector: "#start-button"
  - action: wait_for_voice
  - action: speak
    text: "Hello, I need help with my account"
  - action: listen
    evaluation: "Response should acknowledge the account help request"
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