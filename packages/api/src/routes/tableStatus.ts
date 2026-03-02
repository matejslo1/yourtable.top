import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/tables/status?date=YYYY-MM-DD
router.get('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date } = req.query;
    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: req.user!.tenantId,
        date: date ? new Date(date as string) : undefined,
        status: { in: ['HOLD', 'CONFIRMED', 'SEATED'] },
      },
      include: { tables: true },
    });
    res.status(200).json(reservations);
  } catch (err) { next(err); }
});

export default router;
