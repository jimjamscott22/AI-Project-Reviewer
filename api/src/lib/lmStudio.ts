import { config } from '../config.js';
import { normalizeOllamaBaseUrl } from './ollamaSettings.js';

export interface LocalModel { id: string; name: string; loaded: boolean }
export class ModelDiscoveryError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}
export function lmStudioHeaders(): Record<string, string> {
  return { accept: 'application/json', ...(config.lmstudio.apiToken ? { authorization: `Bearer ${config.lmstudio.apiToken}` } : {}) };
}
export async function listLMStudioModels(baseUrl: string, fetchImpl: typeof fetch = fetch, timeoutMs = 3000): Promise<LocalModel[]> {
  const url = normalizeOllamaBaseUrl(baseUrl, '"lmStudioBaseUrl"');
  if (!url) throw new Error('"lmStudioBaseUrl" is required.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${url}/api/v1/models`, { signal: controller.signal, redirect: 'error', headers: lmStudioHeaders() });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new ModelDiscoveryError('model_authentication_failed', 'LM Studio rejected authentication. Check the server API token.');
      throw new ModelDiscoveryError('model_server_error', 'LM Studio could not list models. Check that its server supports /api/v1/models.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ModelDiscoveryError('invalid_model_response', 'LM Studio returned an empty response.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        throw new ModelDiscoveryError('invalid_model_response', 'LM Studio returned too much model data.');
      }
      chunks.push(value);
    }
    let payload: unknown;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ModelDiscoveryError('invalid_model_response', 'LM Studio returned invalid model data.'); }
    if (!payload || typeof payload !== 'object' || !('models' in payload) || !Array.isArray(payload.models)) throw new ModelDiscoveryError('invalid_model_response', 'LM Studio returned invalid model data.');
    const models = new Map<string, LocalModel>();
    for (const entry of payload.models) {
      const model: unknown = entry;
      if (!model || typeof model !== 'object' || !('type' in model) || (model.type !== 'llm' && model.type !== 'embedding')) throw new ModelDiscoveryError('invalid_model_response', 'LM Studio returned an invalid model entry.');
      if (model.type === 'embedding') continue;
      if (!('key' in model) || !('display_name' in model) || !('loaded_instances' in model) || typeof model.key !== 'string' || !model.key.trim() || model.key.length > 512 || Array.from(model.key).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || typeof model.display_name !== 'string' || !Array.isArray(model.loaded_instances)) throw new ModelDiscoveryError('invalid_model_response', 'LM Studio returned an invalid model entry.');
      models.set(model.key, { id: model.key, name: model.display_name, loaded: model.loaded_instances.length > 0 });
    }
    return [...models.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  } catch (error) {
    if (error instanceof ModelDiscoveryError) throw error;
    throw new ModelDiscoveryError(controller.signal.aborted ? 'model_server_timeout' : 'model_server_unreachable', controller.signal.aborted ? 'LM Studio took too long to respond. Try refreshing.' : 'Cannot reach LM Studio. Check the server URL and that its server is running.');
  } finally { clearTimeout(timer); }
}
