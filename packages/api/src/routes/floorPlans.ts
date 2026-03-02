import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.floorPlan.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { tables: { include: { adjacencyA: true, adjacencyB: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    res.status(200).json(plans);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.floorPlan.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { tables: true },
    });
    if (!plan) { res.status(404).json({ error: 'NotFound', message: 'Floor plan not found', statusCode: 404 }); return; }
    res.status(200).json(plan);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.floorPlan.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json(plan);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.floorPlan.updateMany({ where: { id: req.params.id, tenantId: req.user!.tenantId }, data: req.body });
    res.status(200).json(plan);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.floorPlan.deleteMany({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
