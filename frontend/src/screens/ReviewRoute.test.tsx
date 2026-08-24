import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { APR_SAMPLE } from '../data/sampleData';
import { ReviewRoute } from './ReviewRoute';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderRoute(path: string, repos = APR_SAMPLE) {
  const callbacks = {
    onSel: vi.fn(),
    onAddRepo: vi.fn(),
    onViewRepos: vi.fn(),
    onViewInsights: vi.fn(),
  };
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/reviews/:repoId"
          element={
            <>
              <ReviewRoute repos={repos} summary={null} {...callbacks} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return callbacks;
}

describe('ReviewRoute', () => {
  it('normalizes an invalid tab to the AI review tab', async () => {
    renderRoute('/reviews/threatstream?tab=unknown');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/reviews/threatstream?tab=ai'));
    expect(screen.getByRole('button', { name: /AI Review/ })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a safe not-found state for an unknown repository', () => {
    const callbacks = renderRoute('/reviews/missing-repo');

    expect(screen.getByRole('heading', { name: 'Review not found' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Open latest review' }));
    expect(callbacks.onSel).toHaveBeenCalledWith(APR_SAMPLE[0].id);
  });

  it('shows a repository action when no reviewed data exists', () => {
    const callbacks = renderRoute('/reviews/new-repo', []);

    expect(screen.getByRole('heading', { name: 'No reviewed repositories' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'View repositories' }));
    expect(callbacks.onViewRepos).toHaveBeenCalledOnce();
  });
});
