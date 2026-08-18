import type { Severity } from '../data/types';

export const SEV: Record<Severity, [string, string]> = {
  high: ['var(--apr-bad)', 'warning-octagon'],
  med: ['var(--apr-warn)', 'warning'],
  warn: ['var(--apr-warn)', 'warning'],
  info: ['var(--color-accent)', 'info'],
  ok: ['var(--apr-good)', 'check-circle'],
};
