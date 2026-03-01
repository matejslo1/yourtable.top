import { Router, Request, Response, NextFunction } from 'express';
import { createWaitlistSchema } from '@yourtable/shared';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addToWaitlist, getWaitlist, offerSpot,
  acceptWaitlistOffer, removeFromWaitlist,
} from '../services/waitlistService.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/waitlist
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const entries = await getWaitlist(req.tenantId!, date);
    res.json({ data: entries });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/waitlist
 */
router.post(
  '/',
  validate(createWaitlistSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await addToWaitlist({
        tenantId: req.tenantId!,
        guestId: req.body.guestId,
        guestName: req.body.guestName,
        guestEmail: req.body.guestEmail,
        guestPhone: req.body.guestPhone,
        date: new Date(req.body.date),
        time: req.body.time,
        partySize: req.body.partySize,
      });
      res.status(201).json({ data: entry });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/waitlist/:id/offer
 */
router.post('/:id/offer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await offerSpot(req.params.id, req.tenantId!, req.user!.id);
    res.json({ data: entry });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/waitlist/:id/accept
 */
router.post('/:id/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await acceptWaitlistOffer(req.params.id, req.tenantId!);
    res.json({ data: entry });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/waitlist/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeFromWaitlist(req.params.id, req.tenantId!);
    res.json({ data: { message: 'Removed from waitlist' } });
  } catch (error) {
    next(error);
  }
});

export default router;
