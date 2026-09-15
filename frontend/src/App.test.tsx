import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { getSessionStatus, load, login, logout, ping, listRepositories } from './data/api';
import { APR_SAMPLE } from './data/sampleData';

vi.mock('./data/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/api')>();
  return {
    ...actual,
    load: vi.fn(),
    ping: vi.fn(),
    rerun: vi.fn(),
    listRepositories: vi.fn(),
    getSessionStatus: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
});

describe('App review-data boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(ping).mockResolvedValue(null);
    vi.mocked(listRepositories).mockResolvedValue([]);
    vi.mocked(getSessionStatus).mockResolvedValue({ authRequired: false, authenticated: true });
  });

  it('moves from loading to a safe empty state and repository action', async () => {
    vi.mocked(load).mockResolvedValue({ status: 'live', repos: [] });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

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

describe('App auth gate', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(ping).mockResolvedValue(null);
    vi.mocked(listRepositories).mockResolvedValue([]);
    vi.mocked(load).mockResolvedValue({ status: 'live', repos: [] });
  });

  it('blocks the app behind a login screen when the server requires a token, then unlocks it on success', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue({ authRequired: true, authenticated: false });
    vi.mocked(login).mockResolvedValue({ authenticated: true });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'No reviews yet' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'my-secret-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('my-secret-token'));
    expect(await screen.findByRole('heading', { name: 'No reviews yet' })).toBeVisible();
  });

  it('shows a rejected-login error without unlocking the app', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue({ authRequired: true, authenticated: false });
    vi.mocked(login).mockRejectedValue(new Error('Incorrect access token.'));
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Access token'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect access token.');
    expect(screen.queryByRole('heading', { name: 'No reviews yet' })).not.toBeInTheDocument();
  });

  it('skips the login screen entirely when the server reports auth is not required', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue({ authRequired: false, authenticated: true });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No reviews yet' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('signing out from an authenticated session returns to the login screen', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue({ authRequired: true, authenticated: true });
    vi.mocked(logout).mockResolvedValue({ authenticated: false });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'No reviews yet' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(logout).toHaveBeenCalled();
  });
});
