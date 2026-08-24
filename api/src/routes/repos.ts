import type { FastifyInstance } from 'fastify';
import { createRepo, getRepoBySlug, listConnectedRepositories, listRepos } from '../db/repos.js';
import { createOrGetActiveJob } from '../db/jobs.js';
import { canonicalizeGitHubUrl, GitHubUrlError } from '../lib/github.js';

interface ConnectRepoBody {
  url: string;
  name?: string;
  visibility?: 'Public' | 'Private';
  language?: string;
  framework?: string;
}

export async function repoRoutes(app: FastifyInstance) {
  app.get('/api/repositories', async () => listConnectedRepositories());

  app.get('/api/repos', async () => listRepos());

  app.get<{ Params: { id: string } }>('/api/repos/:id', async (req, reply) => {
    const repo = await getRepoBySlug(req.params.id);
    if (!repo) {
      reply.code(404);
      return { error: 'not_found', message: `No repo with id "${req.params.id}"` };
    }
    return repo;
  });

  app.post<{ Params: { id: string } }>('/api/repos/:id/rerun', async (req, reply) => {
    const result = await createOrGetActiveJob(req.params.id);
    if (!result) {
      reply.code(404);
      return { error: 'not_found', message: `No repository with id "${req.params.id}"` };
    }
    reply.code(202);
    return { jobId: result.job.id, status: result.job.status };
  });

  app.post<{ Body: ConnectRepoBody }>('/api/repos', async (req, reply) => {
    const { url, name, visibility, language, framework } = req.body ?? ({} as ConnectRepoBody);
    if (!url || typeof url !== 'string') {
      reply.code(400);
      return { error: 'invalid_body', message: '"url" is required' };
    }
    if (name !== undefined && typeof name !== 'string') {
      reply.code(400);
      return { error: 'invalid_body', message: '"name" must be a string' };
    }
    if (language !== undefined && (typeof language !== 'string' || language.length > 64)) {
      reply.code(400);
      return { error: 'invalid_body', message: '"language" must be a string of 64 characters or fewer' };
    }
    if (framework !== undefined && (typeof framework !== 'string' || framework.length > 64)) {
      reply.code(400);
      return { error: 'invalid_body', message: '"framework" must be a string of 64 characters or fewer' };
    }
    if (visibility !== undefined && visibility !== 'Public' && visibility !== 'Private') {
      reply.code(400);
      return { error: 'invalid_body', message: '"visibility" must be "Public" or "Private"' };
    }

    try {
      if (visibility === 'Private') {
        reply.code(400);
        return { error: 'unsupported_repository', message: 'Private repositories are not supported in this release.' };
      }
      const github = canonicalizeGitHubUrl(url);
      const derivedName = name?.trim() || github.repository;
      if (derivedName.length > 128) {
        reply.code(400);
        return { error: 'invalid_body', message: '"name" must be 128 characters or fewer' };
      }
      const created = await createRepo({
        slug: github.slug,
        name: derivedName,
        url: github.canonicalUrl,
        canonicalUrl: github.canonicalUrl,
        visibility: 'Public',
        language,
        framework,
      });
      reply.code(201);
      return created;
    } catch (err: unknown) {
      if (err instanceof GitHubUrlError) {
        reply.code(400);
        return { error: 'invalid_repository_url', message: err.message };
      }
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ER_DUP_ENTRY') {
        reply.code(409);
        return { error: 'already_connected', message: 'That GitHub repository is already connected.' };
      }
      throw err;
    }
  });
}
