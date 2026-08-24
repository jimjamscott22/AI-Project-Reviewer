import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyzeRepository, AnalysisLimitError } from '../src/review/analyze.js';
import { analyzeDependencies } from '../src/review/dependencies.js';
import { scoreAnalysis } from '../src/review/scoring.js';
import { scanSecurity } from '../src/review/security.js';
import { assertChildPath, BoundedCommandError, runBounded } from '../src/review/workspace.js';
import type { AnalyzedFile, DeterministicAnalysis } from '../src/review/contracts.js';

const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('analyzes Node and Python fixtures without executing repository scripts', async () => {
  const node = await analyzeRepository(path.join(fixtureRoot, 'node-project'), {
    repositoryName: 'Node Fixture',
    limits: { registryMaxPackages: 0 },
  });
  assert.equal(node.language, 'TypeScript');
  assert.equal(node.framework, 'React + Vite');
  assert.equal(node.hasTests, true);
  assert.equal(node.hasCi, true);
  assert.equal(node.ciRunsTests, true);
  assert.equal(node.hasDocker, true);

  const python = await analyzeRepository(path.join(fixtureRoot, 'python-project'), {
    repositoryName: 'Python Fixture',
    limits: { registryMaxPackages: 0 },
  });
  assert.equal(python.language, 'Python');
  assert.equal(python.framework, 'FastAPI');
  assert.equal(python.hasTests, true);
});

