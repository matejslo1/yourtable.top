import { Router, Request, Response, NextFunction } from 'express';
import {
  createReservationSchema, updateReservationSchema,
  updateReservationStatusSchema, paginationSchema, dateSchema,
} from '@yourtable/shared';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createReservation, updateReservationStatus, updateReservation } from '../services/reservationService.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/reservations
 * List reservations with filters (date, status, guest, source)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = paginationSchema.parse(req.query);
    const skip = (page - 1) * pageSize;

    const date = req.query.date as string | undefined;
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const guestId = req.query.guestId as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { tenantId: req.tenantId! };

    if (date) {
      where.date = new Date(date);
    }

    if (status) {
      const statuses = status.split(',');
      where.status = { in: statuses };
    }

    if (source) {
      where.source = source;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (search) {
      where.guest = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        skip,
        take: pageSize,
        include: {
          guest: { select: { id: true, name: true, email: true, phone: true, tags: true, visitCount: true, noShowCount: true } },
          tables: { include: { table: { select: { id: true, label: true } } } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({ data: reservations, meta: { total, page, pageSize } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/reservations/timeline
 * Timeline view for admin - all reservations for a specific date, ordered by time
 * Includes table assignments and guest info for the floor view
 */
router.get('/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: 'date query parameter is required' });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        tenantId: req.tenantId!,
        date: new Date(date),
        status: { notIn: ['EXPIRED', 'ABANDONED'] },
      },
      orderBy: [{ time: 'asc' }],
      include: {
        guest: {
          select: {
            id: true, name: true, email: true, phone: true,
            tags: true, visitCount: true, noShowCount: true, isBlacklisted: true,
          },
        },
        tables: {
          include: { table: { select: { id: true, label: true, floorPlanId: true } } },
        },
      },
    });

    // Group by time slot for timeline display
    const timeline = new Map<string, typeof reservations>();
    for (const res of reservations) {
      const slot = res.time;
      if (!timeline.has(slot)) timeline.set(slot, []);
      timeline.get(slot)!.push(res);
    }

    // Convert to sorted array
    const slots = Array.from(timeline.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, items]) => ({ time, reservations: items }));

    // Summary stats for this day
    const stats = {
      totalReservations: reservations.length,
      totalGuests: reservations.reduce((sum, r) => sum + r.partySize, 0),
      byStatus: {} as Record<string, number>,
    };

    for (const r of reservations) {
      stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;
    }

    res.json({ data: { date, slots, stats } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/reservations/stats
 * Reservation statistics for dashboard
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [todayCount, todayGuests, weekCount, monthCount, noShows, cancelled] = await Promise.all([
      prisma.reservation.count({
        where: { tenantId: req.tenantId!, date: today, status: { notIn: ['EXPIRED', 'ABANDONED', 'CANCELLED'] } },
      }),
      prisma.reservation.aggregate({
        where: { tenantId: req.tenantId!, date: today, status: { notIn: ['EXPIRED', 'ABANDONED', 'CANCELLED'] } },
        _sum: { partySize: true },
      }),
      prisma.reservation.count({
        where: { tenantId: req.tenantId!, date: { gte: weekAgo }, status: { notIn: ['EXPIRED', 'ABANDONED'] } },
      }),
      prisma.reservation.count({
        where: { tenantId: req.tenantId!, date: { gte: monthAgo }, status: { notIn: ['EXPIRED', 'ABANDONED'] } },
      }),
      prisma.reservation.count({
        where: { tenantId: req.tenantId!, date: { gte: monthAgo }, status: 'NO_SHOW' },
      }),
      prisma.reservation.count({
        where: { tenantId: req.tenantId!, date: { gte: monthAgo }, status: 'CANCELLED' },
      }),
    ]);

    res.json({
      data: {
        today: { reservations: todayCount, guests: todayGuests._sum.partySize || 0 },
        last7Days: weekCount,
        last30Days: monthCount,
        noShowsLast30Days: noShows,
        cancelledLast30Days: cancelled,
        noShowRate: monthCount > 0 ? Math.round((noShows / monthCount) * 100) : 0,
        cancellationRate: monthCount > 0 ? Math.round((cancelled / monthCount) * 100) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/reservations/:id
 * Get single reservation details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId! },
      include: {
        guest: true,
        tables: { include: { table: true } },
      },
    });

    if (!reservation) throw new NotFoundError('Reservation', req.params.id);

    res.json({ data: reservation });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/reservations
 * Create reservation (staff-initiated)
 */
router.post(
  '/',
  validate(createReservationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await createReservation({
        tenantId: req.tenantId!,
        userId: req.user!.id,
        guestId: req.body.guestId,
        guestName: req.body.guestName,
        guestEmail: req.body.guestEmail,
        guestPhone: req.body.guestPhone,
        date: new Date(req.body.date),
        time: req.body.time,
        durationMinutes: req.body.durationMinutes,
        partySize: req.body.partySize,
        source: req.body.source,
        notes: req.body.notes,
        internalNotes: req.body.internalNotes,
        tableIds: req.body.tableIds,
      });

      res.status(201).json({ data: reservation });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/reservations/:id
 * Update reservation details
 */
router.put(
  '/:id',
  validate(updateReservationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await updateReservation(
        req.params.id,
        req.tenantId!,
        req.user!.id,
        {
          ...(req.body.date && { date: new Date(req.body.date) }),
          ...(req.body.time && { time: req.body.time }),
          ...(req.body.durationMinutes && { durationMinutes: req.body.durationMinutes }),
          ...(req.body.partySize && { partySize: req.body.partySize }),
          ...(req.body.notes !== undefined && { notes: req.body.notes }),
          ...(req.body.internalNotes !== undefined && { internalNotes: req.body.internalNotes }),
          ...(req.body.tableIds && { tableIds: req.body.tableIds }),
        }
      );

      res.json({ data: reservation });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/reservations/:id/status
 * Change reservation status
 */
router.put(
  '/:id/status',
  validate(updateReservationStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await updateReservationStatus(
        req.params.id,
        req.tenantId!,
        req.user!.id,
        req.body.status,
        req.body.reason
      );

      res.json({ data: reservation });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/reservations/:id/reassign
 * Manually reassign tables (staff override)
 */
router.put(
  '/:id/reassign',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tableIds } = req.body;
      if (!Array.isArray(tableIds) || tableIds.length === 0) {
        return res.status(400).json({ error: 'tableIds array is required' });
      }

      const reservation = await updateReservation(
        req.params.id,
        req.tenantId!,
        req.user!.id,
        { tableIds }
      );

      res.json({ data: reservation });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/reservations/:id
 * Cancel reservation (convenience endpoint)
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await updateReservationStatus(
        req.params.id,
        req.tenantId!,
        req.user!.id,
        'CANCELLED',
        req.body.reason || 'Cancelled by staff'
      );

      res.json({ data: reservation });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
