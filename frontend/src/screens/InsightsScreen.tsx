import { Icon } from '../components/Icon';
import { RepoIcon } from '../components/RepoIcon';
import { scoreVar } from '../components/scoreVar';
import { grade } from '../data/api';
import type { Repo } from '../data/types';

interface InsightsScreenProps {
  repos: Repo[];
  openReview: (id: string) => void;
}

export function InsightsScreen({ repos, openReview }: InsightsScreenProps) {
  const cats: Record<string, { icon: string; vals: [Repo, number][] }> = {};
  repos.forEach((r) =>
    r.cats.forEach(([n, ic, s]) => {
      (cats[n] = cats[n] || { icon: ic, vals: [] }).vals.push([r, s]);
    }),
  );
  const rows = Object.entries(cats)
    .map(([n, { icon, vals }]) => {
      const avg = Math.round(vals.reduce((a, v) => a + v[1], 0) / vals.length);
      const best = vals.reduce((a, v) => (v[1] > a[1] ? v : a));
      const worst = vals.reduce((a, v) => (v[1] < a[1] ? v : a));
      return [n, icon, avg, best, worst] as [string, string, number, [Repo, number], [Repo, number]];
    })
    .sort((a, b) => b[2] - a[2]);

  const gapCount: Record<string, number> = {};
  repos.forEach((r) =>
    r.portfolio.checks.forEach(([l, d]) => {
      if (!d) gapCount[l] = (gapCount[l] || 0) + 1;
    }),
  );
  const common = Object.entries(gapCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <section className="apr-page">
      <div className="apr-ins-grid">
        <div className="card elev-sm apr-pad">
          <h6 className="apr-kicker" style={{ marginBottom: 'var(--space-3)' }}>
            Category averages
          </h6>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {rows.map(([n, ic, avg, best, worst], i) => (
              <div key={i} className="apr-cat" style={{ padding: 0 }}>
                <span className="apr-cat-ic">
                  <Icon n={ic} size={17} />
                </span>
                <div className="apr-cat-bd">
                  <div className="apr-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13 }}>{n}</span>
                    <span style={{ fontSize: 12 }}>
                      <b style={{ color: scoreVar(avg) }}>{avg}</b>
                      <span className="text-muted">/100 avg</span>
                    </span>
                  </div>
                  <div className="apr-bar">
                    <div style={{ width: avg + '%', background: scoreVar(avg) }} />
                  </div>
                  <div className="apr-row" style={{ justifyContent: 'space-between', fontSize: 11, marginTop: 3 }}>
                    <span className="text-muted">
                      Best: {best[0].name} · {best[1]}
                    </span>
                    <span className="text-muted">
                      Lowest: {worst[0].name} · {worst[1]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card elev-sm apr-pad">
          <h6 className="apr-kicker" style={{ marginBottom: 'var(--space-3)' }}>
            Common gaps
          </h6>
          <ul className="apr-ul">
            {common.map(([l, n], i) => (
              <li key={i} className="apr-li">
                <Icon n="warning" size={15} style={{ color: 'var(--apr-warn)', marginTop: 3 }} />
                <span style={{ flex: 1 }}>{l}</span>
                <span className="tag tag-neutral">
                  {n} repo{n > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)', marginBottom: 0 }}>
            Gaps counted from each repo's portfolio-readiness checklist.
          </p>
        </div>
      </div>
      <h6 className="apr-kicker">Repositories</h6>
      <div className="apr-ins-repos">
        {repos.map((r) => (
          <button key={r.id} className="card elev-sm apr-pad apr-ins-repo" onClick={() => openReview(r.id)}>
            <div className="apr-row" style={{ gap: 8 }}>
              <RepoIcon repo={r} size={26} />
              <b style={{ fontSize: 14 }}>{r.name}</b>
            </div>
            <div className="apr-row" style={{ gap: 6, marginTop: 'var(--space-2)' }}>
              <b style={{ fontSize: 22, color: scoreVar(r.score) }}>{r.score}</b>
              <span className="text-muted" style={{ fontSize: 12 }}>
                /100 · {grade(r.score)}
              </span>
            </div>
            <div className="apr-bar" style={{ marginTop: 6 }}>
              <div style={{ width: r.score + '%', background: scoreVar(r.score) }} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
