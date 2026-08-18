import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './screens/Dashboard';
import { InsightsScreen } from './screens/InsightsScreen';
import { ReviewRoute } from './screens/ReviewRoute';
import { Stub } from './screens/Stub';
import { APR_CONFIG, load, ping, rerun as rerunApi } from './data/api';
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
  const [db, setDb] = useState(false);
  const [llm, setLlm] = useState(false);
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
    load().then((r) => {
      setDb(r.live);
      if (r.live) setRepos(r.repos);
    });
    ping(APR_CONFIG.llmBase).then(setLlm);
  }, []);

  const screen = screenForPath(location.pathname);
  const repoIdMatch = location.pathname.match(/^\/reviews\/([^/]+)/);
  const selRepoId = repoIdMatch ? decodeURIComponent(repoIdMatch[1]) : repos[0]?.id;

  const go = (s: ScreenId) => {
    if (s === 'dashboard') navigate('/');
    else if (s === 'reviews') navigate('/reviews/' + (selRepoId ?? repos[0]?.id ?? ''));
    else navigate('/' + s);
  };

  const openReview = (id: string) => {
    setSummary(null);
    navigate('/reviews/' + id);
  };

  const rerun = async () => {
    const repo = repos.find((r) => r.id === selRepoId);
    if (!repo) return;
    setRunning(true);
    const res = await rerunApi(repo);
    setSummary(res.summary);
    setLlm(res.live);
    setGenerated('just now');
    setRunning(false);
  };

  return (
    <div className="apr-app">
      <Sidebar screen={screen} go={go} />
      <div className="apr-body">
        <TopBar screen={screen} go={go} theme={theme} setTheme={setTheme} rerun={rerun} running={running} generated={generated} db={db} llm={llm} />
        <Routes>
          <Route path="/" element={<Dashboard repos={repos} openReview={openReview} />} />
          <Route path="/repos" element={<Stub label="Repositories" />} />
          <Route path="/reviews" element={<Navigate to={`/reviews/${repos[0]?.id ?? ''}`} replace />} />
          <Route path="/reviews/:repoId" element={<ReviewRoute repos={repos} summary={summary} onSel={openReview} />} />
          <Route path="/insights" element={<InsightsScreen repos={repos} openReview={openReview} />} />
          <Route path="/settings" element={<Stub label="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
