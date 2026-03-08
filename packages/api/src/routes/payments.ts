import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

function resolveDeposit(settings: any, params: { date: string; partySize: number; servicePeriod?: string }) {
  const policy = settings?.depositPolicy;
  if (!policy?.enabled) return { required: false, amount: 0, type: 'fixed', matchedRule: null };

  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  const dow = new Date(`${params.date}T00:00:00`).getDay();

  const matched = rules.find((r: any) => {
    const dayOk = !Array.isArray(r.daysOfWeek) || r.daysOfWeek.length === 0 || r.daysOfWeek.includes(dow);
    const sizeOk = !r.minPartySize || params.partySize >= r.minPartySize;
    const periodOk = !r.servicePeriod || r.servicePeriod === params.servicePeriod;
    return dayOk && sizeOk && periodOk;
  }) || null;

  const amount = matched?.amount ?? policy.defaultAmount ?? 0;
  const type = matched?.type ?? policy.defaultType ?? 'fixed';
  return { required: amount > 0, amount, type, matchedRule: matched };
}

// Webhook (no auth)
router.post('/webhook', (req: Request, res: Response) => {
  // TODO: Implement Stripe webhook handling
  res.status(200).json({ received: true });
});

router.use(requireAuth);

// GET /api/v1/payments
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const recent = await prisma.reservation.findMany({
      where: { tenantId: req.user!.tenantId, paymentStatus: { not: 'none' } },
      include: { guest: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json({
      data: recent.map(r => ({
        id: r.id,
        date: r.date,
        time: r.time,
        guestName: r.guest.name,
        paymentStatus: r.paymentStatus,
        cancellationFee: r.cancellationFee,
        noShowFeeCharged: r.noShowFeeCharged,
      })),
    });
  } catch (err) { next(err); }
});

// GET /api/v1/payments/deposit-policy
router.get('/deposit-policy', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as any;
    res.status(200).json({
      data: settings.depositPolicy ?? {
        enabled: false,
        defaultType: 'fixed',
        defaultAmount: 0,
        rules: [],
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/payments/deposit-policy
router.put('/deposit-policy', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const incoming = req.body || {};
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const settings = (tenant?.settings || {}) as any;
    const nextSettings = { ...settings, depositPolicy: incoming };

    await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { settings: nextSettings as any },
    });

    res.status(200).json({ data: incoming });
  } catch (err) { next(err); }
});

// POST /api/v1/payments/deposit-estimate
router.post('/deposit-estimate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, partySize, servicePeriod } = req.body as { date?: string; partySize?: number; servicePeriod?: string };
    if (!date || !partySize) {
      res.status(400).json({ error: 'BadRequest', message: 'date and partySize are required', statusCode: 400 });
      return;
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId }, select: { settings: true } });
    const estimate = resolveDeposit(tenant?.settings, { date, partySize, servicePeriod });
    res.status(200).json({ data: estimate });
  } catch (err) { next(err); }
});

export default router;
