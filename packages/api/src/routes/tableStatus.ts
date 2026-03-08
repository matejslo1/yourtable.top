import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getTableStatuses } from '../services/tableStatus.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/tables/status?date=YYYY-MM-DD&time=HH:mm&duration=90
router.get('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const date = q.date ?? new Date().toISOString().slice(0, 10);
    const time = q.time ?? new Date().toTimeString().slice(0, 5);
    const duration = Math.max(parseInt(q.duration || '90', 10) || 90, 15);

    const floorPlans = await getTableStatuses(
      req.user!.tenantId,
      new Date(`${date}T00:00:00`),
      time,
      duration
    );

    res.status(200).json({ data: floorPlans });
  } catch (err) { next(err); }
});

export default router;
