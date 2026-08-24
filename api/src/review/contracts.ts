import type { DependencyRow, ReviewResult, SecurityFinding } from '../types.js';

export interface AnalysisLimits {
  analysisTimeoutMs: number;
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes: number;
  registryTimeoutMs: number;
  registryMaxPackages: number;
}

export interface AnalyzedFile {
  path: string;
  size: number;
  lines: number;
  content: string;
}

export interface DeterministicAnalysis {
  repositoryName: string;
  language: string;
  framework: string;
  fileCount: number;
  totalBytes: number;
  loc: number;
  sourceFiles: number;
  testFiles: number;
  largeSourceFiles: string[];
  todoCount: number;
  hasReadme: boolean;
  readmeComprehensive: boolean;
  hasDocker: boolean;
  hasCi: boolean;
  ciRunsTests: boolean;
  hasTests: boolean;
  hasLicense: boolean;
  hasEnvExample: boolean;
  hasTypedSources: boolean;
  hasManifest: boolean;
  commits14d: number;
  contributors: number;
  structure: string[];
  dependencies: DependencyRow[];
  security: SecurityFinding[];
  warnings: string[];
}

export type ScoredReview = ReviewResult;
