import type { Repo } from './types';
import { APR_SAMPLE } from './sampleData';

// Backend plan: MariaDB on the Raspberry Pi behind a small REST API, plus a local
// LLM (Ollama) for review generation. Until that API is live, every call below
// falls back to the embedded sample data so the UI works standalone in dev mode.
export const APR_CONFIG = {
  apiBase: import.meta.env.VITE_API_BASE ?? 'http://raspberrypi.local:8080', // REST API in front of MariaDB (e.g. GET /api/repos)
  llmBase: import.meta.env.VITE_LLM_BASE ?? 'http://raspberrypi.local:11434', // Ollama
  llmModel: import.meta.env.VITE_LLM_MODEL ?? 'llama3.1',
};

export function grade(score: number): string {
  return score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'Needs work';
}

export async function ping(url: string): Promise<boolean> {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 1500);
    const r = await fetch(url, { signal: c.signal, mode: 'cors' });
    return r.ok;
  } catch {
    return false;
  }
}

export async function load(): Promise<{ live: boolean; repos: Repo[] }> {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 1500);
    const r = await fetch(APR_CONFIG.apiBase + '/api/repos', { signal: c.signal });
    if (r.ok) return { live: true, repos: await r.json() };
  } catch {
    // fall through to sample data
  }
  return { live: false, repos: APR_SAMPLE };
}

export async function rerun(repo: Repo): Promise<{ live: boolean; summary: string }> {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 8000);
    const r = await fetch(APR_CONFIG.llmBase + '/api/generate', {
      method: 'POST',
      signal: c.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: APR_CONFIG.llmModel,
        stream: false,
        prompt: 'In 2 sentences, summarize this code review: ' + JSON.stringify({ name: repo.name, scores: repo.cats, gaps: repo.improves }),
      }),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.response) return { live: true, summary: j.response.trim() };
    }
  } catch {
    // fall through to simulated response
  }
  await new Promise((res) => setTimeout(res, 1400));
  return { live: false, summary: repo.ai };
}
