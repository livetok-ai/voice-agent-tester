# Voice Agent Tester

[![CI](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml/badge.svg)](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@telnyx/voice-agent-tester.svg)](https://www.npmjs.com/package/@telnyx/voice-agent-tester)

A CLI tool for automated benchmarking and testing of voice AI agents. Supports Telnyx, ElevenLabs, and Vapi.

This is a [Telnyx](https://telnyx.com) fork of [livetok-ai/voice-agent-tester](https://github.com/livetok-ai/voice-agent-tester). For base documentation (configuration, actions, etc.), see the [original README](https://github.com/livetok-ai/voice-agent-tester#readme).

## Installation

```bash
npm install -g @telnyx/voice-agent-tester
```

## Quick Start

```bash
voice-agent-tester -a benchmarks/applications/telnyx.yaml -s benchmarks/scenarios/appointment.yaml --assistant-id <YOUR_ASSISTANT_ID>
```

The CLI includes bundled application and scenario configs that you can use directly.

## CLI Options

| Option | Description |
|--------|-------------|
| `-a, --applications` | Application config path(s) (required) |
| `-s, --scenarios` | Scenario config path(s) (required) |
| `--assistant-id` | Telnyx assistant ID |
| `--agent-id` | ElevenLabs agent ID |
| `--branch-id` | ElevenLabs branch ID |
| `--share-key` | Vapi share key |
| `--api-key` | Telnyx API key |
| `--provider` | Import from external provider (`vapi`, `elevenlabs`, `retell`) |
| `--provider-api-key` | External provider API key |
| `--provider-import-id` | Provider assistant/agent ID to import |
| `--params` | Additional URL template params |
| `--debug` | Enable detailed timeout diagnostics |
| `--headless` | Run browser in headless mode (default: true) |
| `--repeat` | Number of repetitions |
| `-v, --verbose` | Show browser console logs |

## Bundled Configs

The following application configs are included:

| Config | Provider |
|--------|----------|
| `benchmarks/applications/telnyx.yaml` | Telnyx AI Widget |
| `benchmarks/applications/elevenlabs.yaml` | ElevenLabs |
| `benchmarks/applications/vapi.yaml` | Vapi |

Scenario configs:
- `benchmarks/scenarios/appointment.yaml` - Appointment scheduling test

## Usage Examples

### Telnyx Assistant

```bash
voice-agent-tester -a benchmarks/applications/telnyx.yaml -s benchmarks/scenarios/appointment.yaml --assistant-id <TELNYX_ASSISTANT_ID>
```

### ElevenLabs Agent

```bash
voice-agent-tester -a benchmarks/applications/elevenlabs.yaml -s benchmarks/scenarios/appointment.yaml --agent-id <ELEVENLABS_AGENT_ID> --branch-id <BRANCH_ID>
```

### Vapi Assistant

```bash
voice-agent-tester -a benchmarks/applications/vapi.yaml -s benchmarks/scenarios/appointment.yaml --assistant-id <VAPI_ASSISTANT_ID> --share-key <SHARE_KEY>
```

### Import from Provider to Telnyx

```bash
voice-agent-tester -a benchmarks/applications/telnyx.yaml -s benchmarks/scenarios/appointment.yaml --provider vapi --api-key <TELNYX_API_KEY> --provider-api-key <VAPI_API_KEY> --provider-import-id <VAPI_ASSISTANT_ID>
```

## License

MIT