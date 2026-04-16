import { Router, Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service';

const router = Router();

// GET /api/payments/:orderId
router.get('/:orderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.getPaymentByOrderId(req.params.orderId as string);
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:orderId/refund
router.post('/:orderId/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.refundPayment(req.params.orderId as string);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
