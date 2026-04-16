import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

router.use(healthRoutes);

// Future: notification routes (mostly internal / Kafka-driven)

export { router as routes };
