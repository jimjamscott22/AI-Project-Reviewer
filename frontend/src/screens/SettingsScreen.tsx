import { useEffect, useState } from 'react';
import { discoverModels, getSettings, saveSettings } from '../data/api';
import type { LocalModel, ReviewerSettings } from '../data/types';

export function SettingsScreen({ onSaved }: { onSaved: (settings: ReviewerSettings) => void }) {
  const [settings, setSettings] = useState<ReviewerSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [modelError, setModelError] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    getSettings().then(value => { if (active) { setSettings(value); setLoadError(''); } })
      .catch(() => { if (active) setLoadError('Cannot load settings. Check the API and database, then retry.'); });
    return () => { active = false; };
  }, [reload]);
  const provider = settings?.inferenceProvider;
  const baseUrl = settings?.lmStudioBaseUrl;
  useEffect(() => {
    if (provider !== 'lmstudio') return;
    const controller = new AbortController();
    setModels([]);
    setModelError('');
    if (!baseUrl?.trim()) { setLoadingModels(false); return; }
    setLoadingModels(true);
    discoverModels(baseUrl, controller.signal).then(result => {
      if (!controller.signal.aborted) setModels(result.models);
    }).catch(error => {
      if (!controller.signal.aborted) setModelError(error instanceof Error ? error.message : 'Cannot fetch models.');
    }).finally(() => { if (!controller.signal.aborted) setLoadingModels(false); });
    return () => controller.abort();
  }, [provider, baseUrl, refresh]);
  function update(patch: Partial<ReviewerSettings>) {
    setSettings(current => current ? { ...current, ...patch } : current);
    setSaved(false);
    setSaveError('');
  }
  async function save() {
    if (!settings) return;
    setSaving(true); setSaveError(''); setSaved(false);
    try {
      const result = await saveSettings(settings);
      setSettings(result); setSaved(true); onSaved(result);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setSaving(false); }
  }
  if (loadError) return <section className="apr-settings"><p role="alert">{loadError}</p><button className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Retry</button></section>;
  if (!settings) return <section className="apr-settings" role="status">Loading settings…</section>;
  const missingModel = settings.lmStudioModel && !models.some(model => model.id === settings.lmStudioModel);
  return <section className="apr-settings">
    <h2>Local inference</h2>
    <p className="text-muted">Choose the model used to write review summaries. Saved settings apply when the next review starts.</p>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={saving}>
        <label htmlFor="inference-provider">Provider</label>
        <select id="inference-provider" value={settings.inferenceProvider} onChange={event => {
          const value = event.target.value;
          if (value === 'ollama' || value === 'lmstudio' || value === 'disabled') update({ inferenceProvider: value });
        }}>
          <option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option><option value="disabled">Disabled — template summaries</option>
        </select>
        {provider === 'ollama' && <>
          <label htmlFor="ollama-url">Ollama server URL</label>
          <input id="ollama-url" type="url" value={settings.ollamaBaseUrl} onChange={event => update({ ollamaBaseUrl: event.target.value })} />
          <label htmlFor="ollama-model">Ollama model</label>
          <input id="ollama-model" required value={settings.ollamaModel} onChange={event => update({ ollamaModel: event.target.value })} />
        </>}
        {provider === 'lmstudio' && <>
          <label htmlFor="lmstudio-url">LM Studio server URL</label>
          <input id="lmstudio-url" type="url" required aria-describedby="server-help" value={settings.lmStudioBaseUrl} onChange={event => update({ lmStudioBaseUrl: event.target.value })} />
          <p id="server-help" className="text-muted">Use the server address reachable from the review API. For LM Studio on another machine, enter its LAN address.</p>
          <label htmlFor="lmstudio-model">LM Studio model</label>
          <select id="lmstudio-model" required value={settings.lmStudioModel} onChange={event => update({ lmStudioModel: event.target.value })} aria-describedby="model-help">
            <option value="">Select a model</option>
            {missingModel && <option value={settings.lmStudioModel}>{settings.lmStudioModel} — {loadingModels ? 'checking availability' : 'not in current list'}</option>}
            {models.map(model => <option key={model.id} value={model.id}>{model.name} · {model.id} — {model.loaded ? 'loaded' : 'not loaded'}</option>)}
          </select>
          <button type="button" className="btn btn-secondary" disabled={loadingModels || !baseUrl?.trim()} onClick={() => setRefresh(value => value + 1)}>Refresh models</button>
          {loadingModels && <p role="status">Loading models…</p>}
          {modelError && <p role="alert">{modelError}</p>}
          {!loadingModels && !modelError && baseUrl?.trim() && models.length === 0 && <p role="status">No text-generation models found. Download a model in LM Studio, then refresh.</p>}
          <p id="model-help" className="text-muted">Unloaded models need just-in-time loading enabled in LM Studio, or must be loaded there manually. Refreshing does not load or download models.</p>
        </>}
        {provider === 'disabled' && <p>Reviews use deterministic template summaries without contacting a model server.</p>}
        <button className="btn btn-primary" type="submit" disabled={provider === 'lmstudio' && (!settings.lmStudioModel || !settings.lmStudioBaseUrl.trim())}>{saving ? 'Saving…' : 'Save settings'}</button>
      </fieldset>
      {saveError && <p role="alert">{saveError}</p>}
      {saved && <p role="status">Settings saved. The next review will use this selection.</p>}
    </form>
  </section>;
}
