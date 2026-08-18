import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { SEV } from './severity';
import type { Severity } from '../data/types';

export function Finding({ sev, children }: { sev: Severity; children: ReactNode }) {
  const [c, ic] = SEV[sev] || SEV.info;
  return (
    <li className="apr-li">
      <Icon n={ic} size={15} style={{ color: c, marginTop: 3 }} />
      <span>{children}</span>
    </li>
  );
}
