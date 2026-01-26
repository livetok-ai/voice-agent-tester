# Voice Agent Tester

[![CI](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml/badge.svg)](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@telnyx/voice-agent-tester.svg)](https://www.npmjs.com/package/@telnyx/voice-agent-tester)

A CLI tool for automated benchmarking and testing of voice AI agents. Supports Telnyx, ElevenLabs, Vapi, and Retell.

## Quick Start

Run directly with npx (no installation required):

```bash
npx @telnyx/voice-agent-tester@latest -a applications/telnyx.yaml -s scenarios/appointment.yaml --assistant-id <YOUR_ASSISTANT_ID>
```

Or install globally:

```bash
npm install -g @telnyx/voice-agent-tester
voice-agent-tester -a applications/telnyx.yaml -s scenarios/appointment.yaml --assistant-id <YOUR_ASSISTANT_ID>
```

## CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `-a, --applications` | required | Application config path(s) or folder |
| `-s, --scenarios` | required | Scenario config path(s) or folder |
| `--assistant-id` | | Telnyx or provider assistant ID |
| `--api-key` | | Telnyx API key for authentication |
| `--provider` | | Import from provider (`vapi`, `elevenlabs`, `retell`) |
| `--provider-api-key` | | External provider API key (required with `--provider`) |
| `--provider-import-id` | | Provider assistant ID to import (required with `--provider`) |
| `--compare` | `true` | Run both provider direct and Telnyx import benchmarks |
| `--no-compare` | | Disable comparison (run only Telnyx import) |
| `-d, --debug` | `false` | Enable detailed timeout diagnostics |
| `-v, --verbose` | `false` | Show browser console logs |
| `--headless` | `true` | Run browser in headless mode |
| `--repeat` | `1` | Number of repetitions per combination |
| `-c, --concurrency` | `1` | Number of parallel tests |
| `-r, --report` | | Generate CSV report to specified file |
| `-p, --params` | | URL template params (e.g., `key=value,key2=value2`) |
| `--record` | `false` | Record video and audio in webm format |
| `--application-tags` | | Filter applications by comma-separated tags |
| `--scenario-tags` | | Filter scenarios by comma-separated tags |
| `--assets-server` | `http://localhost:3333` | Assets server URL |

## Bundled Configs

| Application Config | Provider |
|-------------------|----------|
| `applications/telnyx.yaml` | Telnyx AI Widget |
| `applications/elevenlabs.yaml` | ElevenLabs |
| `applications/vapi.yaml` | Vapi |
| `applications/retell.yaml` | Retell |
| `applications/livetok.yaml` | Livetok |

Scenarios:
- `scenarios/appointment.yaml` - Basic appointment booking test
- `scenarios/appointment_with_noise.yaml` - Appointment with background noise (pre-mixed audio)

## Background Noise Testing

Test voice agents' performance with ambient noise (e.g., crowd chatter, cafe environment). Background noise is pre-mixed into audio files to simulate real-world conditions where users speak to voice agents in noisy environments.

### Running with Background Noise

```bash
# Telnyx with background noise
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment_with_noise.yaml \
  --assistant-id <YOUR_ASSISTANT_ID>

# Compare with no noise (same assistant)
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <YOUR_ASSISTANT_ID>

# Generate CSV report with metrics
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment_with_noise.yaml \
  --assistant-id <YOUR_ASSISTANT_ID> \
  -r output/noise_benchmark.csv
```

### Bundled Audio Files

| File | Description |
|------|-------------|
| `hello_make_an_appointment.mp3` | Clean appointment request |
| `hello_make_an_appointment_with_noise.mp3` | Appointment request with crowd noise |
| `appointment_data.mp3` | Clean appointment details |
| `appointment_data_with_noise.mp3` | Appointment details with crowd noise |

### Scenario Configuration

The noise scenario uses pre-mixed audio files:

```yaml
# scenarios/appointment_with_noise.yaml
tags:
  - default
  - noise
steps:
  - action: wait_for_voice
  - action: wait_for_silence
  - action: sleep
    time: 1000
  - action: speak
    file: hello_make_an_appointment_with_noise.mp3
  - action: wait_for_voice
    metrics: elapsed_time
  - action: wait_for_silence
  - action: speak
    file: appointment_data_with_noise.mp3
  - action: wait_for_voice
    metrics: elapsed_time
```

### Metrics and Reports

The benchmark collects response latency metrics at each `wait_for_voice` step with `metrics: elapsed_time`. Generated CSV reports include:

```csv
app, scenario, repetition, success, duration, step_9_wait_for_voice_elapsed_time, step_12_wait_for_voice_elapsed_time
telnyx, appointment_with_noise, 0, 1, 29654, 1631, 1225
```

Compare results with and without noise to measure how background noise affects your voice agent's:
- Response latency
- Speech recognition accuracy
- Overall conversation flow

## Examples

### Telnyx

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID>
```

### ElevenLabs

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/elevenlabs.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <AGENT_ID>
```

### Vapi

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/vapi.yaml \
  -s scenarios/appointment.yaml \
  --assistant-id <ASSISTANT_ID>
```

## Comparison Mode

When importing from an external provider, the tool automatically runs both benchmarks in sequence and generates a comparison report:

1. **Provider Direct** - Benchmarks the assistant on the original provider's widget
2. **Telnyx Import** - Benchmarks the same assistant after importing to Telnyx

### Import and Compare (Default)

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider vapi \
  --api-key <TELNYX_KEY> \
  --provider-api-key <VAPI_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID>
```

This will:
- Run Phase 1: VAPI direct benchmark
- Run Phase 2: Telnyx import benchmark
- Generate a side-by-side latency comparison report

### Import Only (No Comparison)

To skip the provider direct benchmark and only run the Telnyx import:

```bash
npx @telnyx/voice-agent-tester@latest \
  -a applications/telnyx.yaml \
  -s scenarios/appointment.yaml \
  --provider vapi \
  --no-compare \
  --api-key <TELNYX_KEY> \
  --provider-api-key <VAPI_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID>
```

### Debugging Failures

If benchmarks fail, rerun with `--debug` for detailed diagnostics:

```bash
voice-agent-tester --provider vapi --debug [other options...]
```

## License

MIT