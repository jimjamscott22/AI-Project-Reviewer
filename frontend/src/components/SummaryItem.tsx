import { Icon } from './Icon';
import type { SummaryItemTuple } from '../data/types';

export function SummaryItem({ it }: { it: SummaryItemTuple }) {
  const [icon, label, value, tone] = it;
  const col = tone === 'good' ? 'var(--apr-good)' : tone === 'warn' ? 'var(--apr-warn)' : 'inherit';
  return (
    <div className="apr-sum-it">
      <Icon n={icon} size={17} style={{ color: col === 'inherit' ? 'var(--color-accent)' : col, marginTop: 2 }} />
      <div>
        <div className="apr-sum-l">{label}</div>
        <div className="apr-sum-v" style={{ color: col }}>
          {value}
        </div>
      </div>
    </div>
  );
}
