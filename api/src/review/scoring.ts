import type { CategoryTuple, PortfolioCheck, QualityFinding, SecurityFinding } from '../types.js';
import { grade } from '../lib/grade.js';
import type { DeterministicAnalysis, ScoredReview } from './contracts.js';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreCategories(analysis: DeterministicAnalysis): CategoryTuple[] {
  // Single deterministic rubric: Documentation 15%, Testing 20%, Docker 10%,
  // CI/CD 15%, Security 20%, Maintainability 20%. Each category is assembled
  // only from the bounded repository evidence represented in DeterministicAnalysis.
  const documentation = clamp((analysis.hasReadme ? 45 : 0) + (analysis.readmeComprehensive ? 25 : 0) + (analysis.hasLicense ? 15 : 0) + (analysis.hasEnvExample ? 15 : 0));
  const testRatio = analysis.sourceFiles === 0 ? 0 : Math.min(25, Math.round((analysis.testFiles / analysis.sourceFiles) * 100));
  const testing = clamp((analysis.hasTests ? 60 : 0) + testRatio + (analysis.ciRunsTests ? 15 : 0));
  const docker = analysis.hasDocker ? 100 : 20;
  const ci = analysis.hasCi ? (analysis.ciRunsTests ? 100 : 70) : 15;
  const risky = analysis.security.filter(([severity]) => severity === 'high').length;
  const medium = analysis.security.filter(([severity]) => severity === 'med').length;
  const security = clamp(100 - risky * 30 - medium * 15);
  const maintainability = clamp(
    55 +
      (analysis.hasTypedSources ? 15 : 0) +
      (analysis.hasManifest ? 10 : 0) +
      (analysis.hasTests ? 10 : 0) +
      (analysis.largeSourceFiles.length === 0 ? 10 : -Math.min(20, analysis.largeSourceFiles.length * 5)) -
      Math.min(10, analysis.todoCount),
  );
  return [
    ['Documentation', 'book-open', documentation],
    ['Testing', 'flask', testing],
    ['Docker', 'shipping-container', docker],
    ['CI/CD', 'git-branch', ci],
    ['Security', 'shield-check', security],
    ['Maintainability', 'wrench', maintainability],
  ];
}

function findingText(analysis: DeterministicAnalysis): QualityFinding[] {
  const findings: QualityFinding[] = [];
  if (analysis.largeSourceFiles.length > 0) findings.push(['warn', `${analysis.largeSourceFiles.length} source file(s) exceed 400 lines; consider splitting responsibilities.`]);
  if (analysis.todoCount > 0) findings.push(['info', `${analysis.todoCount} TODO/FIXME marker(s) remain in analyzed text files.`]);
  if (analysis.warnings.length > 0) findings.push(['info', `${analysis.warnings.length} filesystem item(s) were safely skipped by analyzer policy.`]);
  if (findings.length === 0) findings.push(['ok', 'No basic maintainability warnings were detected by the bounded static checks.']);
  return findings;
}

