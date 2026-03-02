import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const guests = await prisma.guest.findMany({
      where: {
        tenantId: req.user!.tenantId,
        ...(search ? {
          OR: [
            { name: { contains: search as string, mode: 'insensitive' } },
            { email: { contains: search as string, mode: 'insensitive' } },
            { phone: { contains: search as string } },
          ],
        } : {}),
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(guests);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!guest) { res.status(404).json({ error: 'NotFound', message: 'Guest not found', statusCode: 404 }); return; }
    res.status(200).json(guest);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json(guest);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.updateMany({ where: { id: req.params.id, tenantId: req.user!.tenantId }, data: req.body });
    res.status(200).json(guest);
  } catch (err) { next(err); }
});

export default router;
