import { Request, Response } from 'express';

export const healthCheck = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    service: 'notification-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};
