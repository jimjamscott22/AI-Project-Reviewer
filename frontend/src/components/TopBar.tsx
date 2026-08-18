import { Icon } from './Icon';
import { Chip } from './Chip';
import { APR_CONFIG } from '../data/api';
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
}

export function TopBar({ screen, go, theme, setTheme, rerun, running, generated, db, llm }: TopBarProps) {
  return (
    <header className="apr-top">
      {screen === 'reviews' ? (
        <button className="btn btn-ghost" style={{ color: 'inherit' }} onClick={() => go('dashboard')}>
          <Icon n="arrow-left" size={15} /> Back to reviews
        </button>
      ) : (
        <h5 style={{ margin: 0 }}>{TITLES[screen]}</h5>
      )}
      <span style={{ flex: 1 }} />
      <Chip ok={db} icon="database" label="mariadb @ pi" />
      <Chip ok={llm} icon="cpu" label={APR_CONFIG.llmModel + ' (local)'} />
      {screen === 'reviews' && (
        <span className="text-muted" style={{ fontSize: 13 }}>
          Review generated <b style={{ color: 'var(--color-text)', fontWeight: 500 }}>{generated}</b>
        </span>
      )}
      {screen === 'reviews' && (
        <button className="btn btn-secondary" onClick={rerun} disabled={running}>
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
