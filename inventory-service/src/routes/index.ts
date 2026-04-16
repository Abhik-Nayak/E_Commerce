import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

router.use(healthRoutes);

// Future: inventory routes
// router.use('/inventory', inventoryRoutes);

export { router as routes };
