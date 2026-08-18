import { Finding } from '../Finding';
import type { Repo } from '../../data/types';

export function TabQuality({ repo }: { repo: Repo }) {
  return (
    <div className="card elev-sm apr-pad">
      <div className="apr-metrics">
        {repo.quality.metrics.map(([l, v], i) => (
          <div key={i} className="apr-metric">
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h5 className="apr-h5" style={{ marginTop: 'var(--space-4)' }}>
        Findings
      </h5>
      <ul className="apr-ul">
        {repo.quality.findings.map(([sev, t], i) => (
          <Finding key={i} sev={sev}>
            {t}
          </Finding>
        ))}
      </ul>
    </div>
  );
}
