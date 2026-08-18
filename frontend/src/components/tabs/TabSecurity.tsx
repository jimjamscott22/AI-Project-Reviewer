import { Icon } from '../Icon';
import { SEV } from '../severity';
import type { Repo } from '../../data/types';

export function TabSecurity({ repo }: { repo: Repo }) {
  return (
    <div className="card elev-sm apr-pad">
      <ul className="apr-ul" style={{ gap: 'var(--space-3)' }}>
        {repo.security.map(([sev, t, d], i) => {
          const [c, ic] = SEV[sev];
          return (
            <li key={i} className="apr-li">
              <Icon n={ic} size={17} style={{ color: c, marginTop: 2 }} />
              <span>
                <b style={{ fontWeight: 500 }}>{t}</b>
                <br />
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {d}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
