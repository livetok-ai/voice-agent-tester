# Voice Agent Tester - Development Guidelines

## Design Overview

### Purpose
A CLI tool for automated testing of voice agents using Puppeteer. It executes test scenarios against voice-enabled web applications, records audio/video, transcribes responses, and evaluates them using AI.

### Architecture

```
src/
├── index.js              # CLI entry point (yargs argument parsing)
├── voice-agent-tester.js # Core test execution engine
├── report.js             # CSV report generation
├── server.js             # Express assets server
└── transcription.js      # OpenAI Whisper transcription

javascript/               # Browser-injected scripts for audio hooks
applications/             # Application YAML configs
scenarios/                # Scenario YAML configs
output/                   # Recordings and reports
```

### Key Components

- **VoiceAgentTester**: Main class that launches browser, executes steps, handles events
- **ReportGenerator**: Tracks metrics and generates CSV reports
- **Assets Server**: Serves audio files and temporary HTML pages

### Test Execution Flow

1. Parse CLI arguments and load YAML configs
2. Create combinations of applications × scenarios
3. For each test run:
   - Launch browser (with puppeteer-stream for recording)
   - Navigate to application URL
   - Inject audio hook scripts
   - Execute application steps then scenario steps
   - Record metrics and save recordings
   - Close browser

### Event System

Browser-to-Node communication via `__publishEvent()`:
- `audiostart` / `audiostop` - Voice activity detection
- `speechend` - TTS completion
- `recordingstart` / `recordingcomplete` - Audio recording lifecycle

## Coding Standards

- Use simple JavaScript (ES modules)
- Keep functions short and focused
- Prefer async/await over callbacks
- Use descriptive variable and function names

## Testing

- Avoid using mocks as much as possible
- Write unit tests for methods without dependencies
- Write integration tests for all features and CLI flags
- Tests should be self-contained and not require external services

## Dependencies

- Only add new dependencies when truly necessary
- Prefer built-in Node.js modules when available

## Git Commits

- Use single-line commit messages
- Keep messages concise and descriptive
- Focus on what changed, not implementation details
