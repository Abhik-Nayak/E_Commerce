import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes';
import { connectDB } from './db';
import { startAllConsumers } from './events/consumers/all-events.consumer';

const app = express();

// ── Security ──────────────────────────────────────────
app.use(helmet());
app.use(cors());

// ── Body Parsing ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────
app.use('/api', routes);

// ── Error Handler ─────────────────────────────────────
app.use(errorMiddleware);

// ── Start ─────────────────────────────────────────────
async function bootstrap() {
  await connectDB();

  startAllConsumers().catch(err => logger.error({ err }, 'Notification consumers failed'));

  app.listen(config.port, () => {
    logger.info(`🚀 Notification Service running on http://localhost:${config.port}`);
    logger.info(`   Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start Notification Service');
  process.exit(1);
});

export default app;
