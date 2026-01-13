/**
 * External Provider to Telnyx Assistant Import Module
 *
 * Imports assistants from external providers (vapi, elevenlabs, retell)
 * into Telnyx using the Telnyx AI Assistants Import API.
 * 
 * Features:
 * - Auto-creates integration secrets from provider API keys
 * - Enables unauthenticated web calls for imported assistants
 */

const TELNYX_BASE_URL = 'https://api.telnyx.com/v2';
const TELNYX_SECRETS_ENDPOINT = `${TELNYX_BASE_URL}/integration_secrets`;
const TELNYX_IMPORT_ENDPOINT = `${TELNYX_BASE_URL}/ai/assistants/import`;
const TELNYX_ASSISTANTS_ENDPOINT = `${TELNYX_BASE_URL}/ai/assistants`;

// Supported providers
const SUPPORTED_PROVIDERS = ['vapi', 'elevenlabs', 'retell'];

/**
 * Create an integration secret in Telnyx from a provider's API key.
 *
 * @param {Object} options
 * @param {string} options.identifier - Unique identifier for the secret
 * @param {string} options.token - The API key/token to store
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @returns {Promise<{id: string, identifier: string}>}
 */
async function createIntegrationSecret({ identifier, token, telnyxApiKey }) {
  console.log(`🔐 Creating integration secret: ${identifier}`);

  const response = await fetch(TELNYX_SECRETS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: identifier,
      type: 'bearer',
      token: token
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create integration secret: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`✅ Integration secret created: ${data.data.identifier}`);
  
  return {
    id: data.data.id,
    identifier: data.data.identifier
  };
}

/**
 * Enable unauthenticated web calls for an assistant.
 * Returns true if successful, false if failed (with warning).
 *
 * @param {Object} options
 * @param {string} options.assistantId - The assistant ID
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @returns {Promise<boolean>}
 */
async function enableWebCalls({ assistantId, telnyxApiKey }) {
  console.log(`🌐 Enabling web calls for assistant: ${assistantId}`);

  try {
    const response = await fetch(`${TELNYX_ASSISTANTS_ENDPOINT}/${assistantId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telephony_settings: {
          supports_unauthenticated_web_calls: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️  Could not enable web calls for ${assistantId}: ${response.status}`);
      console.warn(`   This may require manual configuration in the Telnyx portal.`);
      return false;
    }

    console.log(`✅ Web calls enabled for: ${assistantId}`);
    return true;
  } catch (error) {
    console.warn(`⚠️  Error enabling web calls for ${assistantId}: ${error.message}`);
    return false;
  }
}

/**
 * Import assistants from an external provider into Telnyx.
 * 
 * This function:
 * 1. Creates an integration secret from the provider's private API key
 * 2. Imports all assistants from the provider
 * 3. Enables unauthenticated web calls for each imported assistant
 *
 * @param {Object} options - Import options
 * @param {string} options.provider - External provider name (vapi, elevenlabs, retell)
 * @param {string} options.providerApiKey - The provider's private API key
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @returns {Promise<{assistants: Array<{id: string, name: string}>, assistantId: string}>}
 */
export async function importAssistantsFromProvider({ provider, providerApiKey, telnyxApiKey }) {
  // Validate provider
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }

  console.log(`\n🔄 Importing assistants from ${provider} into Telnyx...`);

  try {
    // Step 1: Create integration secret from provider API key
    const secretIdentifier = `${provider}_import_${Date.now()}`;
    const secret = await createIntegrationSecret({
      identifier: secretIdentifier,
      token: providerApiKey,
      telnyxApiKey
    });

    // Step 2: Import assistants using the secret reference
    console.log(`📥 Importing assistants using secret: ${secret.identifier}`);
    
    const importResponse = await fetch(TELNYX_IMPORT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: provider,
        api_key_ref: secret.identifier
      })
    });

    if (!importResponse.ok) {
      const errorText = await importResponse.text();
      throw new Error(`Telnyx import API failed with status ${importResponse.status}: ${errorText}`);
    }

    const importData = await importResponse.json();
    const assistants = importData.data || [];

    if (assistants.length === 0) {
      console.log(`⚠️  No assistants were imported from ${provider}`);
      return { assistants: [], assistantId: null };
    }

    console.log(`✅ Successfully imported ${assistants.length} assistant(s) from ${provider}`);
    assistants.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.name || 'Unnamed'} (ID: ${a.id})`);
    });

    // Step 3: Enable web calls for each assistant if not already enabled
    console.log(`\n🔧 Checking web call settings for imported assistants...`);
    
    for (const assistant of assistants) {
      const webCallsEnabled = assistant.telephony_settings?.supports_unauthenticated_web_calls;
      
      if (!webCallsEnabled) {
        await enableWebCalls({
          assistantId: assistant.id,
          telnyxApiKey
        });
      } else {
        console.log(`✓ Web calls already enabled for: ${assistant.id}`);
      }
    }

    return {
      assistants: assistants.map(a => ({ id: a.id, name: a.name })),
      assistantId: assistants[0]?.id
    };
  } catch (error) {
    console.error(`❌ Failed to import assistants from ${provider}:`, error.message);
    throw error;
  }
}

// Export supported providers for CLI validation
export { SUPPORTED_PROVIDERS };
