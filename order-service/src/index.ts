import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes';

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
app.listen(config.port, () => {
  logger.info(`🚀 Order Service running on http://localhost:${config.port}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
});

export default app;
