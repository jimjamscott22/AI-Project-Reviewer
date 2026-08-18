import { Icon } from '../Icon';
import { Finding } from '../Finding';
import type { Repo } from '../../data/types';

export function TabAI({ repo }: { repo: Repo }) {
  return (
    <div className="apr-ai-grid">
      <div className="card elev-sm apr-pad">
        <h5 className="apr-h5" style={{ color: 'var(--apr-good)' }}>
          <Icon n="seal-check" size={17} /> Strengths
        </h5>
        <ul className="apr-ul">
          {repo.strengths.map((s, i) => (
            <Finding key={i} sev="ok">
              {s}
            </Finding>
          ))}
        </ul>
        <h5 className="apr-h5" style={{ color: 'var(--apr-warn)', marginTop: 'var(--space-4)' }}>
          <Icon n="hammer" size={17} /> Needs Improvement
        </h5>
        <ul className="apr-ul">
          {repo.improves.map((s, i) => (
            <Finding key={i} sev="warn">
              {s}
            </Finding>
          ))}
        </ul>
        <h5 className="apr-h5" style={{ color: 'var(--color-accent)', marginTop: 'var(--space-4)' }}>
          <Icon n="footprints" size={17} /> Recommended Next Steps
        </h5>
        <ol className="apr-ul apr-ol">
          {repo.steps.map((s, i) => (
            <li key={i} className="apr-li">
              <span className="apr-num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="card elev-sm apr-pad apr-portfolio">
        <div className="apr-row" style={{ justifyContent: 'space-between' }}>
          <h5 className="apr-h5" style={{ color: 'var(--color-accent)' }}>
            <Icon n="star" size={17} /> Portfolio Readiness
          </h5>
          <span className="tag" style={{ background: 'var(--apr-good-800)', color: 'var(--apr-good-100)' }}>
            {repo.portfolio.verdict}
          </span>
        </div>
        <p style={{ fontSize: 13, opacity: 0.8 }}>{repo.portfolio.blurb}</p>
        <ul className="apr-ul">
          {repo.portfolio.checks.map(([l, done], i) => (
            <li key={i} className="apr-li" style={{ opacity: done ? 1 : 0.55 }}>
              <Icon
                n={done ? 'check-circle' : 'circle'}
                w={done ? 'fill' : null}
                size={16}
                style={{ color: done ? 'var(--apr-good)' : 'var(--color-neutral-600)', marginTop: 2 }}
              />
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 'auto', marginBottom: 0 }}>
          {repo.portfolio.footer}
        </p>
      </div>
    </div>
  );
}
