import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoriesScreen } from './RepositoriesScreen';
import { connectRepository, enqueueReview, listRepositories } from '../data/api';
import type { RepositorySummary } from '../data/types';

vi.mock('../data/api', () => ({
  listRepositories: vi.fn(),
  connectRepository: vi.fn(),
  enqueueReview: vi.fn(),
}));

const reviewed: RepositorySummary = {
  id: 'octo/reviewed',
  name: 'reviewed',
  url: 'https://github.com/octo/reviewed',
  connectedAt: '2026-01-01T00:00:00.000Z',
  latestReviewId: 7,
  latestScore: 82,
  latestReviewAt: '2026-01-02T00:00:00.000Z',
  latestJob: { id: 'job-1', status: 'succeeded', error: null },
};

beforeEach(() => {
  vi.mocked(listRepositories).mockResolvedValue([reviewed]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RepositoriesScreen', () => {
  it('lists connected repositories and opens a reviewed one', async () => {
    const openReview = vi.fn();
    render(<RepositoriesScreen openReview={openReview} onRepositoriesChanged={vi.fn()} />);

    expect(await screen.findByText('reviewed')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'View review' }));
    expect(openReview).toHaveBeenCalledWith('octo/reviewed');
  });

  it('rejects a non-GitHub URL before calling the API', async () => {
    render(<RepositoriesScreen openReview={vi.fn()} onRepositoriesChanged={vi.fn()} />);
    await screen.findByText('reviewed');

    fireEvent.change(screen.getByLabelText('Public GitHub repository URL'), { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect repository' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('public repository URL');
    expect(connectRepository).not.toHaveBeenCalled();
  });

  it('connects a repository and immediately queues its first review', async () => {
    // Mirrors the real API: the backend is the source of truth, so once connected
    // and queued, a subsequent listRepositories() poll reflects both changes.
    const backend: RepositorySummary[] = [reviewed];
    vi.mocked(listRepositories).mockImplementation(() => Promise.resolve([...backend]));
    vi.mocked(connectRepository).mockImplementation((url) => {
      const created: RepositorySummary = {
        id: 'octo/new',
        name: 'new',
        url,
        connectedAt: '2026-01-03T00:00:00.000Z',
        latestReviewId: null,
        latestScore: null,
        latestReviewAt: null,
        latestJob: null,
      };
      backend.push(created);
      return Promise.resolve(created);
    });
    vi.mocked(enqueueReview).mockImplementation((id) => {
      const repo = backend.find((r) => r.id === id);
      if (repo) repo.latestJob = { id: 'job-2', status: 'queued', error: null };
      return Promise.resolve({ jobId: 'job-2', status: 'queued' as const });
    });

    render(<RepositoriesScreen openReview={vi.fn()} onRepositoriesChanged={vi.fn()} />);
    await screen.findByText('reviewed');

    fireEvent.change(screen.getByLabelText('Public GitHub repository URL'), { target: { value: 'https://github.com/octo/new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect repository' }));

    await waitFor(() => expect(connectRepository).toHaveBeenCalledWith('https://github.com/octo/new'));
    await waitFor(() => expect(enqueueReview).toHaveBeenCalledWith('octo/new'));
    expect(await screen.findByText('new')).toBeVisible();
    expect(screen.getByText('Queued')).toBeVisible();
  });
});
