import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/guests
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, page = '1', pageSize = '20' } = req.query as Record<string, string | undefined>;
    const pageNum = Math.max(parseInt(page ?? '1', 10) || 1, 1);
    const sizeNum = Math.min(Math.max(parseInt(pageSize ?? '20', 10) || 20, 1), 100);
    const skip = (pageNum - 1) * sizeNum;

    const where: any = { tenantId: req.user!.tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await prisma.$transaction([
      prisma.guest.findMany({
        where, orderBy: { name: 'asc' }, skip, take: sizeNum,
        include: { _count: { select: { reservations: true } } },
      }),
      prisma.guest.count({ where }),
    ]);

    res.status(200).json({ data, meta: { total, page: pageNum, pageSize: sizeNum } });
  } catch (err) { next(err); }
});

// GET /api/v1/guests/:id — includes reservation history
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        reservations: {
          orderBy: { date: 'desc' },
          take: 20,
          include: { tables: { include: { table: { select: { label: true } } } } },
        },
      },
    });
    if (!guest) {
      res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: guest });
  } catch (err) { next(err); }
});

// POST /api/v1/guests
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json({ data: guest });
  } catch (err) { next(err); }
});

// PATCH /api/v1/guests/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await prisma.guest.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: req.body,
    });
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

// PUT /api/v1/guests/:id/blacklist — toggle blacklist
router.put('/:id/blacklist', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!guest) {
      res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 });
      return;
    }
    const updated = await prisma.guest.update({
      where: { id: req.params.id },
      data: { isBlacklisted: !guest.isBlacklisted },
    });
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

export default router;
