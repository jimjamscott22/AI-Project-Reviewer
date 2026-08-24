import type { DependencyRow, DependencyStatus } from '../types.js';
import type { AnalyzedFile } from './contracts.js';

interface DependencyInput {
  ecosystem: 'npm' | 'pypi';
  name: string;
  installed: string;
}

function lockfileVersions(files: AnalyzedFile[]): Map<string, string> {
  const versions = new Map<string, string>();
  for (const file of files) {
    if (/(^|\/)package-lock\.json$/i.test(file.path)) {
      try {
        const lock = JSON.parse(file.content) as {
          packages?: Record<string, { version?: unknown }>;
          dependencies?: Record<string, { version?: unknown }>;
        };
        for (const [packagePath, detail] of Object.entries(lock.packages ?? {})) {
          const marker = 'node_modules/';
          const markerIndex = packagePath.lastIndexOf(marker);
          const name = markerIndex >= 0 ? packagePath.slice(markerIndex + marker.length) : '';
          if (name && typeof detail.version === 'string') versions.set(`npm:${name.toLowerCase()}`, detail.version);
        }
        for (const [name, detail] of Object.entries(lock.dependencies ?? {})) {
          if (typeof detail.version === 'string') versions.set(`npm:${name.toLowerCase()}`, detail.version);
        }
      } catch {
        // Invalid lockfiles are ignored as metadata, never loaded as code.
      }
    }
    if (/(^|\/)pipfile\.lock$/i.test(file.path)) {
      try {
        const lock = JSON.parse(file.content) as Record<string, Record<string, { version?: unknown }> | undefined>;
        for (const section of ['default', 'develop']) {
          for (const [name, detail] of Object.entries(lock[section] ?? {})) {
            if (typeof detail.version === 'string') versions.set(`pypi:${name.toLowerCase()}`, detail.version.replace(/^==/, ''));
          }
        }
      } catch {
        // Invalid lockfiles are ignored as metadata, never loaded as code.
      }
    }
    if (/(^|\/)(?:uv|poetry)\.lock$/i.test(file.path)) {
      for (const block of file.content.split(/\[\[package\]\]/).slice(1)) {
        const name = block.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
        const version = block.match(/^\s*version\s*=\s*["']([^"']+)["']/m)?.[1];
        if (name && version) versions.set(`pypi:${name.toLowerCase()}`, version);
      }
    }
  }
  return versions;
}

function cleanVersion(value: string): string | null {
  const match = value.match(/\d+(?:\.\d+){0,2}/);
  return match?.[0] ?? null;
}

function classify(installed: string, latest: string): DependencyStatus {
  const current = cleanVersion(installed)?.split('.').map(Number);
  const newest = cleanVersion(latest)?.split('.').map(Number);
  if (!current || !newest) return 'unknown';
  const [currentMajor = 0, currentMinor = 0, currentPatch = 0] = current;
  const [latestMajor = 0, latestMinor = 0, latestPatch = 0] = newest;
  if (latestMajor > currentMajor) return 'major';
  if (latestMinor > currentMinor || latestPatch > currentPatch) return 'outdated';
  return 'ok';
}

function packageInputs(files: AnalyzedFile[]): DependencyInput[] {
  const inputs: DependencyInput[] = [];
  const locked = lockfileVersions(files);
  const packageFiles = files.filter((file) => /(^|\/)package\.json$/i.test(file.path));
  for (const packageFile of packageFiles) {
    try {
      const manifest = JSON.parse(packageFile.content) as Record<string, unknown>;
      for (const field of ['dependencies', 'devDependencies'] as const) {
        const dependencies = manifest[field];
        if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue;
        for (const [name, version] of Object.entries(dependencies)) {
          if (typeof version === 'string') inputs.push({ ecosystem: 'npm', name, installed: locked.get(`npm:${name.toLowerCase()}`) ?? version });
        }
      }
    } catch {
      // Never load or execute repository configuration.
    }
  }

  for (const file of files.filter((item) => /(^|\/)(requirements[^/]*\.txt)$/i.test(item.path))) {
    for (const line of file.content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
      const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*(?:===|==|~=|>=|<=|>|<)?\s*([^;\s#]+)?/);
      if (match?.[1]) inputs.push({ ecosystem: 'pypi', name: match[1], installed: locked.get(`pypi:${match[1].toLowerCase()}`) ?? match[2] ?? 'unpinned' });
    }
  }

  for (const file of files.filter((item) => /(^|\/)pyproject\.toml$/i.test(item.path))) {
    const projectDependencies = file.content.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1] ?? '';
    for (const entry of projectDependencies.matchAll(/["']([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*([^"']*)["']/g)) {
      const name = entry[1];
      if (!name) continue;
      const installed = cleanVersion(entry[2] ?? '') ?? 'unpinned';
      inputs.push({ ecosystem: 'pypi', name, installed: locked.get(`pypi:${name.toLowerCase()}`) ?? installed });
    }
    const poetrySection = file.content.match(/\[tool\.poetry\.dependencies\]\s*([\s\S]*?)(?=\r?\n\[|$)/)?.[1] ?? '';
    for (const line of poetrySection.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*["']([^"']+)["']/);
      const name = match?.[1];
      if (!name || name.toLowerCase() === 'python') continue;
      inputs.push({ ecosystem: 'pypi', name, installed: locked.get(`pypi:${name.toLowerCase()}`) ?? cleanVersion(match?.[2] ?? '') ?? 'unpinned' });
    }
  }
  return [...new Map(inputs.map((input) => [`${input.ecosystem}:${input.name.toLowerCase()}`, input])).values()];
}

async function fetchLatest(input: DependencyInput, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();
  try {
    const url =
      input.ecosystem === 'npm'
        ? `https://registry.npmjs.org/${encodeURIComponent(input.name)}/latest`
        : `https://pypi.org/pypi/${encodeURIComponent(input.name)}/json`;
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 256 * 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = JSON.parse(new TextDecoder().decode(combined)) as { version?: unknown; info?: { version?: unknown } };
    const version = input.ecosystem === 'npm' ? body.version : body.info?.version;
    return typeof version === 'string' ? version.slice(0, 24) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeDependencies(
  files: AnalyzedFile[],
  options: { timeoutMs: number; maxPackages: number },
): Promise<DependencyRow[]> {
  const inputs = packageInputs(files).slice(0, options.maxPackages);
  const rows: DependencyRow[] = [];
  for (const input of inputs) {
    const installed = input.installed.slice(0, 24);
    const latest = await fetchLatest(input, options.timeoutMs);
    rows.push([input.name.slice(0, 64), installed, latest ?? 'Unavailable', latest ? classify(installed, latest) : 'unknown']);
  }
  return rows;
}
