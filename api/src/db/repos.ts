import type { RowDataPacket } from 'mysql2';
import { pool } from './pool.js';
import { relativeTime, formatLoc } from '../lib/format.js';
import type {
  CategoryTuple,
  DependencyRow,
  PortfolioCheck,
  QualityFinding,
  Repo,
  SecurityFinding,
  Severity,
  SummaryItemTuple,
  RepositorySummary,
  ReviewJobStatus,
} from '../types.js';

interface RepoReviewRow extends RowDataPacket {
  repo_id: number;
  slug: string;
  name: string;
  url: string;
  visibility: 'Public' | 'Private';
  language: string;
  framework: string;
  hue: number;
  review_id: number;
  overall_score: number;
  grade: string;
  ai_summary: string;
  generated_at: Date;
}

// One row per repo, joined to its most recently generated review. Repos with
// no review yet (freshly connected via POST /api/repos, before the review
// pipeline in M3 has run) are left out — there's nothing yet to show them with.
async function fetchRepoReviewRows(slug?: string): Promise<RepoReviewRow[]> {
  const [rows] = await pool.query<RepoReviewRow[]>(
    `SELECT r.id AS repo_id, r.slug, r.name, r.url, r.visibility, r.language, r.framework, r.hue,
            rv.id AS review_id, rv.overall_score, rv.grade, rv.ai_summary, rv.generated_at
     FROM repos r
     JOIN reviews rv ON rv.id = (
       SELECT id FROM reviews WHERE repo_id = r.id ORDER BY generated_at DESC, id DESC LIMIT 1
     )
     ${slug ? 'WHERE r.slug = ?' : ''}
     ORDER BY r.name`,
    slug ? [slug] : [],
  );
  return rows;
}

async function groupByReviewId<T extends RowDataPacket>(reviewIds: number[], sql: string): Promise<Map<number, T[]>> {
  const map = new Map<number, T[]>();
  if (reviewIds.length === 0) return map;
  const [rows] = await pool.query<T[]>(sql, [reviewIds]);
  for (const row of rows) {
    const list = map.get(row.review_id) ?? [];
    list.push(row);
    map.set(row.review_id, list);
  }
  return map;
}

export async function listRepos(): Promise<Repo[]> {
  return assembleRepos(await fetchRepoReviewRows());
}

export async function getRepoBySlug(slug: string): Promise<Repo | null> {
  const repos = await assembleRepos(await fetchRepoReviewRows(slug));
  return repos[0] ?? null;
}

async function assembleRepos(repoRows: RepoReviewRow[]): Promise<Repo[]> {
  if (repoRows.length === 0) return [];
  const reviewIds = repoRows.map((r) => r.review_id);

  const [summaryByReview, catsByReview, itemsByReview, portfolioByReview, checksByReview, metricsByReview, findingsByReview, depsByReview, statsByReview] =
    await Promise.all([
      groupByReviewId<RowDataPacket & { review_id: number; icon: string; label: string; value: string; tone: string }>(
        reviewIds,
        'SELECT review_id, icon, label, value, tone FROM review_summary_items WHERE review_id IN (?) ORDER BY review_id, position',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; category: string; icon: string; score: number }>(
        reviewIds,
        'SELECT review_id, category, icon, score FROM review_categories WHERE review_id IN (?) ORDER BY review_id, position',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; kind: string; body: string }>(
        reviewIds,
        'SELECT review_id, kind, body FROM review_items WHERE review_id IN (?) ORDER BY review_id, kind, position',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; verdict: string; blurb: string; footer: string }>(
        reviewIds,
        'SELECT review_id, verdict, blurb, footer FROM portfolio_readiness WHERE review_id IN (?)',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; label: string; done: number }>(
        reviewIds,
        'SELECT review_id, label, done FROM portfolio_checks WHERE review_id IN (?) ORDER BY review_id, position',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; label: string; value: string }>(
        reviewIds,
        'SELECT review_id, label, value FROM quality_metrics WHERE review_id IN (?) ORDER BY review_id, position',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; tab: string; severity: Severity; title: string; detail: string | null }>(
        reviewIds,
        'SELECT review_id, tab, severity, title, detail FROM findings WHERE review_id IN (?) ORDER BY review_id, tab, position',
      ),
      groupByReviewId<RowDataPacket & { review_id: number; package: string; installed: string; latest: string; status: string }>(
        reviewIds,
        'SELECT review_id, package, installed, latest, status FROM dependencies WHERE review_id IN (?) ORDER BY review_id, position',
      ),
      groupByReviewId<
        RowDataPacket & { review_id: number; loc: number; open_issues: number; prs: number; contributors: number; structure: string }
      >(reviewIds, 'SELECT review_id, loc, open_issues, prs, contributors, structure FROM repo_stats WHERE review_id IN (?)'),
    ]);

  return repoRows.map((row): Repo => {
    const summary = summaryByReview.get(row.review_id) ?? [];
    const cats = catsByReview.get(row.review_id) ?? [];
    const items = itemsByReview.get(row.review_id) ?? [];
    const portfolio = portfolioByReview.get(row.review_id)?.[0];
    const checks = checksByReview.get(row.review_id) ?? [];
    const metrics = metricsByReview.get(row.review_id) ?? [];
    const findings = findingsByReview.get(row.review_id) ?? [];
    const deps = depsByReview.get(row.review_id) ?? [];
    const stats = statsByReview.get(row.review_id)?.[0];

    const qualityFindings: QualityFinding[] = findings
      .filter((f) => f.tab === 'quality')
      .map((f) => [f.severity, f.title]);
    const securityFindings: SecurityFinding[] = findings
      .filter((f) => f.tab === 'security')
      .map((f) => [f.severity, f.title, f.detail ?? '']);

    return {
      id: row.slug,
      name: row.name,
      vis: row.visibility,
      url: row.url,
      updated: relativeTime(row.generated_at),
      hue: row.hue,
      lang: row.language,
      framework: row.framework,
      loc: formatLoc(stats?.loc ?? 0),
      issues: stats?.open_issues ?? 0,
      prs: stats?.prs ?? 0,
      contributors: stats?.contributors ?? 1,
      score: row.overall_score,
      summary: summary.map((s): SummaryItemTuple => [s.icon, s.label, s.value, (s.tone as SummaryItemTuple[3]) || '']),
      cats: cats.map((c): CategoryTuple => [c.category, c.icon, c.score]),
      strengths: items.filter((i) => i.kind === 'strength').map((i) => i.body),
      improves: items.filter((i) => i.kind === 'improvement').map((i) => i.body),
      steps: items.filter((i) => i.kind === 'next_step').map((i) => i.body),
      portfolio: {
        verdict: portfolio?.verdict ?? '',
        blurb: portfolio?.blurb ?? '',
        footer: portfolio?.footer ?? '',
        checks: checks.map((c): PortfolioCheck => [c.label, c.done ? 1 : 0]),
      },
      ai: row.ai_summary,
      quality: { metrics: metrics.map((m): [string, string] => [m.label, m.value]), findings: qualityFindings },
      structure: stats ? stats.structure.split('\n') : [],
      deps: deps.map((d): DependencyRow => [d.package, d.installed, d.latest, d.status as DependencyRow[3]]),
      security: securityFindings,
    };
  });
}

