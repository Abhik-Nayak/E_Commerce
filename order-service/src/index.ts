import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes';
import { initDB } from './db';
import { startPaymentConsumer } from './events/consumers/payment.consumer';
import { startInventoryConsumer } from './events/consumers/inventory.consumer';

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

  startPaymentConsumer().catch(err => logger.error({ err }, 'Payment consumer failed'));
  startInventoryConsumer().catch(err => logger.error({ err }, 'Inventory consumer failed'));

  app.listen(config.port, () => {
    logger.info(`🚀 Order Service running on http://localhost:${config.port}`);
    logger.info(`   Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start Order Service');
  process.exit(1);
});

export default app;
