import { scoreVar } from './scoreVar';
import { grade } from '../data/api';

interface RingProps {
  score: number;
  size?: number;
}

export function Ring({ score, size = 118 }: RingProps) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const col = scoreVar(score);
  return (
    <div className="apr-ring" style={{ width: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-divider)" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .8s ease' }}
        />
      </svg>
      <div className="apr-ring-label">
        <b>{score}</b>
        <span>/100</span>
      </div>
      <div className="apr-ring-grade" style={{ color: col }}>
        {grade(score)}
      </div>
    </div>
  );
}
