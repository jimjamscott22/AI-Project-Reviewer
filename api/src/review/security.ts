import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { config } from '../config.js';
import type { SecurityFinding } from '../types.js';
import type { AnalyzedFile } from './contracts.js';
import { assertChildPath, runBounded } from './workspace.js';

const HIGH_RISK_NAMES = new Set(['.env', 'id_rsa', 'id_dsa', 'credentials.json', 'service-account.json']);
const CREDENTIAL_CONFIG_NAMES = new Set(['.npmrc', '.pypirc']);
const SECRET_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'Private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'GitHub access token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'Slack access token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
];

async function optionalGitleaks(root: string): Promise<SecurityFinding[]> {
  if (!config.review.gitleaksPath) return [];
  try {
    if (!(await stat(config.review.gitleaksPath)).isFile()) return [];
  } catch {
    return [];
  }
  await mkdir(config.review.workRoot, { recursive: true });
  const reportPath = assertChildPath(config.review.workRoot, path.join(config.review.workRoot, `gitleaks-${randomUUID()}.json`));
  try {
    await runBounded(
      config.review.gitleaksPath,
      ['detect', '--source', root, '--no-banner', '--redact', '--report-format', 'json', '--report-path', reportPath, '--exit-code', '0'],
      { timeoutMs: Math.min(config.review.cloneTimeoutMs, 60_000) },
    );
    if ((await stat(reportPath)).size > 256 * 1024) {
      return [['info', 'Optional gitleaks report was truncated', 'The gitleaks result exceeded the configured safe report size; built-in checks still completed.']];
    }
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as { Description?: unknown; File?: unknown; StartLine?: unknown }[];
    return report.slice(0, 20).map((finding) => [
      'high',
      typeof finding.Description === 'string' ? finding.Description.slice(0, 255) : 'Potential secret detected by gitleaks',
      `Gitleaks reported a redacted match in ${typeof finding.File === 'string' ? finding.File : 'a repository file'}${typeof finding.StartLine === 'number' ? ` at line ${finding.StartLine}` : ''}.`,
    ]);
  } catch {
    return [['info', 'Optional gitleaks scan unavailable', 'The built-in bounded secret checks completed, but the configured gitleaks scan did not.']];
  } finally {
    await rm(reportPath, { force: true });
  }
}

export async function scanSecurity(root: string, files: AnalyzedFile[]): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  for (const file of files) {
    const basename = path.posix.basename(file.path).toLowerCase();
    const riskyEnvironmentFile = /^\.env(?:\..+)?$/.test(basename) && !/^\.env\.(?:example|sample|template)$/.test(basename);
    if (HIGH_RISK_NAMES.has(basename)) {
      findings.push(['high', 'Risky credential filename committed', `${file.path} should be removed from version control and rotated if it contained credentials.`]);
    }
    if (riskyEnvironmentFile && basename !== '.env') {
      findings.push(['med', 'Environment-specific configuration committed', `${file.path} may be intentional for public client settings; verify that it contains no credentials or server-side secrets.`]);
    }
    if (CREDENTIAL_CONFIG_NAMES.has(basename)) {
      findings.push(['med', 'Credential-capable package configuration committed', `${file.path} can safely contain non-secret settings, but verify that it does not contain registry credentials.`]);
    }
    for (const secret of SECRET_PATTERNS) {
      if (secret.pattern.test(file.content)) {
        findings.push(['high', `${secret.label} detected`, `A redacted ${secret.label.toLowerCase()} pattern was found in ${file.path}; rotate it and purge repository history.`]);
      }
    }
  }
  findings.push(...(await optionalGitleaks(root)));
  if (findings.length === 0) {
    findings.push(['ok', 'No high-confidence committed secrets detected', 'The bounded static scan found no recognized secret patterns or risky credential filenames.']);
  }
  return findings.slice(0, 20);
}
