import { Router } from 'express';
import healthRoutes from './health.routes';

const router = Router();

router.use(healthRoutes);

// Future: auth & user routes
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);

export { router as routes };
