import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createVoucher,
  validateVoucher,
  redeemVoucher,
  listVouchers,
  getVoucher,
  cancelVoucher,
  getVoucherStats,
} from '../services/voucherService.js';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, page, pageSize } = req.query;
    const result = await listVouchers(req.tenantId!, {
      status: status as string,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    });
    res.json({ data: result.vouchers, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
  } catch (error) { next(error); }
});

router.get('/stats', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getVoucherStats(req.tenantId!);
    res.json({ data: stats });
  } catch (error) { next(error); }
});

router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const voucher = await getVoucher(req.tenantId!, req.params.id);
    res.json({ data: voucher });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const voucher = await createVoucher({ tenantId: req.tenantId!, userId: req.user!.id, ...req.body });
    res.status(201).json({ data: voucher });
  } catch (error) { next(error); }
});

router.post('/validate', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: 'Code is required' }); return; }
    const result = await validateVoucher(req.tenantId!, code.toUpperCase().trim());
    res.json({ data: result });
  } catch (error) { next(error); }
});

router.post('/redeem', requireAuth, requireRole('owner', 'admin', 'manager', 'staff'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, amount, notes } = req.body;
    if (!code || !amount) { res.status(400).json({ error: 'Code and amount are required' }); return; }
    const result = await redeemVoucher({ tenantId: req.tenantId!, userId: req.user!.id, code: code.toUpperCase().trim(), amount: parseFloat(amount), notes });
    res.json({ data: result });
  } catch (error) { next(error); }
});

router.put('/:id/cancel', requireAuth, requireRole('owner', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cancelVoucher(req.tenantId!, req.user!.id, req.params.id);
    res.json({ data: result });
  } catch (error) { next(error); }
});

export default router;
