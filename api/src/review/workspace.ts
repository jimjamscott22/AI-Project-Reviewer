import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

export class BoundedCommandError extends Error {
  constructor(
    message: string,
    readonly code: 'command_timeout' | 'command_failed' | 'command_output_limit',
  ) {
    super(message);
    this.name = 'BoundedCommandError';
  }
}

export function assertChildPath(parent: string, candidate: string): string {
  const resolvedParent = path.resolve(parent);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedParent, resolvedCandidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Repository workspace path must be a distinct child of REPO_WORK_ROOT.');
  }
  return resolvedCandidate;
}

export async function runBounded(
  executable: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; outputBytes?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  const timeout = options.timeoutMs ?? config.review.cloneTimeoutMs;
  const maxBuffer = options.outputBytes ?? config.review.commandOutputBytes;
  try {
    const result = await execFileAsync(executable, args, {
      cwd: options.cwd,
      timeout,
      maxBuffer,
      windowsHide: true,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_ASKPASS: '',
        LC_ALL: 'C',
      },
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { killed?: boolean };
    if (cause.killed || cause.code === 'ETIMEDOUT') {
      throw new BoundedCommandError('The repository command exceeded its time limit.', 'command_timeout');
    }
    if (cause.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new BoundedCommandError('The repository command exceeded its output limit.', 'command_output_limit');
    }
    throw new BoundedCommandError('The repository command failed.', 'command_failed');
  }
}

export interface PreparedRepository {
  root: string;
  cleanup(): Promise<void>;
}

export async function prepareRepository(url: string): Promise<PreparedRepository> {
  await mkdir(config.review.workRoot, { recursive: true });
  const hooksPath = assertChildPath(config.review.workRoot, path.join(config.review.workRoot, 'disabled-hooks'));
  await mkdir(hooksPath, { recursive: true });
  const key = createHash('sha256').update(url).digest('hex').slice(0, 24);
  const repositoryRoot = assertChildPath(config.review.workRoot, path.join(config.review.workRoot, `repo-${key}`));

  let existing = false;
  try {
    existing = (await stat(path.join(repositoryRoot, '.git'))).isDirectory();
  } catch {
    existing = false;
  }

  const gitConfig = ['-c', `core.hooksPath=${hooksPath}`, '-c', 'submodule.recurse=false'];
  if (existing) {
    await runBounded('git', [...gitConfig, 'fetch', '--depth', '50', '--no-tags', 'origin'], { cwd: repositoryRoot });
    await runBounded('git', [...gitConfig, 'reset', '--hard', 'FETCH_HEAD'], { cwd: repositoryRoot });
    await runBounded('git', [...gitConfig, 'clean', '-ffd'], { cwd: repositoryRoot });
  } else {
    await rm(repositoryRoot, { recursive: true, force: true });
    try {
      await runBounded('git', [
        ...gitConfig,
        'clone',
        '--depth',
        '50',
        '--no-tags',
        '--no-recurse-submodules',
        '--',
        url,
        repositoryRoot,
      ]);
    } catch (error) {
      await rm(repositoryRoot, { recursive: true, force: true });
      throw error;
    }
  }

  return { root: repositoryRoot, cleanup: async () => undefined };
}
