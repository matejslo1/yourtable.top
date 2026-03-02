import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, status } = req.query;
    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: req.user!.tenantId,
        ...(date ? { date: new Date(date as string) } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { guest: true, tables: { include: { table: true } } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    res.status(200).json(reservations);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { guest: true, tables: { include: { table: true } } },
    });
    if (!reservation) { res.status(404).json({ error: 'NotFound', message: 'Reservation not found', statusCode: 404 }); return; }
    res.status(200).json(reservation);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tableIds, ...data } = req.body;
    const reservation = await prisma.reservation.create({
      data: {
        ...data,
        tenantId: req.user!.tenantId,
        tables: tableIds ? { create: (tableIds as string[]).map((id) => ({ tableId: id })) } : undefined,
      },
      include: { guest: true, tables: true },
    });
    res.status(201).json(reservation);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reservation = await prisma.reservation.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: req.body,
    });
    res.status(200).json(reservation);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.reservation.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

export default router;
