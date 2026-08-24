import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { load, ping } from './data/api';
import { APR_SAMPLE } from './data/sampleData';

vi.mock('./data/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/api')>();
  return {
    ...actual,
    load: vi.fn(),
    ping: vi.fn(),
    rerun: vi.fn(),
  };
});

describe('App review-data boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(ping).mockResolvedValue(false);
  });

  it('moves from loading to a safe empty state and repository action', async () => {
    vi.mocked(load).mockResolvedValue({ live: true, repos: [] });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Loading reviews' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'No reviews yet' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'View repositories' }));
    expect(await screen.findByRole('heading', { name: 'Repositories is the next milestone' })).toBeVisible();
  });

  it('labels embedded sample reviews when the API is unavailable', async () => {
    vi.mocked(load).mockResolvedValue({ live: false, repos: APR_SAMPLE });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Embedded demo reviews'));
    expect(screen.getByRole('heading', { name: 'Recent reviews' })).toBeVisible();
  });
});
