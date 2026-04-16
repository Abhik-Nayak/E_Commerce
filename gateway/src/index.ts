import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorMiddleware } from './middlewares/error.middleware';
import { routes } from './routes';

const app = express();

// ── Security ──────────────────────────────────────────
app.use(helmet());
app.use(cors());

// ── Rate Limiting ─────────────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests' } },
});
app.use(limiter);

// ── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────
app.use('/api', routes);

// ── Error Handler ─────────────────────────────────────
app.use(errorMiddleware);

// ── Start ─────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`🚀 Gateway running on http://localhost:${config.port}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
});

export default app;
