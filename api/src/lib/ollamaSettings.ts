import type { ReviewerSettings } from '../types.js';

function isLocalHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || !hostname.includes('.')) return true;
  if (hostname.includes(':') && (hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || /^fe[89ab]/.test(hostname))) return true;
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first = -1, second = -1] = octets;
  return first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function normalizeOllamaBaseUrl(value: string, label = '"ollamaBaseUrl"'): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > 2_048) throw new Error(`${label} must be 2048 characters or fewer.`);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be an absolute local HTTP or HTTPS URL, or empty to disable inference.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must be a credential-free HTTP or HTTPS URL without a query or fragment.`);
  }
  if (!isLocalHostname(parsed.hostname)) {
    throw new Error(`${label} must target localhost, a private/link-local IP, a .local host, or a single-label LAN/container host.`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

export function normalizeOllamaModel(value: string, label = '"ollamaModel"'): string {
  const model = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)) {
    throw new Error(`${label} must be 1-128 characters using letters, numbers, dot, underscore, colon, slash, or hyphen.`);
  }
  return model;
}

export function normalizeReviewerSettings(input: unknown): ReviewerSettings {
  if (!input || typeof input !== 'object') throw new Error('A settings object is required.');
  const body = input as Partial<ReviewerSettings>;
  if (typeof body.ollamaBaseUrl !== 'string') throw new Error('"ollamaBaseUrl" must be a string.');
  if (typeof body.ollamaModel !== 'string') throw new Error('"ollamaModel" must be a string.');
  const extra: Partial<ReviewerSettings> = {};
  if (body.inferenceProvider !== undefined) {
    if (!["ollama", "lmstudio", "disabled"].includes(body.inferenceProvider)) throw new Error('"inferenceProvider" is invalid.');
    extra.inferenceProvider = body.inferenceProvider;
  }
  if (body.lmStudioBaseUrl !== undefined) {
    if (typeof body.lmStudioBaseUrl !== "string") throw new Error('"lmStudioBaseUrl" must be a string.');
    extra.lmStudioBaseUrl = normalizeOllamaBaseUrl(body.lmStudioBaseUrl, '"lmStudioBaseUrl"');
  }
  if (body.lmStudioModel !== undefined) extra.lmStudioModel = normalizeLMStudioModel(body.lmStudioModel);
  if (extra.inferenceProvider === "lmstudio" && (!extra.lmStudioBaseUrl || !extra.lmStudioModel)) throw new Error('"lmStudioModel" and "lmStudioBaseUrl" are required to enable LM Studio.');
  return {
    ...extra,
    ollamaBaseUrl: normalizeOllamaBaseUrl(body.ollamaBaseUrl),
    ollamaModel: normalizeOllamaModel(body.ollamaModel),
  };
}

export function normalizeLMStudioModel(value: unknown): string {
  if (typeof value !== "string" || value.length > 512 || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error('"lmStudioModel" must be a model identifier of at most 512 characters.');
  return value.trim();
}
