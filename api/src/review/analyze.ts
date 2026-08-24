import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { analyzeDependencies } from './dependencies.js';
import { scanSecurity } from './security.js';
import type { AnalysisLimits, AnalyzedFile, DeterministicAnalysis } from './contracts.js';
import { runBounded } from './workspace.js';

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
  '__pycache__',
  'coverage',
  'target',
]);
const BINARY_EXTENSIONS = new Set([
  '.7z', '.avi', '.bmp', '.class', '.dll', '.dylib', '.eot', '.exe', '.gif', '.gz', '.ico', '.jar', '.jpeg', '.jpg',
  '.lockb', '.mov', '.mp3', '.mp4', '.o', '.otf', '.pdf', '.png', '.pyc', '.so', '.tar', '.tif', '.tiff', '.ttf', '.wasm',
  '.webm', '.webp', '.woff', '.woff2', '.zip',
]);
const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cs', '.css', '.go', '.html', '.java', '.js', '.jsx', '.php', '.py', '.rb', '.rs', '.scss', '.swift', '.ts', '.tsx', '.vue']);
const TYPED_EXTENSIONS = new Set(['.cs', '.go', '.java', '.rs', '.swift', '.ts', '.tsx']);

export class AnalysisLimitError extends Error {
  constructor(readonly code: 'file_limit' | 'byte_limit' | 'analysis_timeout', message: string) {
    super(message);
    this.name = 'AnalysisLimitError';
  }
}

interface FileRecord {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export interface AnalyzeRepositoryContext {
  repositoryName?: string;
  limits?: Partial<AnalysisLimits>;
}

function normalizedRelative(root: string, candidate: string): string {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('A repository entry resolved outside the analysis root.');
  }
  return relative.split(path.sep).join('/');
}

function checkDeadline(deadline: number): void {
  if (Date.now() > deadline) {
    throw new AnalysisLimitError('analysis_timeout', 'The bounded repository analysis exceeded its time limit.');
  }
}

async function inventory(root: string, limits: AnalysisLimits, deadline: number): Promise<{ records: FileRecord[]; warnings: string[] }> {
  const resolvedRoot = await realpath(root);
  if (!(await stat(resolvedRoot)).isDirectory()) throw new Error('Repository analysis root is not a directory.');
  const records: FileRecord[] = [];
  const warnings: string[] = [];
  let totalBytes = 0;
  let visitedEntries = 0;

  async function walk(directory: string): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      checkDeadline(deadline);
      visitedEntries += 1;
      if (visitedEntries > limits.maxFiles * 4) {
        throw new AnalysisLimitError('file_limit', `Repository inventory exceeded the ${limits.maxFiles}-file safety limit.`);
      }
      if (entry.name === '.git' || (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name.toLowerCase()))) continue;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalizedRelative(resolvedRoot, absolutePath);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        warnings.push(`Skipped symbolic link: ${relativePath}`);
        continue;
      }
      if (metadata.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!metadata.isFile() || BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (metadata.size > limits.maxFileBytes) {
        warnings.push(`Skipped oversized file: ${relativePath}`);
        continue;
      }
      if (records.length + 1 > limits.maxFiles) {
        throw new AnalysisLimitError('file_limit', `Repository contains more than the ${limits.maxFiles} analyzable-file limit.`);
      }
      totalBytes += metadata.size;
      if (totalBytes > limits.maxTotalBytes) {
        throw new AnalysisLimitError('byte_limit', `Repository exceeds the ${limits.maxTotalBytes}-byte analysis limit.`);
      }
      records.push({ absolutePath, relativePath, size: metadata.size });
    }
  }

  await walk(resolvedRoot);
  return { records, warnings: warnings.slice(0, 50) };
}

async function loadTextFiles(records: FileRecord[], deadline: number): Promise<AnalyzedFile[]> {
  const files: AnalyzedFile[] = [];
  for (const record of records) {
    checkDeadline(deadline);
    const content = await readFile(record.absolutePath, 'utf8');
    if (content.includes('\0')) continue;
    files.push({
      path: record.relativePath,
      size: record.size,
      lines: content.length === 0 ? 0 : content.split(/\r?\n/).length,
      content,
    });
  }
  return files;
}

function detectLanguage(files: AnalyzedFile[]): string {
  const totals = new Map<string, number>();
  const labels: Record<string, string> = {
    '.cs': 'C#', '.go': 'Go', '.html': 'HTML', '.java': 'Java', '.js': 'JavaScript', '.jsx': 'JavaScript', '.php': 'PHP',
    '.py': 'Python', '.rb': 'Ruby', '.rs': 'Rust', '.swift': 'Swift', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.vue': 'Vue',
  };
  for (const file of files) {
    const extension = path.posix.extname(file.path).toLowerCase();
    if (labels[extension]) totals.set(extension, (totals.get(extension) ?? 0) + file.lines);
  }
  const leading = [...totals].sort((a, b) => b[1] - a[1])[0]?.[0];
  return leading ? labels[leading] ?? 'Unknown' : 'Unknown';
}

function packageManifests(files: AnalyzedFile[]): Record<string, unknown>[] {
  const manifests: Record<string, unknown>[] = [];
  for (const packageFile of files.filter((file) => /(^|\/)package\.json$/i.test(file.path))) {
    try {
      manifests.push(JSON.parse(packageFile.content) as Record<string, unknown>);
    } catch {
      // Malformed JSON is treated as unavailable metadata, never loaded as code.
    }
  }
  return manifests;
}

