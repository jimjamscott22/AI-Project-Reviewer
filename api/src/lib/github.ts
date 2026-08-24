import { slugify } from './slug.js';

const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY_PATTERN = /^[a-z\d._-]{1,100}$/i;

export class GitHubUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubUrlError';
  }
}

export interface CanonicalGitHubRepository {
  owner: string;
  repository: string;
  canonicalUrl: string;
  slug: string;
}

export function canonicalizeGitHubUrl(input: string): CanonicalGitHubRepository {
  const value = input.trim();
  if (!value || value.includes('?') || value.includes('#') || value.includes('%')) {
    throw new GitHubUrlError('Enter a public GitHub repository URL without query parameters or fragments.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GitHubUrlError('Enter a complete URL such as https://github.com/owner/repository.');
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.port || url.username || url.password) {
    throw new GitHubUrlError('Only public https://github.com repository URLs are supported.');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new GitHubUrlError('The URL must identify one repository: https://github.com/owner/repository.');
  }

  const [owner, repositorySegment] = segments;
  if (!owner || !repositorySegment) {
    throw new GitHubUrlError('The URL must identify one repository: https://github.com/owner/repository.');
  }
  const repository = repositorySegment.replace(/\.git$/i, '');
  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(repository)) {
    throw new GitHubUrlError('The GitHub owner or repository name is invalid.');
  }

  const canonicalUrl = `https://github.com/${owner.toLowerCase()}/${repository.toLowerCase()}`;
  const slug = slugify(`${owner}-${repository}`);
  if (!slug) throw new GitHubUrlError('The repository URL does not produce a valid identifier.');

  return { owner, repository, canonicalUrl, slug };
}
