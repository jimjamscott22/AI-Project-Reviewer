import { Icon } from './Icon';
import type { Repo } from '../data/types';

interface RepoIconProps {
  repo: Repo;
  size?: number;
}

export function RepoIcon({ repo, size = 34 }: RepoIconProps) {
  return (
    <span
      className="apr-repoicon"
      style={{ width: size, height: size, background: `oklch(0.35 0.06 ${repo.hue})`, color: `oklch(0.87 0.07 ${repo.hue})` }}
    >
      <Icon n="code" size={size * 0.55} />
    </span>
  );
}
