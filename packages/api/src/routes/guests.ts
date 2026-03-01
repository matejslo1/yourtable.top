import { Router, Request, Response, NextFunction } from 'express';
import { createGuestSchema, updateGuestSchema, paginationSchema } from '@yourtable/shared';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuditLog } from '../utils/audit.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/guests
 * List guests with search, filter, pagination
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = paginationSchema.parse(req.query);
    const skip = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const tag = req.query.tag as string | undefined;
    const blacklisted = req.query.blacklisted === 'true' ? true : req.query.blacklisted === 'false' ? false : undefined;

    const where: any = { tenantId: req.tenantId! };

    // Full-text search on name, email, phone
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { array_contains: [tag] };
    }

    if (blacklisted !== undefined) {
      where.isBlacklisted = blacklisted;
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: { select: { reservations: true } },
        },
      }),
      prisma.guest.count({ where }),
    ]);

    res.json({ data: guests, meta: { total, page, pageSize } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/guests/:id
 * Get guest profile with reservation history
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: {
        reservations: {
          orderBy: { date: 'desc' },
          take: 20,
          select: {
            id: true,
            date: true,
            time: true,
            partySize: true,
            status: true,
            source: true,
            notes: true,
            tables: {
              include: { table: { select: { label: true } } },
            },
            createdAt: true,
          },
        },
        _count: { select: { reservations: true } },
      },
    });

    if (!guest) throw new NotFoundError('Guest', req.params.id);

    res.json({ data: guest });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/guests
 * Create new guest
 */
router.post(
  '/',
  validate(createGuestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guest = await prisma.guest.create({
        data: {
          tenantId: req.tenantId!,
          ...req.body,
        },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'create',
        entityType: 'guest',
        entityId: guest.id,
      });

      res.status(201).json({ data: guest });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/guests/:id
 * Update guest details
 */
router.put(
  '/:id',
  validate(updateGuestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.guest.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing) throw new NotFoundError('Guest', req.params.id);

      const guest = await prisma.guest.update({
        where: { id: req.params.id },
        data: req.body,
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'guest',
        entityId: guest.id,
        changes: { before: existing, after: guest },
      });

      res.json({ data: guest });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/guests/:id/tags
 * Update guest tags (VIP, alergija, etc.)
 */
router.put(
  '/:id/tags',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tags } = req.body;
      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'ValidationError', message: 'tags must be an array', statusCode: 400 });
      }

      const existing = await prisma.guest.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing) throw new NotFoundError('Guest', req.params.id);

      const guest = await prisma.guest.update({
        where: { id: req.params.id },
        data: { tags },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'guest',
        entityId: guest.id,
        changes: { tags: { before: existing.tags, after: tags } },
      });

      res.json({ data: guest });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/guests/:id/blacklist
 * Toggle blacklist status
 */
router.put(
  '/:id/blacklist',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.guest.findFirst({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      if (!existing) throw new NotFoundError('Guest', req.params.id);

      const guest = await prisma.guest.update({
        where: { id: req.params.id },
        data: { isBlacklisted: !existing.isBlacklisted },
      });

      await createAuditLog({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        action: 'update',
        entityType: 'guest',
        entityId: guest.id,
        changes: { blacklisted: { before: existing.isBlacklisted, after: guest.isBlacklisted } },
      });

      res.json({ data: guest });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/guests/stats/overview
 * Guest statistics overview
 */
router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalGuests, vipGuests, blacklisted, recentGuests] = await Promise.all([
      prisma.guest.count({ where: { tenantId: req.tenantId! } }),
      prisma.guest.count({
        where: {
          tenantId: req.tenantId!,
          tags: { array_contains: ['VIP'] },
        },
      }),
      prisma.guest.count({ where: { tenantId: req.tenantId!, isBlacklisted: true } }),
      prisma.guest.count({
        where: {
          tenantId: req.tenantId!,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    res.json({
      data: { totalGuests, vipGuests, blacklisted, newLast30Days: recentGuests },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
