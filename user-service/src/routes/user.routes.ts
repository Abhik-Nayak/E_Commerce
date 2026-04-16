import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as userService from '../services/user.service';
import { authMiddleware, AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
});

// GET /api/users/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = updateUserSchema.parse(req.body);
    const user = await userService.updateUser(req.params.id, input);
    res.json({ success: true, data: user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { message: 'Validation failed', details: err.errors } });
      return;
    }
    next(err);
  }
});

export default router;
