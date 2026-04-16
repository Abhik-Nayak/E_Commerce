import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

router.use(healthRoutes);

// Future: order CRUD routes
// router.use('/orders', orderRoutes);

export { router as routes };
