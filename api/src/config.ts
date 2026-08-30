import 'dotenv/config';
import path from 'node:path';
import { normalizeOllamaBaseUrl, normalizeOllamaModel } from './lib/ollamaSettings.js';

function required(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

export const config = {
  port: Number(required('PORT', '8080')),
  corsOrigin: required('CORS_ORIGIN', 'http://localhost:5173'),
  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(required('DB_PORT', '3306')),
    user: required('DB_USER', 'apr'),
    password: required('DB_PASSWORD', 'apr'),
    database: required('DB_NAME', 'apr'),
  },
  review: {
    workRoot: path.resolve(required('REPO_WORK_ROOT', '.review-work')),
    cloneTimeoutMs: boundedInteger('REPO_CLONE_TIMEOUT_MS', 120_000, 1_000, 900_000),
    commandOutputBytes: boundedInteger('REPO_COMMAND_OUTPUT_BYTES', 65_536, 1_024, 1_048_576),
    analysisTimeoutMs: boundedInteger('ANALYSIS_TIMEOUT_MS', 120_000, 1_000, 900_000),
    maxFiles: boundedInteger('ANALYSIS_MAX_FILES', 5_000, 10, 100_000),
    maxTotalBytes: boundedInteger('ANALYSIS_MAX_TOTAL_BYTES', 25 * 1024 * 1024, 1_024, 1024 * 1024 * 1024),
    maxFileBytes: boundedInteger('ANALYSIS_MAX_FILE_BYTES', 256 * 1024, 256, 10 * 1024 * 1024),
    registryTimeoutMs: boundedInteger('REGISTRY_TIMEOUT_MS', 3_000, 250, 30_000),
    registryMaxPackages: boundedInteger('REGISTRY_MAX_PACKAGES', 30, 0, 200),
    workerPollMs: boundedInteger('WORKER_POLL_MS', 1_000, 100, 60_000),
    gitleaksPath: required('GITLEAKS_PATH', '').trim(),
  },
  ollama: {
    baseUrl: normalizeOllamaBaseUrl(required('OLLAMA_BASE_URL', 'http://localhost:11434'), 'OLLAMA_BASE_URL'),
    model: normalizeOllamaModel(required('OLLAMA_MODEL', 'llama3.1'), 'OLLAMA_MODEL'),
    timeoutMs: boundedInteger('OLLAMA_TIMEOUT_MS', 45_000, 500, 300_000),
    healthTimeoutMs: boundedInteger('OLLAMA_HEALTH_TIMEOUT_MS', 1_500, 100, 30_000),
    maxPromptBytes: boundedInteger('OLLAMA_MAX_PROMPT_BYTES', 12_288, 1_024, 131_072),
    maxResponseBytes: boundedInteger('OLLAMA_MAX_RESPONSE_BYTES', 65_536, 1_024, 1_048_576),
  },
};
