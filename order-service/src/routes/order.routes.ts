import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as orderService from '../services/order.service';

const router = Router();

const createOrderSchema = z.object({
  userId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }),
});

// POST /api/orders
router.post('/', async (req: import('express').Request, res: Response, next: NextFunction) => {
  try {
    const input = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder(input);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { message: 'Validation failed', details: err.errors } });
      return;
    }
    next(err);
  }
});

// GET /api/orders/:id
router.get('/:id', async (req: import('express').Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderById(req.params.id as string);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders?userId=xxx
router.get('/', async (req: import('express').Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ success: false, error: { message: 'userId query parameter is required' } });
      return;
    }
    const orders = await orderService.getOrdersByUser(userId);
    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/:id/cancel
router.put('/:id/cancel', async (req: import('express').Request, res: Response, next: NextFunction) => {
  try {
    const result = await orderService.cancelOrder(req.params.id as string, req.body.reason);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
