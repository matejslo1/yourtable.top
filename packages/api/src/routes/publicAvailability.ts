import { Router, Request, Response, NextFunction } from 'express';
import { availabilityQuerySchema } from '@yourtable/shared';
import { resolveTenant } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getAvailability } from '../services/availability.js';
import { getTableStatuses } from '../services/tableStatus.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/public/:tenantSlug/availability
 * Public: Get availability for a date (booking widget)
 */
router.get(
  '/:tenantSlug/availability',
  resolveTenant,
  validate(availabilityQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { date, partySize } = req.query as { date: string; partySize?: string };

      const result = await getAvailability({
        tenantId: req.tenantId!,
        date: new Date(date),
        partySize: partySize ? parseInt(partySize, 10) : undefined,
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
