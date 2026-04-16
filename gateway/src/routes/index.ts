import { Router } from 'express';
import healthRoutes from './health.routes';
import proxyRoutes from './proxy.routes';

const router = Router();

router.use(healthRoutes);
router.use(proxyRoutes);

export { router as routes };
