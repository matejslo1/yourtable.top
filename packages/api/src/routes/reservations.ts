import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { createReservation, updateReservationStatus, updateReservation } from '../services/reservationService.js';
import { getTableStatuses } from '../services/tableStatus.js';
import crypto from 'crypto';

const router = Router();
router.use(requireAuth);

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }

// GET /api/v1/reservations/stats
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const last7Start = addDays(today, -6);
    const last30Start = addDays(today, -29);

    const [todayReservations, todayGuestsAgg, last7Count, last30Count, last30NoShow, last30Cancelled] =
      await prisma.$transaction([
        prisma.reservation.count({ where: { tenantId, date: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED', 'EXPIRED', 'ABANDONED'] } } }),
        prisma.reservation.aggregate({
          where: { tenantId, date: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED', 'EXPIRED', 'ABANDONED'] } },
          _sum: { partySize: true },
        }),
        prisma.reservation.count({ where: { tenantId, date: { gte: last7Start, lt: tomorrow }, status: { notIn: ['CANCELLED', 'EXPIRED', 'ABANDONED'] } } }),
        prisma.reservation.count({ where: { tenantId, date: { gte: last30Start, lt: tomorrow }, status: { notIn: ['CANCELLED', 'EXPIRED', 'ABANDONED'] } } }),
        prisma.reservation.count({ where: { tenantId, date: { gte: last30Start, lt: tomorrow }, status: 'NO_SHOW' } }),
        prisma.reservation.count({ where: { tenantId, date: { gte: last30Start, lt: tomorrow }, status: 'CANCELLED' } }),
      ]);

    const noShowRate = last30Count ? last30NoShow / last30Count : 0;
    const cancellationRate = (last30Count + last30Cancelled) > 0 ? last30Cancelled / (last30Count + last30Cancelled) : 0;

    res.status(200).json({
      data: {
        today: { reservations: todayReservations, guests: todayGuestsAgg._sum.partySize ?? 0 },
        last7Days: last7Count,
        last30Days: last30Count,
        noShowsLast30Days: last30NoShow,
        cancelledLast30Days: last30Cancelled,
        noShowRate,
        cancellationRate,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/reservations/timeline?date=YYYY-MM-DD
// GET /api/v1/reservations/calendar?year=2025&month=3
router.get('/calendar', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const reservations = await prisma.reservation.findMany({
      where: { tenantId, date: { gte: start, lt: end } },
      include: { guest: { select: { name: true } }, tables: { include: { table: { select: { label: true } } } } },
      orderBy: { time: 'asc' },
    });

    // Group by date
    const byDate: Record<string, any> = {};
    for (const r of reservations) {
      const dateStr = r.date.toISOString().split('T')[0];
      if (!byDate[dateStr]) byDate[dateStr] = { count: 0, guests: 0, reservations: [] };
      byDate[dateStr].count++;
      byDate[dateStr].guests += r.partySize ?? 0;
      byDate[dateStr].reservations.push(r);
    }

    res.status(200).json({ data: byDate });
  } catch (err) { next(err); }
});

router.get('/timeline', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const day = startOfDay(new Date(`${dateStr}T00:00:00`));
    const nextDay = addDays(day, 1);

    const reservations = await prisma.reservation.findMany({
      where: { tenantId, date: { gte: day, lt: nextDay } },
      include: { guest: true, tables: { include: { table: true } } },
      orderBy: [{ time: 'asc' }],
    });

    const byTime = new Map<string, any[]>();
    for (const r of reservations) {
      if (!byTime.has(r.time)) byTime.set(r.time, []);
      byTime.get(r.time)!.push(r);
    }

    const slots = Array.from(byTime.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, items]) => ({ time, reservations: items }));

    const totalReservations = reservations.length;
    const totalGuests = reservations.reduce((sum, r) => sum + (r.partySize ?? 0), 0);
    const byStatus: Record<string, number> = {};
    for (const r of reservations) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    res.status(200).json({ data: { slots, stats: { totalReservations, totalGuests, byStatus } } });
  } catch (err) { next(err); }
});

// GET /api/v1/reservations/available-tables?date=YYYY-MM-DD&time=HH:mm&duration=90
router.get('/available-tables', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, duration = '90' } = req.query as Record<string, string>;
    if (!date || !time) {
      res.status(400).json({ error: 'BadRequest', message: 'date and time are required', statusCode: 400 });
      return;
    }
    const tableStatuses = await getTableStatuses(
      req.user!.tenantId,
      new Date(`${date}T00:00:00`),
      time,
      parseInt(duration)
    );
    // Return flat list of tables with availability
    const tables = tableStatuses.flatMap(fp =>
      fp.tables.map(t => ({
        id: t.id, label: t.label, minSeats: t.minSeats, maxSeats: t.maxSeats,
        shape: t.shape, isVip: t.isVip, isCombinable: t.isCombinable, joinGroup: t.joinGroup,
        floorPlanId: fp.id, floorPlanName: fp.name,
        isOccupied: t.isOccupied,
        reservation: t.reservation,
      }))
    );
    res.status(200).json({ data: tables });
  } catch (err) { next(err); }
});

