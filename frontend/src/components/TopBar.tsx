import { Icon } from './Icon';
import { Chip } from './Chip';
import type { ScreenId } from '../data/types';

const TITLES: Partial<Record<ScreenId, string>> = { dashboard: 'Dashboard', repos: 'Repositories', insights: 'Insights', settings: 'Settings' };

interface TopBarProps {
  screen: ScreenId;
  go: (screen: ScreenId) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  rerun: () => void;
  running: boolean;
  generated: string;
  db: boolean;
  llm: boolean;
  llmModel: string;
  llmProvider?: string;
}

export function TopBar({ screen, go, theme, setTheme, rerun, running, generated, db, llm, llmModel, llmProvider = 'Ollama' }: TopBarProps) {
  return (
    <header className="apr-top">
      {screen === 'reviews' ? (
        <button className="btn btn-ghost" style={{ color: 'inherit' }} onClick={() => go('dashboard')}>
          <Icon n="arrow-left" size={15} /> Back to dashboard
        </button>
      ) : (
        <h5 style={{ margin: 0 }}>{TITLES[screen]}</h5>
      )}
      <span className="apr-top-spacer" />
      <Chip ok={db} icon="database" label="mariadb @ pi" offlineLabel="MariaDB is unreachable; embedded demo reviews are displayed." />
      <Chip ok={llm} icon="cpu" label={`${llmProvider}: ${llmModel || 'Template summaries'}`} offlineLabel={`${llmProvider}: ${llmModel || 'Template summaries'} — unavailable or disabled; review summaries use API fallback text.`} />
      {screen === 'reviews' && (
        <span className="text-muted apr-generated" style={{ fontSize: 13 }}>
          Review generated <b style={{ color: 'var(--color-text)', fontWeight: 500 }}>{generated}</b>
        </span>
      )}
      {screen === 'reviews' && (
        <button className="btn btn-secondary apr-review-action" onClick={rerun} disabled={running}>
          <Icon n="arrows-clockwise" size={15} style={running ? { animation: 'apr-spin 1s linear infinite' } : undefined} />{' '}
          {running ? 'Reviewing…' : 'Re-run Review'}
        </button>
      )}
      <button className="btn btn-secondary btn-icon" title="Toggle light/dark" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        <Icon n={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>
    </header>
  );
}
