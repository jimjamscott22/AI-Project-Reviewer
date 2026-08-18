import type { Repo } from '../../data/types';

export function TabStructure({ repo }: { repo: Repo }) {
  return (
    <div className="card elev-sm apr-pad">
      <pre className="apr-tree">{repo.structure.join('\n')}</pre>
    </div>
  );
}
