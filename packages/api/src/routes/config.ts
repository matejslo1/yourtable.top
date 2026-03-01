import { Router, Request, Response, NextFunction } from 'express';
import {
  updateSeatingConfigSchema,
  bulkOperatingHoursSchema,
  createSpecialDateSchema,
} from '@yourtable/shared';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

// ============================================
// SEATING CONFIG
// ============================================

/**
 * GET /api/v1/config/seating
 */
router.get('/seating', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await prisma.seatingConfig.findUnique({
      where: { tenantId: req.tenantId! },
    });
    if (!config) throw new NotFoundError('SeatingConfig');
    res.json({ data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/config/seating
 */
router.put(
  '/seating',
  requireRole('owner', 'admin'),
  validate(updateSeatingConfigSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await prisma.seatingConfig.update({
        where: { tenantId: req.tenantId! },
        data: req.body,
      });
      res.json({ data: config });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// OPERATING HOURS
// ============================================

/**
 * GET /api/v1/config/hours
 */
router.get('/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = await prisma.operatingHours.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json({ data: hours });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/config/hours
 * Bulk update all 7 days
 */
router.put(
  '/hours',
  requireRole('owner', 'admin', 'manager'),
  validate(bulkOperatingHoursSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hours } = req.body;

      const results = await prisma.$transaction(
        hours.map((h: any) =>
          prisma.operatingHours.upsert({
            where: {
              tenantId_dayOfWeek: {
                tenantId: req.tenantId!,
                dayOfWeek: h.dayOfWeek,
              },
            },
            update: h,
            create: { tenantId: req.tenantId!, ...h },
          })
        )
      );

      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// SPECIAL DATES
// ============================================

/**
 * GET /api/v1/config/special-dates
 */
router.get('/special-dates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dates = await prisma.specialDate.findMany({
      where: { tenantId: req.tenantId! },
      orderBy: { date: 'asc' },
    });
    res.json({ data: dates });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/config/special-dates
 */
router.post(
  '/special-dates',
  requireRole('owner', 'admin', 'manager'),
  validate(createSpecialDateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const specialDate = await prisma.specialDate.upsert({
        where: {
          tenantId_date: {
            tenantId: req.tenantId!,
            date: new Date(req.body.date),
          },
        },
        update: req.body,
        create: {
          tenantId: req.tenantId!,
          ...req.body,
          date: new Date(req.body.date),
        },
      });
      res.status(201).json({ data: specialDate });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/config/special-dates/:id
 */
router.delete(
  '/special-dates/:id',
  requireRole('owner', 'admin', 'manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.specialDate.deleteMany({
        where: { id: req.params.id, tenantId: req.tenantId! },
      });
      res.json({ data: { message: 'Special date removed' } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
