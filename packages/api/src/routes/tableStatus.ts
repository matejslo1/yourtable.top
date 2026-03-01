import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getTableStatuses } from '../services/tableStatus.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/tables/status?date=YYYY-MM-DD&time=HH:mm
 * Admin: Real-time table status for floor view
 */
router.get(
  '/status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date, time, duration } = req.query;

      const queryDate = date ? new Date(date as string) : new Date();
      const queryTime = (time as string) || new Date().toTimeString().substring(0, 5);
      const queryDuration = duration ? parseInt(duration as string, 10) : 90;

      const statuses = await getTableStatuses(
        req.tenantId!,
        queryDate,
        queryTime,
        queryDuration
      );

      res.json({ data: statuses });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
