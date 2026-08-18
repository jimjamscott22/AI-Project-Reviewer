import { Icon } from '../Icon';
import type { DependencyStatus, Repo } from '../../data/types';

const TONE: Record<DependencyStatus, [string, string]> = {
  ok: ['var(--apr-good)', 'Up to date'],
  outdated: ['var(--apr-warn)', 'Update available'],
  major: ['var(--apr-bad)', 'Major behind'],
};

export function TabDeps({ repo }: { repo: Repo }) {
  return (
    <div className="card elev-sm apr-pad">
      <table className="table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Installed</th>
            <th>Latest</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {repo.deps.map(([n, c, l, s], i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13 }}>{n}</td>
              <td>{c}</td>
              <td>{l}</td>
              <td style={{ color: TONE[s][0] }}>
                <Icon n={s === 'ok' ? 'check' : 'arrow-up'} size={13} /> {TONE[s][1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
