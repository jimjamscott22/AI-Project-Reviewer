import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EmptyState } from './components/EmptyState';
import { Icon } from './components/Icon';
import { Dashboard } from './screens/Dashboard';
import { InsightsScreen } from './screens/InsightsScreen';
import { ReviewRoute } from './screens/ReviewRoute';
import { SettingsScreen } from './screens/SettingsScreen';
import { RepositoriesScreen } from './screens/RepositoriesScreen';
import { LoginScreen } from './screens/LoginScreen';
import { getSessionStatus, load, logout, ping, rerun as rerunApi } from './data/api';
import { APR_SAMPLE } from './data/sampleData';
import type { Repo, ScreenId, ReviewerSettings, RepoDataStatus } from './data/types';

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
  const [dataStatus, setDataStatus] = useState<RepoDataStatus>('live');
  const [db, setDb] = useState(false);
  const [llm, setLlm] = useState(false);
  const [llmModel, setLlmModel] = useState('Ollama');
  const [llmProvider, setLlmProvider] = useState('Ollama');
  const [running, setRunning] = useState(false);
  const [generated, setGenerated] = useState('2 hours ago');
  const [summary, setSummary] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('apr-theme', theme);
  }, [theme]);

  const refreshRepos = () => {
    load().then((r) => {
      setDataStatus(r.status);
      setRepos(r.repos);
    });
  };

  useEffect(() => {
    let active = true;
    getSessionStatus()
      .then((status) => {
        if (!active) return;
        setAuthRequired(status.authRequired);
        setUnlocked(!status.authRequired || status.authenticated);
      })
      .catch(() => {
        // The session check itself failing (API unreachable) shouldn't trap the
        // user behind a login wall; load()/ping() below will report the real error.
        if (active) setUnlocked(true);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    load()
      .then((r) => {
        if (!active) return;
        setDataStatus(r.status);
        setRepos(r.repos);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    ping().then((health) => {
      if (!active || !health) return;
      setDb(health.db);
      setLlm(health.inference?.reachable ?? health.ollama.reachable);
      setLlmModel(health.inference?.model ?? health.ollama.model);
      setLlmProvider(health.inference?.provider === 'lmstudio' ? 'LM Studio' : health.inference?.provider === 'disabled' ? 'Disabled' : 'Ollama');
    });
    return () => {
      active = false;
    };
  }, [unlocked]);

  const signOut = () => {
    void logout().catch(() => {});
    setUnlocked(false);
  };

  const settingsSaved = (settings: ReviewerSettings) => {
    setLlmProvider(settings.inferenceProvider === 'lmstudio' ? 'LM Studio' : settings.inferenceProvider === 'disabled' ? 'Disabled' : 'Ollama');
    setLlmModel(settings.inferenceProvider === 'lmstudio' ? settings.lmStudioModel : settings.inferenceProvider === 'ollama' ? settings.ollamaModel : 'Template summaries');
    setLlm(false);
    void ping().then(health => { if (health) setLlm(health.inference?.reachable ?? health.ollama.reachable); });
  };
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
    if (dataStatus === 'error') {
      return (
        <EmptyState
          icon="wifi-slash"
          title="Can't reach the review API"
          body="The review API is unreachable, so no review data can be shown. Check that the API and MariaDB service are running, then retry."
          actionLabel="Retry"
          onAction={refreshRepos}
        />
      );
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
        {dataStatus === 'demo' && (
          <div className="apr-data-notice" role="status">
            Demo mode is on — these are embedded sample reviews, not live data. Disable VITE_DEMO_MODE and connect the API to review real repositories.
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

  if (checkingSession) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Icon n="arrows-clockwise" size={28} style={{ animation: 'apr-spin 1s linear infinite', opacity: 0.6 }} />
      </div>
    );
  }

  if (authRequired && !unlocked) {
    return <LoginScreen onAuthenticated={() => setUnlocked(true)} />;
  }

  return (
    <div className="apr-app">
      <Sidebar screen={screen} go={go} authRequired={authRequired} onSignOut={signOut} />
      <div className="apr-body">
        <TopBar screen={screen} go={go} theme={theme} setTheme={setTheme} rerun={rerun} running={running} generated={generated} db={db} llm={llm} llmModel={llmModel} llmProvider={llmProvider} />
        <Routes>
          <Route path="/" element={withReviewData(<Dashboard repos={repos} openReview={openReview} />)} />
          <Route path="/repos" element={<RepositoriesScreen openReview={openReview} onRepositoriesChanged={refreshRepos} />} />
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
          <Route path="/settings" element={<SettingsScreen onSaved={settingsSaved} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
