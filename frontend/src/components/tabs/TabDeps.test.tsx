import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { APR_SAMPLE } from '../../data/sampleData';
import type { Repo } from '../../data/types';
import { TabDeps } from './TabDeps';

it('renders an explicit offline state for dependencies that could not be checked', () => {
  const repo: Repo = { ...APR_SAMPLE[0], deps: [['offline-package', '1.0.0', '—', 'unknown']] };

  render(<TabDeps repo={repo} />);

  expect(screen.getByText('Not checked')).toBeVisible();
});
