import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ReviewScreen } from './ReviewScreen';
import type { Repo, TabId } from '../data/types';

interface ReviewRouteProps {
  repos: Repo[];
  summary: string | null;
  onSel: (id: string) => void;
  onAddRepo: () => void;
  onViewRepos: () => void;
  onViewInsights: () => void;
}

const VALID_TABS: TabId[] = ['ai', 'quality', 'structure', 'deps', 'security'];

export function ReviewRoute({ repos, summary, onSel, onAddRepo, onViewRepos, onViewInsights }: ReviewRouteProps) {
  const { repoId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = VALID_TABS.includes(tabParam as TabId) ? (tabParam as TabId) : 'ai';
  const setTab = (t: TabId) => setSearchParams({ tab: t }, { replace: true });

  useEffect(() => {
    if (tabParam && !VALID_TABS.includes(tabParam as TabId)) {
      setSearchParams({ tab: 'ai' }, { replace: true });
    }
  }, [setSearchParams, tabParam]);

  if (!repos.length) {
    return (
      <EmptyState
        icon="git-branch"
        title="No reviewed repositories"
        body="Connect a repository and run its first review before opening the review workspace."
        actionLabel="View repositories"
        onAction={onViewRepos}
      />
    );
  }

  const selectedRepo = repos.find((repo) => repo.id === repoId);
  if (!selectedRepo) {
    return (
      <EmptyState
        icon="warning"
        title="Review not found"
        body={`There is no reviewed repository named “${repoId ?? ''}”.`}
        actionLabel="Open latest review"
        onAction={() => onSel(repos[0].id)}
      />
    );
  }

  return (
    <ReviewScreen
      repos={repos}
      sel={selectedRepo.id}
      onSel={onSel}
      tab={tab}
      setTab={setTab}
      summary={summary}
      showPanel
      onAddRepo={onAddRepo}
      onViewRepos={onViewRepos}
      onViewInsights={onViewInsights}
    />
  );
}
