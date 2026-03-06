import { Router, Response, NextFunction } from 'express';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { getWaitlist, addToWaitlist, offerSpot, removeFromWaitlist } from '../services/waitlistService.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/waitlist?date=YYYY-MM-DD
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date ? new Date(`${req.query.date}T00:00:00`) : undefined;
    const entries = await getWaitlist(req.user!.tenantId, date);
    res.status(200).json({ data: entries });
  } catch (err) { next(err); }
});

// POST /api/v1/waitlist
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { guestName, guestEmail, guestPhone, date, time, partySize } = req.body;
    const entry = await addToWaitlist({
      tenantId: req.user!.tenantId,
      guestName, guestEmail, guestPhone,
      date: new Date(`${date}T00:00:00`),
      time, partySize,
    });
    res.status(201).json({ data: entry });
  } catch (err) { next(err); }
});

// POST /api/v1/waitlist/:id/offer
router.post('/:id/offer', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await offerSpot(req.params.id, req.user!.tenantId, req.user!.id);
    res.status(200).json({ data: entry });
  } catch (err) { next(err); }
});

// DELETE /api/v1/waitlist/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await removeFromWaitlist(req.params.id, req.user!.tenantId);
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

export default router;
