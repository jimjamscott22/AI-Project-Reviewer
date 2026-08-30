import type { HealthStatus, Repo } from './types';
import { APR_SAMPLE } from './sampleData';

// The browser talks only to Fastify. Repository review and Ollama access remain
// behind that service boundary so local model ports are never exposed to UI code.
export const APR_CONFIG = {
  apiBase: import.meta.env.VITE_API_BASE ?? 'http://raspberrypi.local:8080', // REST API in front of MariaDB (e.g. GET /api/repos)
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

export async function load(): Promise<{ live: boolean; repos: Repo[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const r = await fetch(APR_CONFIG.apiBase + '/api/repos', { signal: controller.signal });
    if (r.ok) return { live: true, repos: await r.json() };
  } catch {
    // fall through to sample data
  } finally {
    clearTimeout(timer);
  }
  return { live: false, repos: APR_SAMPLE };
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
