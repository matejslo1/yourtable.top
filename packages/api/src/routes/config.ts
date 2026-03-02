import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.findUnique({ where: { tenantId: req.user!.tenantId } });
    res.status(200).json(config ?? {});
  } catch (err) { next(err); }
});

router.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.upsert({
      where: { tenantId: req.user!.tenantId },
      update: req.body,
      create: { ...req.body, tenantId: req.user!.tenantId },
    });
    res.status(200).json(config);
  } catch (err) { next(err); }
});

router.get('/operating-hours', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hours = await prisma.operatingHours.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { dayOfWeek: 'asc' } });
    res.status(200).json(hours);
  } catch (err) { next(err); }
});

router.put('/operating-hours', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { hours } = req.body as { hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; lastReservation: string; isClosed: boolean; slotDurationMin: number }> };
    const upserts = hours.map((h) =>
      prisma.operatingHours.upsert({
        where: { tenantId_dayOfWeek: { tenantId: req.user!.tenantId, dayOfWeek: h.dayOfWeek } },
        update: h,
        create: { ...h, tenantId: req.user!.tenantId },
      }),
    );
    const result = await prisma.$transaction(upserts);
    res.status(200).json(result);
  } catch (err) { next(err); }
});

export default router;
