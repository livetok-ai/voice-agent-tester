/**
 * External Provider to Telnyx Assistant Import Module
 *
 * Imports assistants from external providers (vapi, elevenlabs, retell)
 * into Telnyx using the Telnyx AI Assistants Import API.
 */

const TELNYX_IMPORT_ENDPOINT = 'https://api.telnyx.com/v2/ai/assistants/import';

// Supported providers
const SUPPORTED_PROVIDERS = ['vapi', 'elevenlabs', 'retell'];

/**
 * Import assistants from an external provider into Telnyx.
 *
 * @param {Object} options - Import options
 * @param {string} options.provider - External provider name (vapi, elevenlabs, retell)
 * @param {string} options.apiKeyRef - Integration secret reference for the provider's API key
 * @param {string} options.telnyxApiKey - Telnyx API key for authentication
 * @returns {Promise<{assistants: Array<{id: string, name: string}>}>} - List of imported assistants
 */
export async function importAssistantsFromProvider({ provider, apiKeyRef, telnyxApiKey }) {
  // Validate provider
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }

  console.log(`🔄 Importing assistants from ${provider} into Telnyx...`);

  const requestBody = {
    provider: provider,
    api_key_ref: apiKeyRef
  };

  try {
    const response = await fetch(TELNYX_IMPORT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telnyx import API failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Extract assistants from response
    const assistants = data.data || [];

    if (assistants.length === 0) {
      console.log(`⚠️  No assistants were imported from ${provider}`);
      return { assistants: [] };
    }

    console.log(`✅ Successfully imported ${assistants.length} assistant(s) from ${provider}`);
    assistants.forEach((a, i) => {
      console.log(`   ${i + 1}. ${a.name || 'Unnamed'} (ID: ${a.id})`);
    });

    return {
      assistants: assistants.map(a => ({ id: a.id, name: a.name })),
      // Return first assistant ID for convenience
      assistantId: assistants[0]?.id
    };
  } catch (error) {
    console.error(`❌ Failed to import assistants from ${provider}:`, error.message);
    throw error;
  }
}

// Export supported providers for CLI validation
export { SUPPORTED_PROVIDERS };
