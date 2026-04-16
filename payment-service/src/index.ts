import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes';
import { initDB } from './db';
import { startOrderConsumer } from './events/consumers/order.consumer';

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
  await initDB();

  startOrderConsumer().catch(err => logger.error({ err }, 'Order consumer failed'));

  app.listen(config.port, () => {
    logger.info(`🚀 Payment Service running on http://localhost:${config.port}`);
    logger.info(`   Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start Payment Service');
  process.exit(1);
});

export default app;
