import { useState } from 'react';
import { Icon } from './Icon';
import { RepoIcon } from './RepoIcon';
import type { Repo } from '../data/types';

interface RepoRailProps {
  repos: Repo[];
  sel: string;
  onSel: (id: string) => void;
  onAdd: () => void;
  onViewAll: () => void;
}

export function RepoRail({ repos, sel, onSel, onAdd, onViewAll }: RepoRailProps) {
  const [q, setQ] = useState('');
  const list = repos.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className="apr-rail">
      <div className="apr-rail-head">
        <h5 style={{ margin: 0 }}>Repositories</h5>
        <button className="btn btn-secondary apr-btn-sm" onClick={onAdd}>
          <Icon n="plus" size={13} /> Add Repo
        </button>
      </div>
      <div className="apr-search">
        <Icon n="magnifying-glass" size={14} />
        <input className="apr-search-in" placeholder="Search repositories…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="apr-rail-list">
        {list.map((r) => (
          <button key={r.id} className={'apr-repo' + (r.id === sel ? ' apr-repo-sel' : '')} onClick={() => onSel(r.id)}>
            <RepoIcon repo={r} />
            <span className="apr-repo-txt">
              <b>{r.name}</b>
              <small>Updated {r.updated}</small>
            </span>
            <Icon n="github-logo" size={17} style={{ opacity: 0.55 }} />
          </button>
        ))}
        {!list.length && (
          <p className="text-muted" style={{ fontSize: 13, padding: '8px 4px' }}>
            No repositories match.
          </p>
        )}
      </div>
      <button className="apr-rail-link" onClick={onViewAll}>
        View all repositories <Icon n="arrow-right" size={13} />
      </button>
    </aside>
  );
}
