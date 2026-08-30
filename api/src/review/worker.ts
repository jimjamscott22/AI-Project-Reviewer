import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { claimNextJob, completeJob, failJob, updateJobStage, type ClaimedReviewJob } from '../db/jobs.js';
import { updateRepositoryMetadata } from '../db/repos.js';
import { persistReview } from '../db/reviews.js';
import { getReviewerSettings } from '../db/settings.js';
import { analyzeRepository, AnalysisLimitError } from './analyze.js';
import { applyNarrative, generateNarrative } from './narrative.js';
import { scoreAnalysis } from './scoring.js';
import { BoundedCommandError, prepareRepository } from './workspace.js';

export interface WorkerControl {
  wake(): void;
  stop(): Promise<void>;
}

function safeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof AnalysisLimitError) {
    return { code: error.code, message: error.message.slice(0, 512) };
  }
  if (error instanceof BoundedCommandError) {
    return { code: error.code, message: error.message.slice(0, 512) };
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return { code: 'analysis_timeout', message: 'The repository review exceeded its time limit.' };
  }
  return { code: 'review_failed', message: 'The repository could not be reviewed safely. Check the repository URL and try again.' };
}

async function processJob(app: FastifyInstance, job: ClaimedReviewJob): Promise<void> {
  let cleanup: (() => Promise<void>) | null = null;
  try {
    const prepared = await prepareRepository(job.repositoryUrl);
    cleanup = prepared.cleanup;
    await updateJobStage(job.id, 'analyzing');
    const analysis = await analyzeRepository(prepared.root, { repositoryName: job.repositoryName });
    await updateRepositoryMetadata(job.repositoryDatabaseId, analysis.language, analysis.framework);
    await updateJobStage(job.id, 'narrating');
    const scored = scoreAnalysis(analysis);
    const settings = await getReviewerSettings();
    const generated = await generateNarrative(scored, settings);
    const review = applyNarrative(scored, generated.narrative);
    await updateJobStage(job.id, 'persisting');
    const reviewId = await persistReview(job.repositoryDatabaseId, review);
    await completeJob(job.id, reviewId);
    app.log.info({ jobId: job.id, reviewId, narrativeSource: generated.source }, 'Completed repository review.');
  } catch (error) {
    const failure = safeFailure(error);
    await failJob(job.id, failure);
    app.log.warn({ jobId: job.id, errorCode: failure.code }, 'Repository review failed safely.');
  } finally {
    await cleanup?.();
  }
}

export function startWorker(app: FastifyInstance): WorkerControl {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let active: Promise<void> | null = null;

  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      wake();
    }, config.review.workerPollMs);
    timer.unref();
  };

  const drain = async () => {
    try {
      while (!stopped) {
        const job = await claimNextJob();
        if (!job) break;
        await processJob(app, job);
      }
    } catch {
      app.log.warn({ errorCode: 'worker_database_unavailable' }, 'Review worker is waiting for MariaDB.');
    }
  };

  const wake = () => {
    if (stopped || active) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    active = drain().finally(() => {
      active = null;
      schedule();
    });
  };

  const stop = async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    await active;
  };

  app.addHook('onClose', stop);
  wake();
  return { wake, stop };
}
