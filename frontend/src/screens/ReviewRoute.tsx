import { useParams, useSearchParams } from 'react-router-dom';
import { ReviewScreen } from './ReviewScreen';
import type { Repo, TabId } from '../data/types';

interface ReviewRouteProps {
  repos: Repo[];
  summary: string | null;
  onSel: (id: string) => void;
}

export function ReviewRoute({ repos, summary, onSel }: ReviewRouteProps) {
  const { repoId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as TabId | null) || 'ai';
  const setTab = (t: TabId) => setSearchParams({ tab: t }, { replace: true });
  return (
    <ReviewScreen
      repos={repos}
      sel={repoId || repos[0]?.id}
      onSel={onSel}
      tab={tab}
      setTab={setTab}
      summary={summary}
      showPanel
    />
  );
}