function detectFramework(files: AnalyzedFile[], language: string): string {
  const packageNames = new Set<string>();
  for (const manifest of packageManifests(files)) {
    for (const field of ['dependencies', 'devDependencies']) {
      const value = manifest[field];
      if (value && typeof value === 'object' && !Array.isArray(value)) Object.keys(value).forEach((name) => packageNames.add(name));
    }
  }
  if (packageNames.has('next')) return 'Next.js';
  if (packageNames.has('@angular/core')) return 'Angular';
  if (packageNames.has('vue')) return packageNames.has('vite') ? 'Vue + Vite' : 'Vue';
  if (packageNames.has('react')) return packageNames.has('vite') ? 'React + Vite' : 'React';
  if (packageNames.has('express')) return 'Node + Express';
  if (packageNames.has('fastify')) return 'Node + Fastify';
  const python = files.filter((file) => file.path.endsWith('.py')).map((file) => file.content).join('\n');
  if (/\bfastapi\b/i.test(python)) return 'FastAPI';
  if (/\bdjango\b/i.test(python)) return 'Django';
  if (/\bflask\b/i.test(python)) return 'Flask';
  return language === 'Unknown' ? 'Unclassified' : `${language} project`;
}

async function gitActivity(root: string): Promise<{ commits14d: number; contributors: number }> {
  try {
    const { stdout } = await runBounded('git', ['-c', 'core.hooksPath=', 'log', '--since=14 days ago', '--format=%ae'], {
      cwd: root,
      timeoutMs: Math.min(config.review.cloneTimeoutMs, 10_000),
      outputBytes: Math.min(config.review.commandOutputBytes, 64 * 1024),
    });
    const authors = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return { commits14d: authors.length, contributors: Math.max(1, new Set(authors).size) };
  } catch {
    return { commits14d: 0, contributors: 1 };
  }
}

export async function analyzeRepository(root: string, context: AnalyzeRepositoryContext = {}): Promise<DeterministicAnalysis> {
  const limits: AnalysisLimits = { ...config.review, ...context.limits };
  const deadline = Date.now() + limits.analysisTimeoutMs;
  const { records, warnings } = await inventory(root, limits, deadline);
  const files = await loadTextFiles(records, deadline);
  checkDeadline(deadline);
  const lowerPaths = files.map((file) => file.path.toLowerCase());
  const readme = files.find((file) => /^readme(?:\.[^/]+)?$/i.test(file.path));
  const source = files.filter((file) => SOURCE_EXTENSIONS.has(path.posix.extname(file.path).toLowerCase()));
  const tests = files.filter((file) => /(^|\/)(test|tests|__tests__|spec)(\/|$)|(?:\.test|\.spec)\.[^.]+$/i.test(file.path));
  const ciFiles = files.filter((file) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(file.path) || /^\.gitlab-ci\.ya?ml$/i.test(file.path));
  const language = detectLanguage(files);
  const git = await gitActivity(root);
  const dependencies = await analyzeDependencies(files, {
    timeoutMs: limits.registryTimeoutMs,
    maxPackages: limits.registryMaxPackages,
  });
  checkDeadline(deadline);
  const loc = source.reduce((total, file) => total + file.lines, 0);
  return {
    repositoryName: context.repositoryName?.slice(0, 128) || path.basename(root),
    language,
    framework: detectFramework(files, language),
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    loc,
    sourceFiles: source.length,
    testFiles: tests.length,
    largeSourceFiles: source.filter((file) => file.lines > 400).map((file) => file.path).slice(0, 10),
    todoCount: files.reduce((total, file) => total + (file.content.match(/\b(?:TODO|FIXME)\b/g)?.length ?? 0), 0),
    hasReadme: Boolean(readme),
    readmeComprehensive: Boolean(readme && readme.content.length >= 1_500 && /^#{1,3}\s+/m.test(readme.content)),
    hasDocker: lowerPaths.some((item) => /(^|\/)(dockerfile|compose\.ya?ml|docker-compose\.ya?ml)$/.test(item)),
    hasCi: ciFiles.length > 0,
    ciRunsTests: ciFiles.some((file) => /\b(?:test|pytest|vitest|jest|go test|cargo test)\b/i.test(file.content)),
    hasTests: tests.length > 0,
    hasLicense: lowerPaths.some((item) => /(^|\/)licen[sc]e(?:\.[^/]+)?$/.test(item)),
    hasEnvExample: lowerPaths.some((item) => /(^|\/)\.env\.(?:example|sample|template)$/.test(item)),
    hasTypedSources: source.some((file) => TYPED_EXTENSIONS.has(path.posix.extname(file.path).toLowerCase())),
    hasManifest: lowerPaths.some((item) => ['package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'cargo.toml', 'pom.xml'].includes(path.posix.basename(item))),
    commits14d: git.commits14d,
    contributors: git.contributors,
    structure: files.slice(0, 80).map((file, index) => `${index === files.length - 1 ? '└─' : '├─'} ${file.path}`),
    dependencies,
    security: await scanSecurity(root, files),
    warnings,
  };
}
