import { config } from '../config.js';
import type { ReviewerSettings, ReviewResult } from '../types.js';

export interface ValidatedNarrative {
  aiSummary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  portfolioBlurb: string;
  portfolioFooter: string;
}

export interface NarrativeResult {
  narrative: ValidatedNarrative;
  source: 'ollama' | 'template';
}

interface NarrativeOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxPromptBytes?: number;
  maxResponseBytes?: number;
}

class InvalidNarrativeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNarrativeError';
  }
}

class OllamaUnavailableError extends Error {
  constructor() {
    super('Ollama is unavailable.');
    this.name = 'OllamaUnavailableError';
  }
}

function templateNarrative(review: ReviewResult): ValidatedNarrative {
  return {
    aiSummary: review.aiSummary,
    strengths: review.strengths,
    improvements: review.improvements,
    nextSteps: review.nextSteps,
    portfolioBlurb: review.portfolio.blurb,
    portfolioFooter: review.portfolio.footer,
  };
}

function cleanText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string') throw new InvalidNarrativeError(`${field} must be a string.`);
  const withoutControls = [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127 ? ' ' : character;
  }).join('');
  const cleaned = withoutControls
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
  if (!cleaned) throw new InvalidNarrativeError(`${field} must not be empty.`);
  return cleaned;
}

function cleanList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new InvalidNarrativeError(`${field} must be a non-empty array.`);
  const cleaned = value.slice(0, 8).map((entry, index) => cleanText(entry, `${field}[${index}]`, 500));
  return [...new Set(cleaned)];
}

export function validateNarrative(value: unknown): ValidatedNarrative {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidNarrativeError('Narrative output must be a JSON object.');
  }
  const object = value as Record<string, unknown>;
  return {
    aiSummary: cleanText(object.aiSummary, 'aiSummary', 1_000),
    strengths: cleanList(object.strengths, 'strengths'),
    improvements: cleanList(object.improvements, 'improvements'),
    nextSteps: cleanList(object.nextSteps, 'nextSteps'),
    portfolioBlurb: cleanText(object.portfolioBlurb, 'portfolioBlurb', 1_000),
    portfolioFooter: cleanText(object.portfolioFooter, 'portfolioFooter', 500),
  };
}

function dependencyCounts(review: ReviewResult): Record<string, number> {
  const counts: Record<string, number> = { ok: 0, outdated: 0, major: 0, unknown: 0 };
  for (const dependency of review.dependencies) counts[dependency[3]] = (counts[dependency[3]] ?? 0) + 1;
  return counts;
}

function evidence(review: ReviewResult) {
  return {
    overallScore: review.overallScore,
    categories: review.categories.map(([name, , score]) => ({ name, score })),
    projectSummary: review.summary.map(([, label, value]) => ({ label, value })),
    deterministicStrengths: review.strengths.slice(0, 8),
    deterministicImprovements: review.improvements.slice(0, 8),
    deterministicNextSteps: review.nextSteps.slice(0, 8),
    qualityFindings: review.quality.findings.slice(0, 8).map(([severity, text]) => ({ severity, text: text.slice(0, 300) })),
    securityFindings: review.security.slice(0, 8).map(([severity, title]) => ({ severity, title: title.slice(0, 200) })),
    dependencyStatusCounts: dependencyCounts(review),
    portfolioChecks: review.portfolio.checks.map(([label, done]) => ({ label, done: Boolean(done) })),
  };
}

function promptFor(review: ReviewResult, correction: boolean, maximumBytes: number): string {
  const prompt = [
    'You are the local narrative editor for a deterministic software repository review.',
    'Use only the bounded evidence JSON below. Do not infer source code, vulnerabilities, test results, or facts not present.',
    'Return only one JSON object with exactly these fields: aiSummary (string), strengths (string[]), improvements (string[]), nextSteps (string[]), portfolioBlurb (string), portfolioFooter (string).',
    'Each array must contain 1-8 concise plain-text items. Do not emit Markdown, HTML, code fences, URLs, or secrets.',
    correction ? 'Your previous output was invalid. Correct the schema and return JSON only.' : '',
    JSON.stringify(evidence(review)),
  ].filter(Boolean).join('\n');
  if (new TextEncoder().encode(prompt).byteLength > maximumBytes) {
    throw new InvalidNarrativeError('The bounded narrative prompt exceeded its configured limit.');
  }
  return prompt;
}

