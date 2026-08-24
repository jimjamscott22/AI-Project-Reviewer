import { config } from './config.js';
import { recoverRunningJobs } from './db/jobs.js';
import { startWorker } from './review/worker.js';
import { buildServer } from './server.js';

const app = await buildServer();

try {
  const recoveredJobs = await recoverRunningJobs();
  if (recoveredJobs > 0) app.log.warn({ recoveredJobs }, 'Requeued review jobs interrupted by the previous process.');
} catch (error) {
  app.log.warn({ error }, 'Review job recovery is deferred until MariaDB is available.');
}

startWorker(app);

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await app.close();
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
