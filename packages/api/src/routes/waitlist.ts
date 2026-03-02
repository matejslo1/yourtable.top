import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { guest: true },
      orderBy: [{ date: 'asc' }, { priority: 'desc' }],
    });
    res.status(200).json(entries);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.waitlistEntry.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.waitlistEntry.updateMany({ where: { id: req.params.id, tenantId: req.user!.tenantId }, data: req.body });
    res.status(200).json(entry);
  } catch (err) { next(err); }
});

export default router;
