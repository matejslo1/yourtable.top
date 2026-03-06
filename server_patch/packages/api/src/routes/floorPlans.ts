import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: any, res) => {
  const data = await prisma.floorPlan.findMany({ where: { tenantId: req.user.tenantId }, include: { tables: true } });
  res.json({ data });
});

router.put('/:id/tables/batch', async (req: any, res) => {
  const { tables } = req.body;
  const updates = tables.map((t: any) => prisma.table.updateMany({ where: { id: t.id, tenantId: req.user.tenantId }, data: { x: t.x, y: t.y } }));
  await prisma.$transaction(updates);
  res.json({ success: true });
});

export default router;