async function readBounded(response: Response, maximumBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new InvalidNarrativeError('Ollama returned an empty response.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new InvalidNarrativeError('Ollama response exceeded the configured output limit.');
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function requestNarrative(
  review: ReviewResult,
  settings: ReviewerSettings,
  correction: boolean,
  options: Required<NarrativeOptions>,
): Promise<ValidatedNarrative> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchImpl(`${settings.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        model: settings.ollamaModel,
        stream: false,
        format: 'json',
        prompt: promptFor(review, correction, options.maxPromptBytes),
      }),
    });
    if (!response.ok) throw new OllamaUnavailableError();
    let envelope: unknown;
    try {
      envelope = JSON.parse(await readBounded(response, options.maxResponseBytes));
    } catch (error) {
      if (error instanceof InvalidNarrativeError) throw error;
      throw new InvalidNarrativeError('Ollama returned malformed response JSON.');
    }
    if (!envelope || typeof envelope !== 'object' || typeof (envelope as { response?: unknown }).response !== 'string') {
      throw new InvalidNarrativeError('Ollama response did not contain narrative JSON.');
    }
    let narrative: unknown;
    try {
      narrative = JSON.parse((envelope as { response: string }).response);
    } catch {
      throw new InvalidNarrativeError('Ollama narrative was not valid JSON.');
    }
    return validateNarrative(narrative);
  } catch (error) {
    if (error instanceof InvalidNarrativeError || error instanceof OllamaUnavailableError) throw error;
    throw new OllamaUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

export async function generateNarrative(
  scored: ReviewResult,
  settings: ReviewerSettings,
  supplied: NarrativeOptions = {},
): Promise<NarrativeResult> {
  const fallback = { narrative: templateNarrative(scored), source: 'template' as const };
  if (!settings.ollamaBaseUrl) return fallback;
  const options: Required<NarrativeOptions> = {
    fetchImpl: supplied.fetchImpl ?? fetch,
    timeoutMs: supplied.timeoutMs ?? config.ollama.timeoutMs,
    maxPromptBytes: supplied.maxPromptBytes ?? config.ollama.maxPromptBytes,
    maxResponseBytes: supplied.maxResponseBytes ?? config.ollama.maxResponseBytes,
  };
  try {
    return { narrative: await requestNarrative(scored, settings, false, options), source: 'ollama' };
  } catch (error) {
    if (!(error instanceof InvalidNarrativeError)) return fallback;
  }
  try {
    return { narrative: await requestNarrative(scored, settings, true, options), source: 'ollama' };
  } catch {
    return fallback;
  }
}

export function applyNarrative(review: ReviewResult, narrative: ValidatedNarrative): ReviewResult {
  return {
    ...review,
    aiSummary: narrative.aiSummary,
    strengths: narrative.strengths,
    improvements: narrative.improvements,
    nextSteps: narrative.nextSteps,
    portfolio: { ...review.portfolio, blurb: narrative.portfolioBlurb, footer: narrative.portfolioFooter },
  };
}

export async function probeOllama(
  settings: ReviewerSettings,
  supplied: Pick<NarrativeOptions, 'fetchImpl' | 'timeoutMs'> = {},
): Promise<boolean> {
  if (!settings.ollamaBaseUrl) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), supplied.timeoutMs ?? config.ollama.healthTimeoutMs);
  try {
    const response = await (supplied.fetchImpl ?? fetch)(`${settings.ollamaBaseUrl}/api/tags`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    await response.body?.cancel();
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
