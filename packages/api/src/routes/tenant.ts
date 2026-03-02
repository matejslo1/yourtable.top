import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/v1/tenant — get current tenant
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      include: { seatingConfig: true, operatingHours: true, specialDates: true },
    });
    if (!tenant) {
      res.status(404).json({ error: 'NotFound', message: 'Tenant not found', statusCode: 404 });
      return;
    }
    res.status(200).json(tenant);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tenant — update tenant settings
router.patch('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, address, phone, email, timezone, settings, logoUrl } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { name, address, phone, email, timezone, settings, logoUrl },
    });
    res.status(200).json(tenant);
  } catch (err) {
    next(err);
  }
});

export default router;
