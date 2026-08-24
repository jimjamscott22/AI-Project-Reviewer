import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeGitHubUrl, GitHubUrlError } from '../src/lib/github.js';

test('canonicalizes a public GitHub HTTPS repository URL', () => {
  assert.deepEqual(canonicalizeGitHubUrl(' https://github.com/Example/Project.git/ '), {
    owner: 'Example',
    repository: 'Project',
    canonicalUrl: 'https://github.com/example/project',
    slug: 'example-project',
  });
});

for (const url of [
  'http://github.com/example/project',
  'https://gitlab.com/example/project',
  'https://user:secret@github.com/example/project',
  'https://github.com/example/project/issues',
  'https://github.com/example/project?tab=readme',
  'git@github.com:example/project.git',
]) {
  test(`rejects unsupported repository URL: ${url}`, () => {
    assert.throws(() => canonicalizeGitHubUrl(url), GitHubUrlError);
  });
}
