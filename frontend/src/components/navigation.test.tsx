import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APR_SAMPLE } from '../data/sampleData';
import { InsightCol } from './InsightCol';
import { RepoRail } from './RepoRail';
import { Sidebar } from './Sidebar';

describe('foundation navigation controls', () => {
  it('routes the Connect GitHub control to repositories', () => {
    const go = vi.fn();
    render(<Sidebar screen="dashboard" go={go} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect GitHub/ }));
    expect(go).toHaveBeenCalledWith('repos');
  });

  it('wires repository management controls', () => {
    const onAdd = vi.fn();
    const onViewAll = vi.fn();
    render(<RepoRail repos={APR_SAMPLE} sel={APR_SAMPLE[0].id} onSel={vi.fn()} onAdd={onAdd} onViewAll={onViewAll} />);

    fireEvent.click(screen.getByRole('button', { name: /Add Repo/ }));
    fireEvent.click(screen.getByRole('button', { name: /View all repositories/ }));

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onViewAll).toHaveBeenCalledOnce();
  });

  it('opens the portfolio insights screen', () => {
    const onViewInsights = vi.fn();
    render(<InsightCol repo={APR_SAMPLE[0]} onViewInsights={onViewInsights} />);

    fireEvent.click(screen.getByRole('button', { name: /View full insights/ }));
    expect(onViewInsights).toHaveBeenCalledOnce();
  });
});
