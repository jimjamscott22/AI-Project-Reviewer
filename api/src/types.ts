// Mirrors frontend/src/data/types.ts — this is the joined shape GET /api/repos
// and GET /api/repos/:id return, one JSON object per repo with its latest review.

export type Tone = 'good' | 'warn' | '';
export type Severity = 'high' | 'med' | 'warn' | 'info' | 'ok';

export type SummaryItemTuple = [icon: string, label: string, value: string, tone: Tone];
export type CategoryTuple = [name: string, icon: string, score: number];
export type PortfolioCheck = [label: string, done: 0 | 1];
export type QualityMetric = [label: string, value: string];
export type QualityFinding = [severity: Severity, text: string];
export type SecurityFinding = [severity: Severity, title: string, detail: string];
export type DependencyStatus = 'ok' | 'outdated' | 'major';
export type DependencyRow = [name: string, installed: string, latest: string, status: DependencyStatus];

export interface Portfolio {
  verdict: string;
  blurb: string;
  checks: PortfolioCheck[];
  footer: string;
}

export interface Quality {
  metrics: QualityMetric[];
  findings: QualityFinding[];
}

export interface Repo {
  id: string;
  name: string;
  vis: string;
  url: string;
  updated: string;
  hue: number;
  lang: string;
  framework: string;
  loc: string;
  issues: number;
  prs: number;
  contributors: number;
  score: number;
  summary: SummaryItemTuple[];
  cats: CategoryTuple[];
  strengths: string[];
  improves: string[];
  steps: string[];
  portfolio: Portfolio;
  ai: string;
  quality: Quality;
  structure: string[];
  deps: DependencyRow[];
  security: SecurityFinding[];
}
