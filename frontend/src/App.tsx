import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EmptyState } from './components/EmptyState';
import { Dashboard } from './screens/Dashboard';
import { InsightsScreen } from './screens/InsightsScreen';
import { ReviewRoute } from './screens/ReviewRoute';
import { Stub } from './screens/Stub';
import { load, ping, rerun as rerunApi } from './data/api';
import { APR_SAMPLE } from './data/sampleData';
import type { Repo, ScreenId } from './data/types';

function screenForPath(pathname: string): ScreenId {
  if (pathname.startsWith('/reviews')) return 'reviews';
  if (pathname.startsWith('/insights')) return 'insights';
  if (pathname.startsWith('/repos')) return 'repos';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('apr-theme') as 'dark' | 'light') || 'dark');
  const [repos, setRepos] = useState<Repo[]>(APR_SAMPLE);
  const [loading, setLoading] = useState(true);
  const [db, setDb] = useState(false);
  const [llm, setLlm] = useState(false);
  const [llmModel, setLlmModel] = useState('Ollama');
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState('2 hours ago');
  const [summary, setSummary] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('apr-theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    load()
      .then((r) => {
        if (!active) return;
        setDb(r.live);
        setRepos(r.repos);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    ping().then((health) => {
      if (!active || !health) return;
      setDb(health.db);
      setLlm(health.ollama.reachable);
      setLlmModel(health.ollama.model);
    });
    return () => {
      active = false;
    };
  }, []);

  const screen = screenForPath(location.pathname);
  const repoIdMatch = location.pathname.match(/^\/reviews\/([^/]+)/);
  const selRepoId = repoIdMatch ? decodeURIComponent(repoIdMatch[1]) : repos[0]?.id;

  const go = (s: ScreenId) => {
    if (s === 'dashboard') navigate('/');
    else if (s === 'reviews') {
      const reviewId = selRepoId ?? repos[0]?.id;
      navigate(reviewId ? '/reviews/' + encodeURIComponent(reviewId) : '/repos');
    }
    else navigate('/' + s);
  };

  const openReview = (id: string) => {
    setSummary(null);
    navigate('/reviews/' + encodeURIComponent(id));
  };

  const withReviewData = (content: ReactNode) => {
    if (loading) {
      return <EmptyState icon="arrows-clockwise" title="Loading reviews" body="Checking the local review API…" busy />;
    }
    if (!repos.length) {
      return (
        <EmptyState
          icon="git-branch"
          title="No reviews yet"
          body="Connect a repository and run its first review to populate this workspace."
          actionLabel="View repositories"
          onAction={() => go('repos')}
        />
      );
    }
    return (
      <>
        {!db && (
          <div className="apr-data-notice" role="status">
            Embedded demo reviews are shown because the local MariaDB API is unavailable.
          </div>
        )}
        {content}
      </>
    );
  };

  const rerun = async () => {
    const repo = repos.find((r) => r.id === selRepoId);
    if (!repo) return;
    setRunning(true);
    const res = await rerunApi(repo);
    setSummary(res.summary);
    if (res.queued) setGenerated('queued just now');
    setRunning(false);
  };

  return (
    <div className="apr-app">
      <Sidebar screen={screen} go={go} />
      <div className="apr-body">
        <TopBar screen={screen} go={go} theme={theme} setTheme={setTheme} rerun={rerun} running={running} generated={generated} db={db} llm={llm} llmModel={llmModel} />
        <Routes>
          <Route path="/" element={withReviewData(<Dashboard repos={repos} openReview={openReview} />)} />
          <Route path="/repos" element={<Stub label="Repositories" />} />
          <Route
            path="/reviews"
            element={
              loading ? (
                <EmptyState icon="arrows-clockwise" title="Loading reviews" body="Checking the local review API…" busy />
              ) : repos[0] ? (
                <Navigate to={`/reviews/${encodeURIComponent(repos[0].id)}`} replace />
              ) : (
                <Navigate to="/repos" replace />
              )
            }
          />
          <Route
            path="/reviews/:repoId"
            element={withReviewData(
              <ReviewRoute
                repos={repos}
                summary={summary}
                onSel={openReview}
                onAddRepo={() => go('repos')}
                onViewRepos={() => go('repos')}
                onViewInsights={() => go('insights')}
              />,
            )}
          />
          <Route path="/insights" element={withReviewData(<InsightsScreen repos={repos} openReview={openReview} />)} />
          <Route path="/settings" element={<Stub label="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
