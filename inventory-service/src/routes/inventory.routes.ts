import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as inventoryService from '../services/inventory.service';

const router = Router();

const restockSchema = z.object({
  quantity: z.number().int().positive(),
});

// GET /api/inventory — list all stock
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stock = await inventoryService.getAllStock();
    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/:productId — check stock for a product
router.get('/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stock = await inventoryService.getStock(req.params.productId);
    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/:productId — admin restock
router.put('/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity } = restockSchema.parse(req.body);
    const result = await inventoryService.adminRestock(req.params.productId, quantity);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { message: 'Validation failed', details: err.errors } });
      return;
    }
    next(err);
  }
});

export default router;
