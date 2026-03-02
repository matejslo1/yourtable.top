import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/users
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({ where: { tenantId: req.user!.tenantId } });
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.user!.tenantId } });
    if (!user) { res.status(404).json({ error: 'NotFound', message: 'User not found', statusCode: 404 }); return; }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id
router.patch('/:id', requireRole('owner', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: req.body,
    });
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
