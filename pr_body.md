## Summary

Enhanced benchmarking infrastructure with Shadow DOM support, dynamic parameter handling, and VAPI assistant import functionality.

## Key Changes

### 🔄 VAPI Import Module (`src/vapi-import.js`)
- Auto-creates Telnyx integration secrets from provider API keys
- Imports assistants from external providers (VAPI, ElevenLabs, Retell)
- Automatically enables `supports_unauthenticated_web_calls` for imported assistants

### 🎯 Dynamic Parameters Support (`src/index.js`)
- Added `--import-provider` and `--import-api-key` CLI flags for provider import
- Support for dynamic `{{parameter}}` placeholders in application URLs
- Enhanced logging and error handling throughout

### 🌐 Shadow DOM Widget Support
- New `telnyx_portal_widget.yaml` application config
- Uses `execute_javascript` action to interact with Shadow DOM elements
- Proper click handling for the Telnyx AI Agent widget button

### 📋 New Benchmark Configurations
- `vapi.yaml` - Direct VAPI benchmarking
- `vapi_via_telnyx.yaml` - VAPI assistants imported to Telnyx
- `appointment.yaml` - Appointment scheduling scenario

### 🔧 Other Improvements
- Updated `audio_output_hooks.js` for better audio handling
- Improved `voice-agent-tester.js` with dynamic params support
- Updated integration tests

## Testing
Run benchmarks with:
```bash
# Direct Telnyx widget
npm run bench -- --application benchmarks/applications/telnyx_portal_widget.yaml \
  --scenario benchmarks/scenarios/appointment.yaml \
  --assistantId <assistant-id>

# Import from VAPI and run
npm run bench -- --application benchmarks/applications/vapi_via_telnyx.yaml \
  --scenario benchmarks/scenarios/appointment.yaml \
  --import-provider vapi --import-api-key <vapi-key>
```
