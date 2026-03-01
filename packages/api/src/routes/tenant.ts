import { Router, Request, Response, NextFunction } from 'express';
import { updateTenantSchema } from '@yourtable/shared';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuditLog } from '../utils/audit.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();

// All tenant routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/tenant
 * Get current tenant details
 */
router.get('/', async (req: Request, res: Response) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId! },
    include: {
      seatingConfig: true,
      operatingHours: { orderBy: { dayOfWeek: 'asc' } },
      _count: {
        select: {
          users: true,
          floorPlans: true,
          guests: true,
          reservations: true,
        },
      },
    },
  });

  if (!tenant) throw new NotFoundError('Tenant');

  res.json({ data: tenant });
});

/**
 * PUT /api/v1/tenant
 * Update tenant settings (owner/admin only)
 */
router.put(
  '/',
  requireRole('owner', 'admin'),
  validate(updateTenantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await prisma.tenant.findUnique({ where: { id: req.tenantId! } });

      const tenant = await prisma.tenant.update({
        where: { id: req.tenantId! },
        data: req.body,
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'tenant',
        entityId: tenant.id,
        changes: { before, after: tenant },
      });

      res.json({ data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/tenant/settings
 * Update tenant JSON settings
 */
router.put(
  '/settings',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await prisma.tenant.findUnique({
        where: { id: req.tenantId! },
        select: { settings: true },
      });

      const mergedSettings = {
        ...(current?.settings as Record<string, unknown> || {}),
        ...req.body,
      };

      const tenant = await prisma.tenant.update({
        where: { id: req.tenantId! },
        data: { settings: mergedSettings },
      });

      res.json({ data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
