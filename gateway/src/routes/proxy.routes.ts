import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

const createServiceProxy = (target: string, serviceName: string) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^/api/${serviceName}`]: '/api' },
    on: {
      error: (err, _req, res) => {
        logger.error({ err, service: serviceName }, 'Proxy error');
        // res may be a Socket or a ServerResponse; guard before calling .status()
        if ('status' in res && typeof res.status === 'function') {
          (res as import('express').Response).status(502).json({
            success: false,
            error: { message: `${serviceName} is unavailable` },
          });
        }
      },
    },
  });

router.use('/users', createServiceProxy(config.services.user, 'users'));
router.use('/orders', createServiceProxy(config.services.order, 'orders'));
router.use('/payments', createServiceProxy(config.services.payment, 'payments'));
router.use('/inventory', createServiceProxy(config.services.inventory, 'inventory'));
router.use('/notifications', createServiceProxy(config.services.notification, 'notifications'));

export default router;
