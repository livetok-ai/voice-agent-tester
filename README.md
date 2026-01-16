# Voice Agent Tester (Telnyx Fork)

[![CI](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml/badge.svg)](https://github.com/team-telnyx/voice-agent-tester/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@telnyx/voice-agent-tester.svg)](https://www.npmjs.com/package/@telnyx/voice-agent-tester)

This is a [Telnyx](https://telnyx.com) fork of [livetok-ai/voice-agent-tester](https://github.com/livetok-ai/voice-agent-tester). For base documentation (installation, configuration, actions, etc.), see the [original README](https://github.com/livetok-ai/voice-agent-tester#readme).

## Installation

```bash
npm install @telnyx/voice-agent-tester
```

## Fork Enhancements

### CLI Options
| Option | Description |
|--------|-------------|
| `--assistant-id` | Assistant/agent ID for direct benchmarking (Telnyx, ElevenLabs, Vapi) |
| `--api-key` | Telnyx API key for authentication and import operations |
| `--provider` | Import from external provider (`vapi`, `elevenlabs`, `retell`) into Telnyx |
| `--provider-api-key` | External provider API key (required with `--provider`) |
| `--provider-import-id` | Provider assistant/agent ID to import (required with `--provider`) |
| `--params` | Additional URL template params (e.g., `--params branchId=xxx,shareKey=yyy`) |
| `--debug` | Enable detailed timeout diagnostics with WebRTC stats |

### Multi-Provider Support
- **Direct benchmarking**: Use `--assistant-id` with any provider's YAML config
- **Provider import**: Import assistants from Vapi/ElevenLabs/Retell into Telnyx via `--provider`
- **Auto-configuration**: Automatic integration secret management and web call enablement

### Debug & Diagnostics
When `--debug` is enabled, timeout events include WebRTC RTP statistics (packets received, bytes transferred, jitter, packet loss).

## Usage Examples

### Telnyx Assistant (Direct)

Benchmark a Telnyx AI assistant directly using the Telnyx widget:

```bash
npm run start -- \
  -a benchmarks/applications/telnyx.yaml \
  -s benchmarks/scenarios/appointment.yaml \
  --assistant-id <TELNYX_ASSISTANT_ID>
```

### ElevenLabs Agent (Direct)

Benchmark an ElevenLabs conversational agent. Use `--params` for optional `branchId`:

```bash
npm run start -- \
  -a benchmarks/applications/elevenlabs.yaml \
  -s benchmarks/scenarios/appointment.yaml \
  --assistant-id <ELEVENLABS_AGENT_ID> \
  --params branchId=<BRANCH_ID>
```

### Vapi Assistant (Direct)

Benchmark a Vapi assistant using their embedded widget. Requires `shareKey` via `--params`:

```bash
npm run start -- \
  -a benchmarks/applications/vapi.yaml \
  -s benchmarks/scenarios/appointment.yaml \
  --assistant-id <VAPI_ASSISTANT_ID> \
  --params shareKey=<SHARE_KEY>
```

### Import from Provider to Telnyx

Import an assistant from an external provider (Vapi, ElevenLabs, Retell) into Telnyx and benchmark:

```bash
npm run start -- \
  -a benchmarks/applications/telnyx.yaml \
  -s benchmarks/scenarios/appointment.yaml \
  --provider vapi \
  --api-key <TELNYX_API_KEY> \
  --provider-api-key <VAPI_API_KEY> \
  --provider-import-id <VAPI_ASSISTANT_ID>
```

- `--api-key`: Your Telnyx API key (for creating the import)
- `--provider-api-key`: The external provider's API key (for fetching the assistant)
- `--provider-import-id`: The assistant ID from the provider to import

## License

MIT