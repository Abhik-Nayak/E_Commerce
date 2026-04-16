import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

router.use(healthRoutes);

// Future: payment routes
// router.use('/payments', paymentRoutes);

export { router as routes };
