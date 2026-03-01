import { Router, Request, Response, NextFunction } from 'express';
import { createHoldSchema, completeHoldSchema } from '@yourtable/shared';
import { validate } from '../middleware/validate.js';
import { resolveTenant } from '../middleware/auth.js';
import { createHold, completeHold, abandonHold } from '../services/holdService.js';

const router = Router();

/**
 * POST /api/v1/public/:tenantSlug/hold
 * Create a HOLD (public - booking widget)
 */
router.post(
  '/:tenantSlug/hold',
  resolveTenant,
  validate(createHoldSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createHold({
        tenantId: req.tenantId!,
        date: new Date(req.body.date),
        time: req.body.time,
        partySize: req.body.partySize,
        durationMinutes: req.body.durationMinutes,
        sourceIp: req.ip || req.socket.remoteAddress,
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/public/:tenantSlug/hold/:id/complete
 * Complete a HOLD with guest details (public - booking widget)
 */
router.post(
  '/:tenantSlug/hold/:id/complete',
  resolveTenant,
  validate(completeHoldSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await completeHold({
        reservationId: req.params.id,
        tenantId: req.tenantId!,
        sessionToken: req.body.sessionToken,
        guestName: req.body.guestName,
        guestEmail: req.body.guestEmail,
        guestPhone: req.body.guestPhone,
        notes: req.body.notes,
        paymentIntentId: req.body.paymentIntentId,
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/public/:tenantSlug/hold/:id
 * Abandon a HOLD (Beacon API from widget)
 */
router.delete(
  '/:tenantSlug/hold/:id',
  resolveTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionToken } = req.body;
      await abandonHold(req.params.id, req.tenantId!, sessionToken);
      res.json({ data: { message: 'Hold released' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
