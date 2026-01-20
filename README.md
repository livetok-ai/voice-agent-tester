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
voice-agent-tester --help
```

## CLI Options

| Option | Description |
|--------|-------------|
| `-a, --applications` | Application config paths (required) |
| `-s, --scenarios` | Scenario config paths (required) |
| `--assistant-id` | Telnyx assistant ID for direct benchmarking |
| `--agent-id` | ElevenLabs agent ID for direct benchmarking |
| `--branch-id` | ElevenLabs branch ID |
| `--share-key` | Vapi share key for embedded widget |
| `--api-key` | Telnyx API key for authentication |
| `--provider` | Import from external provider (`vapi`, `elevenlabs`, `retell`) |
| `--provider-api-key` | External provider API key (required with `--provider`) |
| `--provider-import-id` | Provider assistant/agent ID to import |
| `--params` | Additional URL template params (e.g., `--params key=value`) |
| `--debug` | Enable detailed timeout diagnostics with WebRTC stats |
| `--headless` | Run browser in headless mode (default: true) |
| `--repeat` | Number of repetitions per combination |
| `-v, --verbose` | Show browser console logs |

## Usage Examples

### Telnyx Assistant

```bash
voice-agent-tester -a apps/telnyx.yaml -s scenarios/test.yaml --assistant-id <TELNYX_ASSISTANT_ID>
```

### ElevenLabs Agent

```bash
voice-agent-tester -a apps/elevenlabs.yaml -s scenarios/test.yaml --agent-id <ELEVENLABS_AGENT_ID> --branch-id <BRANCH_ID>
```

### Vapi Assistant

```bash
voice-agent-tester -a apps/vapi.yaml -s scenarios/test.yaml --assistant-id <VAPI_ASSISTANT_ID> --share-key <SHARE_KEY>
```

### Import from Provider to Telnyx

Import an assistant from Vapi/ElevenLabs/Retell into Telnyx and benchmark:

```bash
voice-agent-tester -a apps/telnyx.yaml -s scenarios/test.yaml --provider vapi --api-key <TELNYX_API_KEY> --provider-api-key <VAPI_API_KEY> --provider-import-id <VAPI_ASSISTANT_ID>
```

## Multi-Provider Support

- **Direct benchmarking**: Use provider-specific options (`--assistant-id`, `--agent-id`, `--share-key`)
- **Provider import**: Import assistants from Vapi/ElevenLabs/Retell into Telnyx via `--provider`
- **Auto-configuration**: Automatic integration secret management and web call enablement

## Debug & Diagnostics

When `--debug` is enabled, timeout events include WebRTC RTP statistics (packets received, bytes transferred, jitter, packet loss).

## License

MIT