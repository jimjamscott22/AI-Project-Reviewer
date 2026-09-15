import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { load, ping, listRepositories } from './data/api';
import { APR_SAMPLE } from './data/sampleData';

vi.mock('./data/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/api')>();
  return {
    ...actual,
    load: vi.fn(),
    ping: vi.fn(),
    rerun: vi.fn(),
    listRepositories: vi.fn(),
  };
});

describe('App review-data boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(ping).mockResolvedValue(null);
    vi.mocked(listRepositories).mockResolvedValue([]);
  });

  it('moves from loading to a safe empty state and repository action', async () => {
    vi.mocked(load).mockResolvedValue({ status: 'live', repos: [] });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Loading reviews' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'No reviews yet' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'View repositories' }));
    expect(await screen.findByRole('heading', { name: 'Connect a repository' })).toBeVisible();
  });

  it('labels embedded sample reviews when demo mode is on', async () => {
    vi.mocked(load).mockResolvedValue({ status: 'demo', repos: APR_SAMPLE });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Demo mode is on'));
    expect(screen.getByRole('heading', { name: 'Recent reviews' })).toBeVisible();
  });

  it('shows an honest error, not fake data, when the API is unreachable and demo mode is off', async () => {
    vi.mocked(load).mockResolvedValue({ status: 'error', repos: [] });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: "Can't reach the review API" })).toBeVisible();
    expect(screen.queryByText(APR_SAMPLE[0].name)).not.toBeInTheDocument();
  });
});
