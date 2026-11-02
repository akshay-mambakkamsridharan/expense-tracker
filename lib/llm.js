import { buildMessages, parseSuggestions } from './suggestions.js';

// Both providers speak the OpenAI Chat Completions format, so switching
// between a local Ollama model and OpenAI is configuration, not code.
const PROVIDERS = {
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2:3b', needsKey: false },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', needsKey: true },
};

export class MissingApiKeyError extends Error {}

// An AI failure the user can fix themselves (bad key, no credits, model not downloaded, ...).
export class LLMSetupError extends Error {}

export function resolveProvider(env = process.env) {
  const name = (env.AI_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'ollama')).toLowerCase();
  const defaults = PROVIDERS[name];
  if (!defaults) throw new LLMSetupError(`Unknown AI_PROVIDER "${name}". Use "ollama" or "openai".`);
  const prefix = name.toUpperCase();
  return {
    name,
    baseUrl: (env[`${prefix}_BASE_URL`] || defaults.baseUrl).replace(/\/$/, ''),
    model: env[`${prefix}_MODEL`] || defaults.model,
    apiKey: defaults.needsKey ? env.OPENAI_API_KEY : undefined,
    needsKey: defaults.needsKey,
  };
}

function setupErrorMessage(provider, status, detail) {
  if (provider.name === 'ollama' && status === 404) {
    return `The model "${provider.model}" isn't downloaded. Run: ollama pull ${provider.model}`;
  }
  if (status === 401) return 'OpenAI rejected the API key. Check OPENAI_API_KEY in .env.local.';
  if (status === 429 && detail.includes('insufficient_quota')) {
    return 'Your OpenAI account has no credits left. Add credits, or set AI_PROVIDER=ollama in .env.local to use a free local model.';
  }
  if (status === 429) return 'The AI provider is rate-limiting requests. Wait a minute and try again.';
  return null;
}

export async function fetchSuggestions(profile, env = process.env) {
  const provider = resolveProvider(env);
  if (provider.needsKey && !provider.apiKey) {
    throw new MissingApiKeyError('Add OPENAI_API_KEY to .env.local, or set AI_PROVIDER=ollama to use a free local model.');
  }

  let res;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(provider.apiKey && { Authorization: `Bearer ${provider.apiKey}` }) },
      body: JSON.stringify({ model: provider.model, messages: buildMessages(profile), response_format: { type: 'json_object' } }),
      // Local models on a laptop can take a while on the first request.
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    if (provider.name === 'ollama' && err.name !== 'TimeoutError') {
      throw new LLMSetupError("Can't reach Ollama. Start it with: brew services start ollama");
    }
    throw err;
  }

  if (!res.ok) {
    const detail = await res.text();
    const setupMessage = setupErrorMessage(provider, res.status, detail);
    if (setupMessage) throw new LLMSetupError(setupMessage);
    throw new Error(`${provider.name} request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${provider.name} response had no content.`);
  return parseSuggestions(content, profile);
}
