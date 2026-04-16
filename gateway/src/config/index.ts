import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  services: {
    user: process.env.USER_SERVICE_URL || 'http://localhost:4005',
    order: process.env.ORDER_SERVICE_URL || 'http://localhost:4001',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4002',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:4003',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
} as const;