export function scoreAnalysis(analysis: DeterministicAnalysis): ScoredReview {
  const categories = scoreCategories(analysis);
  const weights = [0.15, 0.2, 0.1, 0.15, 0.2, 0.2];
  const overallScore = clamp(categories.reduce((sum, category, index) => sum + category[2] * (weights[index] ?? 0), 0));
  const strengths: string[] = [];
  const improvements: string[] = [];
  const nextSteps: string[] = [];
  if (analysis.hasReadme) strengths.push('Repository purpose and setup have a committed README entry point.');
  else {
    improvements.push('No README was detected, leaving purpose and setup undocumented.');
    nextSteps.push('Add a README with purpose, setup, usage, and architecture notes.');
  }
  if (analysis.hasTests) strengths.push(`${analysis.testFiles} test file(s) provide an automated verification foundation.`);
  else {
    improvements.push('No automated test files were detected.');
    nextSteps.push('Add focused unit and integration tests for the highest-risk behavior.');
  }
  if (analysis.hasCi && analysis.ciRunsTests) strengths.push('CI configuration appears to run automated tests.');
  else {
    improvements.push(analysis.hasCi ? 'CI exists but no test command was detected.' : 'No supported CI workflow was detected.');
    nextSteps.push('Run linting and tests in CI for every proposed change.');
  }
  if (analysis.hasDocker) strengths.push('Container configuration supports reproducible packaging.');
  else {
    improvements.push('No Docker or Compose configuration was detected.');
    nextSteps.push('Document a reproducible deployment path; add a container only if it fits the project.');
  }
  if (analysis.hasLicense) strengths.push('A license file clarifies reuse terms.');
  else {
    improvements.push('No license file was detected.');
    nextSteps.push('Choose and add an appropriate license.');
  }
  const secretFindings = analysis.security.filter(([severity]) => severity === 'high');
  if (secretFindings.length > 0) {
    improvements.push(`${secretFindings.length} high-confidence credential risk(s) require immediate review.`);
    nextSteps.unshift('Rotate exposed credentials and purge sensitive values from repository history.');
  } else strengths.push('The bounded scan found no high-confidence committed secret patterns.');

  const checks: PortfolioCheck[] = [
    ['Clear project purpose', analysis.hasReadme ? 1 : 0],
    ['Modern project manifest', analysis.hasManifest ? 1 : 0],
    ['Dockerized application', analysis.hasDocker ? 1 : 0],
    ['Automated tests', analysis.hasTests ? 1 : 0],
    ['CI/CD pipeline', analysis.hasCi ? 1 : 0],
    ['Detailed documentation', analysis.readmeComprehensive ? 1 : 0],
    ['License', analysis.hasLicense ? 1 : 0],
  ];
  const verdict = grade(overallScore);
  const security: SecurityFinding[] = analysis.security;
  return {
    overallScore,
    aiSummary: `${analysis.repositoryName} is a ${analysis.framework} repository scoring ${overallScore}/100 under the deterministic review rubric. Its strongest verified foundations and highest-impact gaps are listed below; no repository code was executed.`,
    summary: [
      ['cube', 'Type', analysis.framework.slice(0, 64), ''],
      ['shipping-container', 'Docker', analysis.hasDocker ? 'Present' : 'Missing', analysis.hasDocker ? 'good' : 'warn'],
      ['file-text', 'README', analysis.readmeComprehensive ? 'Comprehensive' : analysis.hasReadme ? 'Present' : 'Missing', analysis.hasReadme ? 'good' : 'warn'],
      ['git-branch', 'CI Workflow', analysis.hasCi ? (analysis.ciRunsTests ? 'Tests enabled' : 'Present') : 'Missing', analysis.hasCi ? 'good' : 'warn'],
      ['flask', 'Tests', analysis.hasTests ? `${analysis.testFiles} files` : 'Missing', analysis.hasTests ? 'good' : 'warn'],
      ['clock', 'Recent Activity', `${analysis.commits14d} commits in 14 days`, analysis.commits14d > 0 ? 'good' : 'warn'],
    ],
    categories,
    strengths: strengths.slice(0, 8),
    improvements: improvements.slice(0, 8),
    nextSteps: [...new Set(nextSteps)].slice(0, 8),
    portfolio: {
      verdict,
      blurb: `${analysis.repositoryName} is currently rated ${verdict.toLowerCase()} for portfolio readiness using repository evidence only.`,
      checks,
      footer: 'Address the unchecked evidence gaps, then rerun the persisted review.',
    },
    quality: {
      metrics: [
        ['Files analyzed', String(analysis.fileCount)],
        ['Source files', String(analysis.sourceFiles)],
        ['Test files', String(analysis.testFiles)],
        ['TODO markers', String(analysis.todoCount)],
      ],
      findings: findingText(analysis),
    },
    structure: analysis.structure.length > 0 ? analysis.structure : ['(no analyzable text files)'],
    dependencies: analysis.dependencies,
    security,
    stats: {
      loc: analysis.loc,
      openIssues: 0,
      pullRequests: 0,
      contributors: analysis.contributors,
      commits14d: analysis.commits14d,
    },
  };
}
