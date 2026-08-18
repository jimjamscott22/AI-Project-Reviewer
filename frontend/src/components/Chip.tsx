import { Icon } from './Icon';

interface ChipProps {
  ok: boolean;
  icon: string;
  label: string;
}

export function Chip({ ok, icon, label }: ChipProps) {
  return (
    <span className="apr-chip" title={ok ? 'Connected' : 'Endpoint unreachable — using sample data.'}>
      <span className="apr-dot" style={{ background: ok ? 'var(--apr-good)' : 'var(--apr-warn)' }} />
      <Icon n={icon} size={13} /> {label}
    </span>
  );
}
