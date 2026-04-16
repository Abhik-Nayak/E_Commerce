import { Router } from 'express';
import healthRoutes from './health.routes';
import orderRoutes from './order.routes';

const router = Router();

router.use(healthRoutes);
router.use('/orders', orderRoutes);

export { router as routes };
