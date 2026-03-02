import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vouchers = await prisma.voucher.findMany({ where: { tenantId: req.user!.tenantId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json(vouchers);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = await prisma.voucher.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { transactions: true },
    });
    if (!voucher) { res.status(404).json({ error: 'NotFound', message: 'Voucher not found', statusCode: 404 }); return; }
    res.status(200).json(voucher);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = await prisma.voucher.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json(voucher);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const voucher = await prisma.voucher.updateMany({ where: { id: req.params.id, tenantId: req.user!.tenantId }, data: req.body });
    res.status(200).json(voucher);
  } catch (err) { next(err); }
});

export default router;
