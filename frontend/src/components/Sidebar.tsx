import { Icon } from './Icon';
import type { ScreenId } from '../data/types';

const NAV: [string, string, ScreenId][] = [
  ['house', 'Dashboard', 'dashboard'],
  ['git-branch', 'Repositories', 'repos'],
  ['list-checks', 'Reviews', 'reviews'],
  ['chart-line', 'Insights', 'insights'],
  ['gear', 'Settings', 'settings'],
];

interface SidebarProps {
  screen: ScreenId;
  go: (screen: ScreenId) => void;
  authRequired?: boolean;
  onSignOut?: () => void;
}

export function Sidebar({ screen, go, authRequired = false, onSignOut }: SidebarProps) {
  return (
    <aside className="apr-side">
      <div className="apr-brand">
        <span className="apr-brandmark">
          <Icon n="terminal-window" size={17} />
        </span>{' '}
        AI Project Reviewer
      </div>
      <nav className="apr-nav">
        {NAV.map(([ic, l, id]) => (
          <button key={id} className={'apr-nav-it' + (screen === id ? ' apr-nav-on' : '')} onClick={() => go(id)}>
            <Icon n={ic} size={18} w={screen === id ? 'fill' : null} /> {l}
          </button>
        ))}
      </nav>
      <div className="card apr-pad apr-protip">
        <h6 className="apr-kicker" style={{ color: 'var(--color-accent)' }}>
          <Icon n="sparkle" size={12} /> Pro Tip
        </h6>
        <p style={{ fontSize: 13, margin: '4px 0 var(--space-3)', opacity: 0.85 }}>
          Connect a repo to get automated reviews on new commits.
        </p>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => go('repos')}>
          <Icon n="github-logo" size={15} /> Connect GitHub
        </button>
      </div>
      <div className="apr-user">
        <span className="apr-avatar">
          <Icon n="robot" size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 13, display: 'block' }}>DevUser</b>
          <small className="text-muted" style={{ fontSize: 11 }}>
            developer@example.com
          </small>
        </div>
        {authRequired ? (
          <button className="btn btn-ghost btn-icon" title="Sign out" aria-label="Sign out" onClick={onSignOut} style={{ color: 'inherit' }}>
            <Icon n="sign-out" size={15} />
          </button>
        ) : (
          <Icon n="caret-down" size={13} style={{ opacity: 0.6 }} />
        )}
      </div>
    </aside>
  );
}
