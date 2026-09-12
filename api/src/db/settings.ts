import type { RowDataPacket } from 'mysql2/promise';
import { config } from '../config.js';
import type { ReviewerSettings } from '../types.js';
import { pool } from './pool.js';

interface SettingRow extends RowDataPacket {
  setting_key: string;
  value: string;
}

const OLLAMA_BASE_URL = 'ollama_base_url';
const OLLAMA_MODEL = 'ollama_model';

export async function getReviewerSettings(): Promise<ReviewerSettings> {
  const [rows] = await pool.query<SettingRow[]>(
    'SELECT setting_key, value FROM app_settings WHERE setting_key IN (?, ?, ?, ?, ?)',
    [OLLAMA_BASE_URL, OLLAMA_MODEL, 'inference_provider', 'lmstudio_base_url', 'lmstudio_model'],
  );
  const values = new Map(rows.map((row) => [row.setting_key, row.value]));
  return {
    inferenceProvider: values.get('inference_provider') === 'lmstudio' ? 'lmstudio' : values.get('inference_provider') === 'disabled' ? 'disabled' : 'ollama',
    lmStudioBaseUrl: values.get('lmstudio_base_url') ?? config.lmstudio.baseUrl,
    lmStudioModel: values.get('lmstudio_model') ?? config.lmstudio.model,
    ollamaBaseUrl: values.get(OLLAMA_BASE_URL) ?? config.ollama.baseUrl,
    ollamaModel: values.get(OLLAMA_MODEL) ?? config.ollama.model,
  };
}

export async function saveReviewerSettings(settings: ReviewerSettings): Promise<ReviewerSettings> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const entries: [string, string][] = [[OLLAMA_BASE_URL, settings.ollamaBaseUrl], [OLLAMA_MODEL, settings.ollamaModel]];
    if (settings.inferenceProvider !== undefined) entries.push(['inference_provider', settings.inferenceProvider]);
    if (settings.lmStudioBaseUrl !== undefined) entries.push(['lmstudio_base_url', settings.lmStudioBaseUrl]);
    if (settings.lmStudioModel !== undefined) entries.push(['lmstudio_model', settings.lmStudioModel]);
    await connection.query(
      `INSERT INTO app_settings (setting_key, value) VALUES ${entries.map(() => '(?, ?)').join(', ')}
       ON DUPLICATE KEY UPDATE value = VALUES(value)`, entries.flat(),
    );
    await connection.commit();
    return settings;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
