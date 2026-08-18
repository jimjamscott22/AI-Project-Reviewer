import type { FastifyInstance } from 'fastify';
import { createRepo, getRepoBySlug, listRepos } from '../db/repos.js';
import { slugify } from '../lib/slug.js';

interface ConnectRepoBody {
  url: string;
  name?: string;
  visibility?: 'Public' | 'Private';
  language?: string;
  framework?: string;
}

export async function repoRoutes(app: FastifyInstance) {
  app.get('/api/repos', async () => listRepos());

  app.get<{ Params: { id: string } }>('/api/repos/:id', async (req, reply) => {
    const repo = await getRepoBySlug(req.params.id);
    if (!repo) {
      reply.code(404);
      return { error: 'not_found', message: `No repo with id "${req.params.id}"` };
    }
    return repo;
  });

  app.post<{ Body: ConnectRepoBody }>('/api/repos', async (req, reply) => {
    const { url, name, visibility, language, framework } = req.body ?? ({} as ConnectRepoBody);
    if (!url || typeof url !== 'string') {
      reply.code(400);
      return { error: 'invalid_body', message: '"url" is required' };
    }
    const derivedName = name ?? url.replace(/^https?:\/\//, '').replace(/^github\.com\//, '').split('/').pop() ?? url;
    const slug = slugify(derivedName);
    try {
      const created = await createRepo({ slug, name: derivedName, url, visibility, language, framework });
      reply.code(201);
      return created;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ER_DUP_ENTRY') {
        reply.code(409);
        return { error: 'already_connected', message: `A repo with slug "${slug}" is already connected` };
      }
      throw err;
    }
  });
}
