import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Webhook (no auth)
router.post('/webhook', (req: Request, res: Response) => {
  // TODO: Implement Stripe webhook handling
  res.status(200).json({ received: true });
});

router.use(requireAuth);

// GET /api/v1/payments
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ payments: [] });
  } catch (err) { next(err); }
});

export default router;
