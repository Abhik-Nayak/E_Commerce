import { Router } from 'express';
import healthRoutes from './health.routes';
import inventoryRoutes from './inventory.routes';

const router = Router();

router.use(healthRoutes);
router.use('/inventory', inventoryRoutes);

export { router as routes };
