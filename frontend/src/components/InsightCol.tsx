import { Icon } from './Icon';
import { scoreVar } from './scoreVar';
import type { Repo } from '../data/types';

export function InsightCol({ repo }: { repo: Repo }) {
  return (
    <aside className="apr-insights">
      <div className="apr-row" style={{ justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: 19 }}>Insights</h4>
        <Icon n="trend-up" size={17} style={{ color: 'var(--color-accent)' }} />
      </div>
      <h6 className="apr-kicker">Category Scores</h6>
      <div className="apr-cats">
        {repo.cats.map(([name, icon, s], i) => (
          <div key={i} className="card apr-cat">
            <span className="apr-cat-ic">
              <Icon n={icon} size={17} />
            </span>
            <div className="apr-cat-bd">
              <div className="apr-row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>{name}</span>
                <span style={{ fontSize: 12 }}>
                  <b style={{ color: scoreVar(s) }}>{s}</b>
                  <span className="text-muted">/100</span>
                </span>
              </div>
              <div className="apr-bar">
                <div style={{ width: s + '%', background: scoreVar(s) }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <h6 className="apr-kicker">Repository Insights</h6>
      <div className="card apr-pad apr-kv">
        {(
          [
            ['Primary Language', repo.lang, 'var(--color-accent)'],
            ['Framework', repo.framework, ''],
            ['Lines of Code', repo.loc, ''],
            ['Open Issues', repo.issues, repo.issues > 3 ? 'var(--apr-warn)' : ''],
            ['Pull Requests', repo.prs, ''],
            ['Contributors', repo.contributors, ''],
          ] as [string, string | number, string][]
        ).map(([l, v, c], i) => (
          <div key={i} className="apr-kv-row">
            <span className="text-muted">{l}</span>
            <b style={{ color: c || 'inherit', fontWeight: 500 }}>{v}</b>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-block">
        View full insights <Icon n="arrow-right" size={14} />
      </button>
    </aside>
  );
}
