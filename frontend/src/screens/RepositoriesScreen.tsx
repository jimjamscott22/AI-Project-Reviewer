import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { connectRepository, enqueueReview, listRepositories } from '../data/api';
import type { RepositorySummary } from '../data/types';

const POLL_MS = 3000;
const GITHUB_URL_RE = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/i;

function isActive(job: RepositorySummary['latestJob']): boolean {
  return job?.status === 'queued' || job?.status === 'running';
}

function statusLabel(repo: RepositorySummary): { text: string; color: string } {
  const job = repo.latestJob;
  if (job?.status === 'queued') return { text: 'Queued', color: 'var(--color-accent)' };
  if (job?.status === 'running') return { text: 'Running…', color: 'var(--color-accent)' };
  if (job?.status === 'failed') return { text: 'Review failed', color: 'var(--apr-bad)' };
  if (repo.latestReviewId) return { text: 'Reviewed', color: 'var(--apr-good)' };
  return { text: 'Not yet reviewed', color: 'var(--color-neutral-400)' };
}

interface RepositoriesScreenProps {
  openReview: (id: string) => void;
  onRepositoriesChanged: () => void;
}

export function RepositoriesScreen({ openReview, onRepositoriesChanged }: RepositoriesScreenProps) {
  const [repos, setRepos] = useState<RepositorySummary[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [pending, setPending] = useState<Record<string, string>>({});
  const prevJobsRef = useRef<Record<string, string>>({});
  const onChangedRef = useRef(onRepositoriesChanged);
  onChangedRef.current = onRepositoriesChanged;

  async function refresh() {
    try {
      const list = await listRepositories();
      const prevJobs = prevJobsRef.current;
      const nextJobs: Record<string, string> = {};
      let finished = false;
      for (const repo of list) {
        nextJobs[repo.id] = repo.latestJob?.status ?? '';
        const wasActive = prevJobs[repo.id] === 'queued' || prevJobs[repo.id] === 'running';
        if (wasActive && !isActive(repo.latestJob)) finished = true;
      }
      prevJobsRef.current = nextJobs;
      setRepos(list);
      setLoadError('');
      if (finished) onChangedRef.current();
    } catch {
      setLoadError('Cannot load repositories. Check the API and database, then retry.');
    }
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      if (!active) return;
      await refresh();
      if (active) timer = setTimeout(() => void tick(), POLL_MS);
    }
    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!GITHUB_URL_RE.test(trimmed)) {
      setConnectError('Enter a public repository URL in the form https://github.com/owner/repository.');
      return;
    }
    setConnecting(true);
    setConnectError('');
    try {
      const created = await connectRepository(trimmed);
      setRepos((current) => [created, ...(current ?? []).filter((r) => r.id !== created.id)]);
      setUrl('');
      void runReview(created.id);
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Could not connect that repository.');
    } finally {
      setConnecting(false);
    }
  }

  async function runReview(id: string) {
    setPending((current) => ({ ...current, [id]: 'starting' }));
    try {
      const result = await enqueueReview(id);
      setRepos((current) =>
        (current ?? []).map((repo) => (repo.id === id ? { ...repo, latestJob: { id: result.jobId, status: result.status, error: null } } : repo)),
      );
      void refresh();
    } catch (error) {
      setPending((current) => ({ ...current, [id]: error instanceof Error ? error.message : 'Could not start the review.' }));
      return;
    }
    setPending((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  if (loadError && !repos) {
    return (
      <section className="apr-page">
        <div className="card elev-sm apr-pad">
          <p role="alert">{loadError}</p>
          <button className="btn btn-secondary" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      </section>
    );
  }
  if (!repos) {
    return (
      <section className="apr-page" role="status">
        <div className="card elev-sm apr-pad">Loading repositories…</div>
      </section>
    );
  }

  const list = repos.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) || r.url.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="apr-page">
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{ marginBottom: 'var(--space-3)' }}>
          Connect a repository
        </h6>
        <form onSubmit={(event) => void connect(event)} className="apr-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: '1 1 320px', minWidth: 0 }}
            placeholder="https://github.com/owner/repository"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={connecting}
            aria-label="Public GitHub repository URL"
          />
          <button className="btn btn-primary" type="submit" disabled={connecting || !url.trim()}>
            {connecting ? 'Connecting…' : 'Connect repository'}
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Only public GitHub repositories are supported. Nothing is executed from the repository; the reviewer only clones it and reads its files.
        </p>
        {connectError && (
          <p role="alert" style={{ color: 'var(--apr-bad)', fontSize: 13 }}>
            {connectError}
          </p>
        )}
      </div>

      <div className="card elev-sm apr-pad">
        <div className="apr-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h6 className="apr-kicker" style={{ margin: 0 }}>
            Connected repositories
          </h6>
          <div className="apr-search" style={{ maxWidth: 260 }}>
            <Icon n="magnifying-glass" size={14} />
            <input className="apr-search-in" placeholder="Search repositories…" value={q} onChange={(event) => setQ(event.target.value)} />
          </div>
        </div>
        {!repos.length ? (
          <p className="text-muted">No repositories connected yet. Add a public GitHub URL above to run its first review.</p>
        ) : !list.length ? (
          <p className="text-muted">No repositories match “{q}”.</p>
        ) : (
          <div className="apr-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Last reviewed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((repo) => {
                  const status = statusLabel(repo);
                  const busy = isActive(repo.latestJob) || pending[repo.id] === 'starting';
                  const pendingError = pending[repo.id] && pending[repo.id] !== 'starting' ? pending[repo.id] : '';
                  return (
                    <tr key={repo.id}>
                      <td>
                        <a href={repo.url} target="_blank" rel="noreferrer" className="apr-row" style={{ gap: 6, color: 'inherit', textDecoration: 'none' }}>
                          <Icon n="github-logo" size={16} style={{ opacity: 0.6 }} />
                          <b>{repo.name}</b>
                        </a>
                      </td>
                      <td>
                        <span className="apr-chip" title={repo.latestJob?.error?.message}>
                          <span className="apr-dot" style={{ background: status.color }} />
                          {status.text}
                        </span>
                      </td>
                      <td>{repo.latestScore ?? '—'}</td>
                      <td className="text-muted" style={{ fontSize: 13 }}>
                        {repo.latestReviewAt ? new Date(repo.latestReviewAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div className="apr-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          {repo.latestReviewId && (
                            <button className="btn btn-secondary apr-btn-sm" onClick={() => openReview(repo.id)}>
                              View review
                            </button>
                          )}
                          <button className="btn btn-secondary apr-btn-sm" disabled={busy} onClick={() => void runReview(repo.id)}>
                            <Icon n="arrows-clockwise" size={13} style={busy ? { animation: 'apr-spin 1s linear infinite' } : undefined} />{' '}
                            {repo.latestReviewId ? 'Re-run' : 'Run review'}
                          </button>
                        </div>
                        {pendingError && (
                          <p role="alert" style={{ color: 'var(--apr-bad)', fontSize: 12, margin: '4px 0 0', textAlign: 'right' }}>
                            {pendingError}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
