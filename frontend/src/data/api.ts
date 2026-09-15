import type { HealthStatus, Repo, ReviewerSettings, LocalModel, RepositorySummary, ReviewJobStatus, RepoDataStatus } from './types';
import { APR_SAMPLE } from './sampleData';

// The browser talks only to Fastify. Repository review and Ollama access remain
// behind that service boundary so local model ports are never exposed to UI code.
export const APR_CONFIG = {
  apiBase: import.meta.env.VITE_API_BASE ?? 'http://raspberrypi.local:8080', // REST API in front of MariaDB (e.g. GET /api/repos)
  // Sample data is opt-in: an unreachable production API must be shown as an
  // honest error, never silently masked with fake portfolio data.
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
};

export function grade(score: number): string {
  return score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'Needs work';
}

export async function ping(): Promise<HealthStatus | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(APR_CONFIG.apiBase + '/api/health', { signal: controller.signal, mode: 'cors' });
    return response.ok ? await response.json() as HealthStatus : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function load(): Promise<{ status: RepoDataStatus; repos: Repo[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const r = await fetch(APR_CONFIG.apiBase + '/api/repos', { signal: controller.signal });
    if (r.ok) return { status: 'live', repos: await r.json() };
  } catch {
    // fall through below
  } finally {
    clearTimeout(timer);
  }
  return APR_CONFIG.demoMode ? { status: 'demo', repos: APR_SAMPLE } : { status: 'error', repos: [] };
}

export async function rerun(repo: Repo): Promise<{ queued: boolean; summary: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${APR_CONFIG.apiBase}/api/repos/${encodeURIComponent(repo.id)}/rerun`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
    });
    if (response.ok) return { queued: true, summary: 'A persisted review has been queued. Its updated narrative will appear after the worker completes.' };
  } catch {
    // Return the existing persisted narrative with an honest queue failure.
  } finally {
    clearTimeout(timer);
  }
  return { queued: false, summary: repo.ai };
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(APR_CONFIG.apiBase + path, {
    ...options, signal: options.signal ?? AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'The API is unavailable. Try again.');
  }
  return response.json() as Promise<T>;
}
export const getSettings = () => apiRequest<ReviewerSettings>('/api/settings');
export const saveSettings = (settings: ReviewerSettings) => apiRequest<ReviewerSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
export const discoverModels = (lmStudioBaseUrl: string, signal: AbortSignal) => apiRequest<{ models: LocalModel[] }>('/api/settings/models', { method: 'POST', body: JSON.stringify({ lmStudioBaseUrl }), signal });

export const listRepositories = () => apiRequest<RepositorySummary[]>('/api/repositories');
export const connectRepository = (url: string) => apiRequest<RepositorySummary>('/api/repos', { method: 'POST', body: JSON.stringify({ url }) });
export const enqueueReview = (id: string) => apiRequest<{ jobId: string; status: ReviewJobStatus }>(`/api/repos/${encodeURIComponent(id)}/rerun`, { method: 'POST' });