// GET /api/v1/reservations
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
    res.status(200).json({ data: reservations });
  } catch (err) { next(err); }
});

// POST /api/v1/reservations — uses reservationService with smart seating!
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { guestName, guestEmail, guestPhone, date, time, partySize, durationMinutes, source, notes, internalNotes, tableIds } = req.body;

    const config = await prisma.seatingConfig.findUnique({ where: { tenantId: req.user!.tenantId } });
    const duration = durationMinutes || config?.defaultDurationMin || 90;

    const reservation = await createReservation({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      guestName,
      guestEmail: guestEmail || undefined,
      guestPhone: guestPhone || undefined,
      date: new Date(`${date}T00:00:00`),
      time,
      durationMinutes: duration,
      partySize: parseInt(partySize) || partySize,
      source: source || 'manual',
      notes,
      internalNotes,
      tableIds: tableIds?.length > 0 ? tableIds : undefined,
    });

    // Generate cancel token
    const cancelToken = crypto.randomBytes(24).toString('hex');
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { holdSessionToken: cancelToken }, // reuse field for cancel token
    });

    res.status(201).json({ data: { ...reservation, cancelToken } });
  } catch (err) { next(err); }
});

// PUT /api/v1/reservations/:id/status — uses reservationService with validation!
router.put('/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, reason } = req.body as { status?: string; reason?: string };
    if (!status) {
      res.status(400).json({ error: 'BadRequest', message: 'status is required', statusCode: 400 });
      return;
    }
    const updated = await updateReservationStatus(
      req.params.id,
      req.user!.tenantId,
      req.user!.id,
      status,
      reason
    );
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

// PATCH /api/v1/reservations/:id — uses reservationService with validation!
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, durationMinutes, partySize, notes, internalNotes, tableIds } = req.body;
    const updated = await updateReservation(
      req.params.id,
      req.user!.tenantId,
      req.user!.id,
      {
        ...(date ? { date: new Date(`${date}T00:00:00`) } : {}),
        ...(time ? { time } : {}),
        ...(durationMinutes ? { durationMinutes } : {}),
        ...(partySize ? { partySize } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(internalNotes !== undefined ? { internalNotes } : {}),
        ...(tableIds ? { tableIds } : {}),
      }
    );
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

// GET /api/v1/reservations/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: { guest: true, tables: { include: { table: true } } },
    });
    if (!reservation) {
      res.status(404).json({ error: 'NotFound', message: 'Reservation not found', statusCode: 404 });
      return;
    }
    res.status(200).json({ data: reservation });
  } catch (err) { next(err); }
});

// DELETE /api/v1/reservations/:id
router.delete('/:id', requireRole('owner', 'admin', 'manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await updateReservationStatus(
      req.params.id,
      req.user!.tenantId,
      req.user!.id,
      'CANCELLED',
      'Admin cancelled'
    );
    res.status(200).json({ data: updated });
  } catch (err) { next(err); }
});

export default router;
