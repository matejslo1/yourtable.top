import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/floor-plans
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.floorPlan.findMany({
      where: { tenantId: req.user!.tenantId },
      include: {
        tables: { where: { isActive: true }, orderBy: { label: 'asc' }, include: { adjacencyA: true, adjacencyB: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.status(200).json({ data: plans });
  } catch (err) { next(err); }
});

// POST /api/v1/floor-plans
router.post('/', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.floorPlan.create({
      data: { ...req.body, tenantId: req.user!.tenantId },
    });
    res.status(201).json({ data: plan });
  } catch (err) { next(err); }
});

// PATCH /api/v1/floor-plans/:id
router.patch('/:id', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.floorPlan.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: req.body,
    });
    res.status(200).json({ data: plan });
  } catch (err) { next(err); }
});

// DELETE /api/v1/floor-plans/:id
router.delete('/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.floorPlan.deleteMany({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

// ─── Tables ──────────────────────────────────────────────────────────────────

// POST /api/v1/floor-plans/:id/tables
router.post('/:id/tables', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = await prisma.floorPlan.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!plan) { res.status(404).json({ error: 'NotFound', message: 'Floor plan not found', statusCode: 404 }); return; }
    const table = await prisma.restaurantTable.create({
      data: { ...req.body, floorPlanId: req.params.id },
    });
    res.status(201).json({ data: table });
  } catch (err) { next(err); }
});

// PATCH /api/v1/floor-plans/:id/tables/:tableId
router.patch('/:id/tables/:tableId', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const table = await prisma.restaurantTable.update({
      where: { id: req.params.tableId },
      data: req.body,
    });
    res.status(200).json({ data: table });
  } catch (err) { next(err); }
});

// DELETE /api/v1/floor-plans/:id/tables/:tableId
router.delete('/:id/tables/:tableId', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.restaurantTable.delete({ where: { id: req.params.tableId } });
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

export default router;
