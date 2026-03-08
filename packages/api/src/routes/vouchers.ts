import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Helper: generate voucher code YT-XXXX-XXXX
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `YT-${seg(4)}-${seg(4)}`;
}

// GET /api/v1/vouchers
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize) || 20, 1), 100);

    const where: any = { tenantId: req.user!.tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [vouchers, total] = await prisma.$transaction([
      prisma.voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: { _count: { select: { transactions: true } } },
      }),
      prisma.voucher.count({ where }),
    ]);

    res.json({ data: vouchers, meta: { total, page: pageNum, pageSize: sizeNum } });
  } catch (err) { next(err); }
});

// GET /api/v1/vouchers/stats
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const [total, active, used, expired, cancelled, totalValue, redeemedValue] = await Promise.all([
      prisma.voucher.count({ where: { tenantId } }),
      prisma.voucher.count({ where: { tenantId, status: 'active' } }),
      prisma.voucher.count({ where: { tenantId, status: 'used' } }),
      prisma.voucher.count({ where: { tenantId, status: 'expired' } }),
      prisma.voucher.count({ where: { tenantId, status: 'cancelled' } }),
      prisma.voucher.aggregate({ where: { tenantId }, _sum: { initialValue: true } }),
      prisma.voucherTransaction.aggregate({ where: { voucher: { tenantId }, type: 'redemption' }, _sum: { amount: true } }),
    ]);

    res.json({
      data: {
        total, active, redeemed: used, expired, cancelled,
        totalIssuedValue: Number(totalValue._sum.initialValue || 0),
        totalRedeemedValue: Number(redeemedValue._sum.amount || 0),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/vouchers/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = await prisma.voucher.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { transactions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!voucher) { res.status(404).json({ error: 'NotFound' }); return; }
    res.json({ data: voucher });
  } catch (err) { next(err); }
});

// POST /api/v1/vouchers — create
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const {
      name, value, validDays = 365, deliveryMethod = 'email',
      dedication, recipientName, recipientEmail,
      buyerName, buyerEmail,
    } = req.body;

    if (!buyerName || !buyerEmail || !value) {
      res.status(400).json({ error: 'BadRequest', message: 'buyerName, buyerEmail, and value are required' });
      return;
    }

    // Generate unique code
    let code: string;
    for (let i = 0; i < 10; i++) {
      code = generateVoucherCode();
      const exists = await prisma.voucher.findUnique({ where: { tenantId_code: { tenantId, code } } });
      if (!exists) break;
    }

    const now = new Date();
    const validUntil = new Date(now.getTime() + parseInt(validDays) * 24 * 60 * 60 * 1000);

    const voucher = await prisma.voucher.create({
      data: {
        tenantId,
        code: code!,
        name: name || `Darilni bon ${value} EUR`,
        type: 'digital',
        status: 'active',
        initialValue: parseFloat(value),
        remainingValue: parseFloat(value),
        deliveryMethod,
        dedication: dedication || null,
        recipientName: recipientName || null,
        recipientEmail: recipientEmail || null,
        buyerName,
        buyerEmail,
        validFrom: now,
        validUntil,
      },
    });

    // Log purchase transaction
    await prisma.voucherTransaction.create({
      data: {
        voucherId: voucher.id,
        amount: parseFloat(value),
        type: 'purchase',
        performedBy: req.user!.id,
      },
    });

    res.status(201).json({ data: voucher });
  } catch (err) { next(err); }
});

// POST /api/v1/vouchers/validate
router.post('/validate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: 'Code is required' }); return; }

    const voucher = await prisma.voucher.findUnique({
      where: { tenantId_code: { tenantId: req.user!.tenantId, code: code.toUpperCase().trim() } },
    });

    if (!voucher) { res.status(404).json({ error: 'Bon ne obstaja' }); return; }

    const issues: string[] = [];
    if (voucher.status === 'cancelled') issues.push('Bon je preklican');
    if (voucher.status === 'used') issues.push('Bon je že porabljen');
    if (voucher.status === 'expired' || voucher.validUntil < new Date()) issues.push('Bon je potekel');
    if (Number(voucher.remainingValue) <= 0) issues.push('Na bonu ni več sredstev');

    res.json({
      data: {
        valid: issues.length === 0,
        voucher: {
          id: voucher.id, code: voucher.code, name: voucher.name,
          status: voucher.status,
          initialValue: Number(voucher.initialValue),
          remainingValue: Number(voucher.remainingValue),
          validUntil: voucher.validUntil,
          recipientName: voucher.recipientName,
          buyerName: voucher.buyerName,
        },
        issues,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/vouchers/redeem
router.post('/redeem', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { code, amount, notes } = req.body;
    if (!code || amount === undefined || amount === null) { res.status(400).json({ error: 'code and amount required' }); return; }

    const voucher = await prisma.voucher.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase().trim() } },
    });

    if (!voucher) { res.status(404).json({ error: 'Bon ne obstaja' }); return; }
    if (voucher.status !== 'active') { res.status(400).json({ error: `Bon ni aktiven (${voucher.status})` }); return; }
    if (voucher.validUntil < new Date()) { res.status(400).json({ error: 'Bon je potekel' }); return; }

    const parsedAmount = typeof amount === 'number'
      ? amount
      : Number(String(amount).replace(',', '.').trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Neveljaven znesek za unovčenje' });
      return;
    }

    const remaining = Number(voucher.remainingValue);
    const redeemAmount = Math.min(parsedAmount, remaining);
    if (redeemAmount <= 0) { res.status(400).json({ error: 'Na bonu ni več sredstev' }); return; }

    const newRemaining = Math.max(0, remaining - redeemAmount);
    const isFullyUsed = newRemaining <= 0;

    await prisma.$transaction([
      prisma.voucherTransaction.create({
        data: { voucherId: voucher.id, amount: redeemAmount, type: 'redemption', performedBy: req.user!.id, notes: notes || null },
      }),
      prisma.voucher.update({
        where: { id: voucher.id },
        data: { remainingValue: newRemaining, status: isFullyUsed ? 'used' : 'active' },
      }),
    ]);

    res.json({
      data: { redeemedAmount: redeemAmount, remainingValue: newRemaining, fullyRedeemed: isFullyUsed },
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/vouchers/:id/cancel
router.put('/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = await prisma.voucher.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!voucher) { res.status(404).json({ error: 'NotFound' }); return; }
    if (voucher.status === 'cancelled') { res.status(400).json({ error: 'Že preklican' }); return; }

    await prisma.voucher.update({ where: { id: req.params.id }, data: { status: 'cancelled' } });
    res.json({ data: { success: true } });
  } catch (err) { next(err); }
});

export default router;
