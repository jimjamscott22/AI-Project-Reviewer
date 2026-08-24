import { Icon } from '../components/Icon';
import { RepoIcon } from '../components/RepoIcon';
import { scoreVar } from '../components/scoreVar';
import { grade } from '../data/api';
import type { Repo } from '../data/types';

interface DashboardProps {
  repos: Repo[];
  openReview: (id: string) => void;
}

export function Dashboard({ repos, openReview }: DashboardProps) {
  const avg = Math.round(repos.reduce((a, r) => a + r.score, 0) / repos.length);
  const gaps = repos.reduce((a, r) => a + r.portfolio.checks.filter((c) => !c[1]).length, 0);
  const worstCats: Record<string, { icon: string; total: number; n: number }> = {};
  repos.forEach((r) =>
    r.cats.forEach(([n, ic, s]) => {
      if (!worstCats[n]) worstCats[n] = { icon: ic, total: 0, n: 0 };
      worstCats[n].total += s;
      worstCats[n].n++;
    }),
  );
  const attention = Object.entries(worstCats)
    .map(([n, v]) => [n, v.icon, Math.round(v.total / v.n)] as [string, string, number])
    .sort((a, b) => a[2] - b[2])
    .slice(0, 3);

  const stats: [string, string, number | string][] = [
    ['git-branch', 'Repositories', repos.length],
    ['gauge', 'Average score', avg],
    ['sparkle', 'Reviews run', '12'],
    ['warning', 'Open gaps', gaps],
  ];

  return (
    <section className="apr-page">
      <div className="apr-stats">
        {stats.map(([ic, l, v], i) => (
          <div key={i} className="card elev-sm apr-pad apr-stat">
            <Icon n={ic} size={19} style={{ color: 'var(--color-accent)' }} />
            <b>{v}</b>
            <span className="text-muted">{l}</span>
          </div>
        ))}
      </div>
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{ marginBottom: 'var(--space-2)' }}>
          Recent reviews
        </h6>
        <div className="apr-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Top gap</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {[...repos]
                .sort((a, b) => b.score - a.score)
                .map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openReview(r.id)}>
                    <td>
                      <span className="apr-row" style={{ gap: 8 }}>
                        <RepoIcon repo={r} size={24} />
                        {r.name}
                      </span>
                    </td>
                    <td>
                      <b style={{ color: scoreVar(r.score) }}>{r.score}</b>
                      <span className="text-muted">/100</span>
                    </td>
                    <td>{grade(r.score)}</td>
                    <td className="text-muted" style={{ fontSize: 13 }}>
                      {r.portfolio.checks.find((c) => !c[1])?.[0] || '—'}
                    </td>
                    <td className="text-muted" style={{ fontSize: 13 }}>
                      {r.updated}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{ marginBottom: 'var(--space-3)' }}>
          Weakest categories across your repos
        </h6>
        <div className="apr-attn">
          {attention.map(([n, ic, s], i) => (
            <div key={i} className="apr-cat card">
              <span className="apr-cat-ic">
                <Icon n={ic} size={17} />
              </span>
              <div className="apr-cat-bd">
                <div className="apr-row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{n}</span>
                  <b style={{ color: scoreVar(s), fontSize: 13 }}>
                    {s}
                    <span className="text-muted" style={{ fontWeight: 400 }}>
                      {' '}
                      avg
                    </span>
                  </b>
                </div>
                <div className="apr-bar">
                  <div style={{ width: s + '%', background: scoreVar(s) }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
