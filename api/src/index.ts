import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { repoRoutes } from './routes/repos.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });
await app.register(healthRoutes);
await app.register(repoRoutes);

app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