export interface CreateRepoInput {
  slug: string;
  name: string;
  url: string;
  canonicalUrl: string;
  visibility?: 'Public' | 'Private';
  language?: string;
  framework?: string;
  hue?: number;
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

export async function createRepo(input: CreateRepoInput): Promise<RepositorySummary> {
  const hue = input.hue ?? hashHue(input.slug);
  await pool.query(
    'INSERT INTO repos (slug, name, url, canonical_url, visibility, language, framework, hue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [input.slug, input.name, input.url, input.canonicalUrl, input.visibility ?? 'Public', input.language ?? '', input.framework ?? '', hue],
  );
  const created = await getRepositorySummary(input.slug);
  if (!created) throw new Error(`Repository "${input.slug}" was inserted but could not be read back.`);
  return created;
}

interface RepositorySummaryRow extends RowDataPacket {
  slug: string;
  name: string;
  canonical_url: string | null;
  url: string;
  connected_at: Date;
  latest_review_id: number | null;
  latest_score: number | null;
  latest_review_at: Date | null;
  latest_job_id: string | null;
  latest_job_status: ReviewJobStatus | null;
  latest_job_error_code: string | null;
  latest_job_error_message: string | null;
}

function mapRepositorySummary(row: RepositorySummaryRow): RepositorySummary {
  return {
    id: row.slug,
    name: row.name,
    url: row.canonical_url ?? row.url,
    connectedAt: row.connected_at.toISOString(),
    latestReviewId: row.latest_review_id,
    latestScore: row.latest_score,
    latestReviewAt: row.latest_review_at?.toISOString() ?? null,
    latestJob:
      row.latest_job_id && row.latest_job_status
        ? {
            id: row.latest_job_id,
            status: row.latest_job_status,
            error:
              row.latest_job_error_code || row.latest_job_error_message
                ? { code: row.latest_job_error_code ?? 'review_failed', message: row.latest_job_error_message ?? 'The review failed.' }
                : null,
          }
        : null,
  };
}

async function fetchRepositorySummaryRows(slug?: string): Promise<RepositorySummaryRow[]> {
  const [rows] = await pool.query<RepositorySummaryRow[]>(
    `SELECT r.slug, r.name, r.url, r.canonical_url, r.connected_at,
            rv.id AS latest_review_id, rv.overall_score AS latest_score, rv.generated_at AS latest_review_at,
            j.id AS latest_job_id, j.status AS latest_job_status,
            j.error_code AS latest_job_error_code, j.error_message AS latest_job_error_message
     FROM repos r
     LEFT JOIN reviews rv ON rv.id = (
       SELECT id FROM reviews WHERE repo_id = r.id ORDER BY generated_at DESC, id DESC LIMIT 1
     )
     LEFT JOIN review_jobs j ON j.id = (
       SELECT id FROM review_jobs WHERE repo_id = r.id ORDER BY requested_at DESC, id DESC LIMIT 1
     )
     ${slug ? 'WHERE r.slug = ?' : ''}
     ORDER BY r.name`,
    slug ? [slug] : [],
  );
  return rows;
}

export async function listConnectedRepositories(): Promise<RepositorySummary[]> {
  return (await fetchRepositorySummaryRows()).map(mapRepositorySummary);
}

export async function getRepositorySummary(slug: string): Promise<RepositorySummary | null> {
  const rows = await fetchRepositorySummaryRows(slug);
  return rows[0] ? mapRepositorySummary(rows[0]) : null;
}

export async function updateRepositoryMetadata(id: number, language: string, framework: string): Promise<void> {
  await pool.query('UPDATE repos SET language = ?, framework = ? WHERE id = ?', [language.slice(0, 64), framework.slice(0, 64), id]);
}
