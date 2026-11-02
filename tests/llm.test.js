import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LLMSetupError, resolveProvider } from '../lib/llm.js';

test('resolveProvider defaults to free local Ollama when no OpenAI key is set', () => {
  const p = resolveProvider({});
  assert.equal(p.name, 'ollama');
  assert.equal(p.baseUrl, 'http://localhost:11434/v1');
  assert.equal(p.model, 'llama3.2:3b');
  assert.equal(p.needsKey, false);
});

test('resolveProvider uses OpenAI when a key is present and no provider is chosen', () => {
  const p = resolveProvider({ OPENAI_API_KEY: 'sk-test' });
  assert.equal(p.name, 'openai');
  assert.equal(p.apiKey, 'sk-test');
});

test('AI_PROVIDER overrides the default, and per-provider settings apply', () => {
  const p = resolveProvider({ AI_PROVIDER: 'Ollama', OPENAI_API_KEY: 'sk-test', OLLAMA_MODEL: 'qwen2.5:7b', OLLAMA_BASE_URL: 'http://gpu-box:11434/v1/' });
  assert.equal(p.name, 'ollama');
  assert.equal(p.model, 'qwen2.5:7b');
  assert.equal(p.baseUrl, 'http://gpu-box:11434/v1');
  assert.equal(p.apiKey, undefined, 'never send the OpenAI key to another provider');
});

test('resolveProvider rejects unknown providers', () => {
  assert.throws(() => resolveProvider({ AI_PROVIDER: 'gemini' }), LLMSetupError);
});