test('sparse and empty repositories still produce a complete bounded review', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'apr-empty-'));
  try {
    const analysis = await analyzeRepository(root, { repositoryName: 'Empty', limits: { registryMaxPackages: 0 } });
    const review = scoreAnalysis(analysis);
    assert.equal(analysis.fileCount, 0);
    assert.ok(review.overallScore >= 0 && review.overallScore <= 100);
    assert.ok(review.summary.length > 0);
    assert.ok(review.portfolio.checks.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('skips oversized files and rejects repositories that exceed aggregate byte limits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'apr-limits-'));
  try {
    await writeFile(path.join(root, 'oversized.ts'), 'x'.repeat(300));
    const skipped = await analyzeRepository(root, {
      limits: { maxFileBytes: 100, maxTotalBytes: 1_000, maxFiles: 10, registryMaxPackages: 0 },
    });
    assert.equal(skipped.fileCount, 0);
    assert.match(skipped.warnings[0] ?? '', /oversized/i);

    await writeFile(path.join(root, 'a.ts'), 'a'.repeat(80));
    await writeFile(path.join(root, 'b.ts'), 'b'.repeat(80));
    await assert.rejects(
      analyzeRepository(root, { limits: { maxFileBytes: 500, maxTotalBytes: 150, maxFiles: 10, registryMaxPackages: 0 } }),
      (error: unknown) => error instanceof AnalysisLimitError && error.code === 'byte_limit',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('does not follow a symlink that points outside the repository root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'apr-symlink-root-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'apr-symlink-outside-'));
  try {
    await writeFile(path.join(outside, 'outside-secret.txt'), 'must-not-be-read');
    await symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const analysis = await analyzeRepository(root, { limits: { registryMaxPackages: 0 } });
    assert.equal(analysis.fileCount, 0);
    assert.match(analysis.warnings[0] ?? '', /symbolic link/i);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('offline dependency registries produce explicit unknown status', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  const file: AnalyzedFile = {
    path: 'package.json',
    size: 42,
    lines: 1,
    content: JSON.stringify({ dependencies: { react: '^18.2.0' } }),
  };
  try {
    const rows = await analyzeDependencies([file], { timeoutMs: 20, maxPackages: 5 });
    assert.deepEqual(rows[0], ['react', '^18.2.0', 'Unavailable', 'unknown']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('npm lockfiles supply installed versions for semantic delta classification', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ version: '2.0.0' }), { status: 200 });
  const files: AnalyzedFile[] = [
    { path: 'package.json', size: 1, lines: 1, content: JSON.stringify({ dependencies: { example: '^1.0.0' } }) },
    { path: 'package-lock.json', size: 1, lines: 1, content: JSON.stringify({ packages: { 'node_modules/example': { version: '1.4.2' } } }) },
  ];
  try {
    const rows = await analyzeDependencies(files, { timeoutMs: 50, maxPackages: 5 });
    assert.deepEqual(rows[0], ['example', '1.4.2', '2.0.0', 'major']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Python project metadata uses lockfile versions without loading configuration as code', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ info: { version: '1.2.0' } }), { status: 200 });
  const files: AnalyzedFile[] = [
    { path: 'pyproject.toml', size: 1, lines: 3, content: '[project]\ndependencies = ["fastapi>=1.0"]' },
    { path: 'uv.lock', size: 1, lines: 3, content: '[[package]]\nname = "fastapi"\nversion = "1.1.0"' },
  ];
  try {
    const rows = await analyzeDependencies(files, { timeoutMs: 50, maxPackages: 5 });
    assert.deepEqual(rows[0], ['fastapi', '1.1.0', '1.2.0', 'outdated']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('secret values are redacted from findings and review output', async () => {
  const literal = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';
  const files: AnalyzedFile[] = [{ path: 'src/config.ts', size: literal.length, lines: 1, content: literal }];
  const findings = await scanSecurity(fixtureRoot, files);
  assert.equal(findings[0]?.[0], 'high');
  assert.doesNotMatch(JSON.stringify(findings), new RegExp(literal));
});

test('public environment variants are review warnings rather than unverified secret claims', async () => {
  const files: AnalyzedFile[] = [{ path: 'frontend/.env.development', size: 20, lines: 1, content: 'VITE_API_BASE=/api' }];
  const findings = await scanSecurity(fixtureRoot, files);
  assert.equal(findings[0]?.[0], 'med');
  assert.match(findings[0]?.[2] ?? '', /may be intentional/i);
});

test('bounded command wrapper stops timeouts and rejects workspace escapes', async () => {
  await assert.rejects(
    runBounded(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 50, outputBytes: 1024 }),
    (error: unknown) => error instanceof BoundedCommandError && error.code === 'command_timeout',
  );
  const parent = path.join(os.tmpdir(), 'apr-parent');
  assert.throws(() => assertChildPath(parent, path.dirname(parent)), /child/);
  assert.equal(assertChildPath(parent, path.join(parent, 'repo')), path.resolve(parent, 'repo'));
});

function baseAnalysis(overrides: Partial<DeterministicAnalysis> = {}): DeterministicAnalysis {
  return {
    repositoryName: 'Boundary', language: 'TypeScript', framework: 'React', fileCount: 1, totalBytes: 10, loc: 1,
    sourceFiles: 1, testFiles: 0, largeSourceFiles: [], todoCount: 0, hasReadme: false, readmeComprehensive: false,
    hasDocker: false, hasCi: false, ciRunsTests: false, hasTests: false, hasLicense: false, hasEnvExample: false,
    hasTypedSources: false, hasManifest: false, commits14d: 0, contributors: 1, structure: ['├─ app.ts'], dependencies: [],
    security: [['ok', 'No secrets', 'Static scan clear.']], warnings: [], ...overrides,
  };
}

test('deterministic scoring stays within 0-100 at weak and strong boundaries', () => {
  const weak = scoreAnalysis(baseAnalysis());
  const strong = scoreAnalysis(baseAnalysis({
    hasReadme: true, readmeComprehensive: true, hasDocker: true, hasCi: true, ciRunsTests: true, hasTests: true,
    hasLicense: true, hasEnvExample: true, hasTypedSources: true, hasManifest: true, testFiles: 3, commits14d: 10,
  }));
  for (const review of [weak, strong]) {
    assert.ok(review.overallScore >= 0 && review.overallScore <= 100);
    review.categories.forEach((category) => assert.ok(category[2] >= 0 && category[2] <= 100));
  }
  assert.ok(strong.overallScore > weak.overallScore);
});
