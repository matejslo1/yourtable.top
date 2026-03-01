import { Router, Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserSchema, paginationSchema } from '@yourtable/shared';
import { prisma } from '../utils/prisma.js';
import { supabaseAdmin } from '../utils/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuditLog } from '../utils/audit.js';
import { AppError, NotFoundError } from '../utils/errors.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/users
 * List all staff members for the tenant
 */
router.get(
  '/',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = paginationSchema.parse(req.query);
      const skip = (page - 1) * pageSize;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: { tenantId: req.tenantId! },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            permissions: true,
            isActive: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where: { tenantId: req.tenantId! } }),
      ]);

      res.json({ data: users, meta: { total, page, pageSize } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/users
 * Create new staff member (owner/admin only)
 */
router.post(
  '/',
  requireRole('owner', 'admin'),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, role, password } = req.body;

      // Prevent staff from creating owners
      if (role === 'owner' && req.user!.role !== 'owner') {
        throw new AppError('Only owners can create owner accounts', 403);
      }

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        throw new AppError(`Failed to create user: ${authError.message}`, 400);
      }

      // Create user in our DB
      const user = await prisma.user.create({
        data: {
          tenantId: req.tenantId!,
          supabaseUserId: authData.user.id,
          email,
          name,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'create',
        entityType: 'user',
        entityId: user.id,
        changes: { role, email },
      });

      res.status(201).json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/users/:id
 * Update staff member
 */
router.put(
  '/:id',
  requireRole('owner', 'admin'),
  validate(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });

      if (!existing) throw new NotFoundError('User', req.params.id);

      // Prevent demoting yourself or changing owner role
      if (existing.id === req.user!.id && req.body.role && req.body.role !== req.user!.role) {
        throw new AppError('You cannot change your own role', 400);
      }

      if (existing.role === 'owner' && req.user!.role !== 'owner') {
        throw new AppError('Only owners can modify owner accounts', 403);
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: req.body,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'user',
        entityId: user.id,
        changes: { before: existing, after: user },
      });

      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/users/:id
 * Deactivate staff member (soft delete)
 */
router.delete(
  '/:id',
  requireRole('owner', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });

      if (!existing) throw new NotFoundError('User', req.params.id);

      if (existing.id === req.user!.id) {
        throw new AppError('You cannot deactivate your own account', 400);
      }

      if (existing.role === 'owner') {
        throw new AppError('Owner accounts cannot be deactivated', 400);
      }

      await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'delete',
        entityType: 'user',
        entityId: req.params.id,
      });

      res.json({ data: { message: 'User deactivated' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
