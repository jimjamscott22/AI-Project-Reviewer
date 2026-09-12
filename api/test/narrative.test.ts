import assert from 'node:assert/strict';
import test from 'node:test';
import { applyNarrative, generateNarrative, validateNarrative } from '../src/review/narrative.js';
import type { ReviewerSettings, ReviewResult } from '../src/types.js';

const SETTINGS: ReviewerSettings = { ollamaBaseUrl: 'http://ollama.test:11434', ollamaModel: 'llama3.1' };
const REVIEW: ReviewResult = {
  overallScore: 72,
  aiSummary: 'Deterministic fallback summary.',
  summary: [['cube', 'Type', 'React + Vite', 'good']],
  categories: [['Documentation', 'book-open', 72]],
  strengths: ['Deterministic strength.'],
  improvements: ['Deterministic improvement.'],
  nextSteps: ['Deterministic next step.'],
  portfolio: { verdict: 'Good', blurb: 'Deterministic blurb.', checks: [['README', 1]], footer: 'Deterministic footer.' },
  quality: { metrics: [['Files', '10']], findings: [['warn', 'src/large.ts is large.']] },
  structure: ['src/private-source-file.ts'],
  dependencies: [['react', '18.0.0', '19.0.0', 'major']],
  security: [['high', 'Redacted credential pattern detected', 'Never send ghp_abcdefghijklmnopqrstuvwxyz1234567890 to Ollama.']],
  stats: { loc: 100, openIssues: 0, pullRequests: 0, contributors: 1, commits14d: 2 },
};

const VALID = {
  aiSummary: 'A concise local-model summary.',
  strengths: ['Clear project structure.'],
  improvements: ['Add broader tests.'],
  nextSteps: ['Create an integration suite.'],
  portfolioBlurb: 'A promising portfolio project.',
  portfolioFooter: 'Address the evidence gaps and rerun.',
};

function ollamaResponse(narrative: unknown): Response {
  return new Response(JSON.stringify({ response: JSON.stringify(narrative) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('uses valid Ollama JSON and sends bounded evidence without source or secret details', async () => {
  let requestBody = '';
  const result = await generateNarrative(REVIEW, SETTINGS, {
    fetchImpl: async (_input, init) => {
      requestBody = String(init?.body ?? '');
      return ollamaResponse(VALID);
    },
  });
  assert.equal(result.source, 'ollama');
  assert.equal(result.narrative.aiSummary, VALID.aiSummary);
  assert.doesNotMatch(requestBody, /private-source-file/);
  assert.doesNotMatch(requestBody, /ghp_abcdefghijklmnopqrstuvwxyz1234567890/);
  const applied = applyNarrative(REVIEW, result.narrative);
  assert.equal(applied.aiSummary, VALID.aiSummary);
  assert.equal(applied.overallScore, REVIEW.overallScore);
});

test('retries malformed narrative JSON once with a correction prompt', async () => {
  const prompts: string[] = [];
  const result = await generateNarrative(REVIEW, SETTINGS, {
    fetchImpl: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { prompt: string };
      prompts.push(body.prompt);
      return prompts.length === 1
        ? new Response(JSON.stringify({ response: '{not-json' }), { status: 200 })
        : ollamaResponse(VALID);
    },
  });
  assert.equal(result.source, 'ollama');
  assert.equal(prompts.length, 2);
  assert.doesNotMatch(prompts[0] ?? '', /previous output was invalid/i);
  assert.match(prompts[1] ?? '', /previous output was invalid/i);
});

test('falls back after two invalid narrative responses', async () => {
  let calls = 0;
  const result = await generateNarrative(REVIEW, SETTINGS, {
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ response: '{}' }), { status: 200 });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.source, 'template');
  assert.equal(result.narrative.aiSummary, REVIEW.aiSummary);
});

test('falls back without retry on timeout or HTTP failure', async () => {
  let timeoutCalls = 0;
  const timeout = await generateNarrative(REVIEW, SETTINGS, {
    timeoutMs: 20,
    fetchImpl: async (_input, init) => {
      timeoutCalls += 1;
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    },
  });
  assert.equal(timeoutCalls, 1);
  assert.equal(timeout.source, 'template');

  let httpCalls = 0;
  const http = await generateNarrative(REVIEW, SETTINGS, {
    fetchImpl: async () => {
      httpCalls += 1;
      return new Response('unavailable', { status: 503 });
    },
  });
  assert.equal(httpCalls, 1);
  assert.equal(http.source, 'template');
});

test('retries oversized output then falls back to the template', async () => {
  let calls = 0;
  const result = await generateNarrative(REVIEW, SETTINGS, {
    maxResponseBytes: 100,
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ response: 'x'.repeat(1_000) }), { status: 200 });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.source, 'template');
});

test('clamps list counts and lengths and strips HTML-like output', () => {
  const narrative = validateNarrative({
    ...VALID,
    aiSummary: '<script>alert(1)</script> ' + 'x'.repeat(2_000),
    strengths: Array.from({ length: 12 }, (_, index) => `<b>Strength ${index}</b>`),
  });
  assert.equal(narrative.aiSummary.length, 1_000);
  assert.doesNotMatch(narrative.aiSummary, /[<>]/);
  assert.equal(narrative.strengths.length, 8);
  assert.doesNotMatch(JSON.stringify(narrative), /<b>/);
});

test('an empty Ollama base URL disables calls and returns the complete template', async () => {
  let called = false;
  const result = await generateNarrative(REVIEW, { ...SETTINGS, ollamaBaseUrl: '' }, {
    fetchImpl: async () => {
      called = true;
      return ollamaResponse(VALID);
    },
  });
  assert.equal(called, false);
  assert.equal(result.source, 'template');
  assert.deepEqual(result.narrative.strengths, REVIEW.strengths);
});

test('LM Studio sends the selected model and validates structured output', async () => {
  const result = await generateNarrative(REVIEW, { ...SETTINGS, inferenceProvider: 'lmstudio', lmStudioBaseUrl: 'http://localhost:1234', lmStudioModel: 'vendor/chosen@q4' }, {
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://localhost:1234/v1/chat/completions');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'vendor/chosen@q4');
      assert.equal(body.response_format.type, 'json_schema');
      assert.equal(init?.redirect, 'error');
      assert.doesNotMatch(body.messages[0].content, /ghp_abcdefghijklmnopqrstuvwxyz1234567890/);
      return Response.json({ choices: [{ message: { content: JSON.stringify(VALID) } }] });
    },
  });
  assert.equal(result.source, 'lmstudio');
  assert.deepEqual(result.narrative, VALID);
});
test('LM Studio retries invalid output and falls back; disabled inference never fetches', async () => {
  let calls = 0;
  const result = await generateNarrative(REVIEW, { ...SETTINGS, inferenceProvider: 'lmstudio', lmStudioBaseUrl: 'http://localhost:1234', lmStudioModel: 'chosen' }, {
    fetchImpl: async () => { calls++; return Response.json({ choices: [{ message: { content: '{}' } }] }); },
  });
  assert.equal(calls, 2);
  assert.equal(result.source, 'template');
  const disabled = await generateNarrative(REVIEW, { ...SETTINGS, inferenceProvider: 'disabled' }, { fetchImpl: async () => { throw new Error('Must not fetch'); } });
  assert.equal(disabled.source, 'template');
});
