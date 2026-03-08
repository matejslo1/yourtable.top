import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ─── Seating Config ──────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.findUnique({ where: { tenantId: req.user!.tenantId } });
    res.status(200).json(config ?? {});
  } catch (err) { next(err); }
});

router.put('/', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.upsert({
      where: { tenantId: req.user!.tenantId },
      update: req.body,
      create: { ...req.body, tenantId: req.user!.tenantId },
    });
    res.status(200).json(config);
  } catch (err) { next(err); }
});

// ─── Operating Hours (aliased for frontend compatibility) ────────────────────

router.get('/hours', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hours = await prisma.operatingHours.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { dayOfWeek: 'asc' } });
    res.status(200).json({ data: hours });
  } catch (err) { next(err); }
});

router.put('/hours', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { hours } = req.body as { hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; lastReservation: string; isClosed: boolean; slotDurationMin: number }> };
    const upserts = hours.map((h) =>
      prisma.operatingHours.upsert({
        where: { tenantId_dayOfWeek: { tenantId: req.user!.tenantId, dayOfWeek: h.dayOfWeek } },
        update: h,
        create: { ...h, tenantId: req.user!.tenantId },
      })
    );
    const result = await prisma.$transaction(upserts);
    res.status(200).json({ data: result });
  } catch (err) { next(err); }
});

// Keep old route for backward compatibility
router.get('/operating-hours', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const hours = await prisma.operatingHours.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { dayOfWeek: 'asc' } });
    res.status(200).json(hours);
  } catch (err) { next(err); }
});

router.put('/operating-hours', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { hours } = req.body as { hours: any[] };
    const upserts = hours.map((h: any) =>
      prisma.operatingHours.upsert({
        where: { tenantId_dayOfWeek: { tenantId: req.user!.tenantId, dayOfWeek: h.dayOfWeek } },
        update: h,
        create: { ...h, tenantId: req.user!.tenantId },
      })
    );
    const result = await prisma.$transaction(upserts);
    res.status(200).json(result);
  } catch (err) { next(err); }
});

// ─── Seating Config (aliased) ────────────────────────────────────────────────

router.get('/seating', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.findUnique({ where: { tenantId: req.user!.tenantId } });
    res.status(200).json({ data: config ?? {} });
  } catch (err) { next(err); }
});

router.put('/seating', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.upsert({
      where: { tenantId: req.user!.tenantId },
      update: req.body,
      create: { ...req.body, tenantId: req.user!.tenantId },
    });
    res.status(200).json({ data: config });
  } catch (err) { next(err); }
});

// ─── Special Days CRUD ───────────────────────────────────────────────────────

router.get('/special-days', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = await prisma.specialDate.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { date: 'asc' },
    });
    res.status(200).json({ data: days });
  } catch (err) { next(err); }
});

router.post('/special-days', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, isClosed, customHours, note } = req.body;
    if (!date) {
      res.status(400).json({ error: 'BadRequest', message: 'date is required', statusCode: 400 });
      return;
    }
    const specialDate = await prisma.specialDate.upsert({
      where: { tenantId_date: { tenantId: req.user!.tenantId, date: new Date(`${date}T00:00:00`) } },
      update: { isClosed: isClosed ?? false, customHours: customHours ?? null, note: note ?? null },
      create: {
        tenantId: req.user!.tenantId,
        date: new Date(`${date}T00:00:00`),
        isClosed: isClosed ?? false,
        customHours: customHours ?? null,
        note: note ?? null,
      },
    });
    res.status(201).json({ data: specialDate });
  } catch (err) { next(err); }
});

router.delete('/special-days/:id', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.specialDate.deleteMany({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

// Service periods are stored in tenant.settings.servicePeriods
router.get('/service-periods', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as any;
    res.status(200).json({ data: Array.isArray(settings.servicePeriods) ? settings.servicePeriods : [] });
  } catch (err) { next(err); }
});

router.put('/service-periods', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { periods } = req.body as { periods?: any[] };
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as any;
    const nextSettings = { ...settings, servicePeriods: Array.isArray(periods) ? periods : [] };
    await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { settings: nextSettings as any },
    });
    res.status(200).json({ data: nextSettings.servicePeriods });
  } catch (err) { next(err); }
});

// Integrations hub settings placeholder (resend/twilio/stripe toggles)
router.get('/integrations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as any;
    res.status(200).json({ data: settings.integrations ?? {} });
  } catch (err) { next(err); }
});

router.put('/integrations', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as any;
    const nextSettings = { ...settings, integrations: req.body ?? {} };
    await prisma.tenant.update({ where: { id: req.user!.tenantId }, data: { settings: nextSettings as any } });
    res.status(200).json({ data: nextSettings.integrations });
  } catch (err) { next(err); }
});

export default router;
