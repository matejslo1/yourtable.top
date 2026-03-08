import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }

router.get('/overview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 365);
    const to = addDays(startOfDay(new Date()), 1);
    const from = addDays(to, -days);

    const reservations = await prisma.reservation.findMany({
      where: { tenantId, date: { gte: from, lt: to } },
      include: { tables: { include: { table: { select: { id: true, label: true, maxSeats: true } } } } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    const confirmed = reservations.filter(r => ['CONFIRMED', 'SEATED', 'COMPLETED'].includes(r.status));
    const noShow = reservations.filter(r => r.status === 'NO_SHOW').length;
    const cancelled = reservations.filter(r => r.status === 'CANCELLED').length;

    const bySource: Record<string, number> = {};
    for (const r of reservations) bySource[r.source] = (bySource[r.source] ?? 0) + 1;

    const dayMap: Record<string, { reservations: number; guests: number; noShows: number; cancelled: number }> = {};
    for (const r of reservations) {
      const key = r.date.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { reservations: 0, guests: 0, noShows: 0, cancelled: 0 };
      dayMap[key].reservations += 1;
      dayMap[key].guests += r.partySize;
      if (r.status === 'NO_SHOW') dayMap[key].noShows += 1;
      if (r.status === 'CANCELLED') dayMap[key].cancelled += 1;
    }

    const tableEfficiency: Record<string, { label: string; seatsServed: number; turns: number }> = {};
    for (const r of confirmed) {
      for (const rt of r.tables) {
        const id = rt.table.id;
        if (!tableEfficiency[id]) tableEfficiency[id] = { label: rt.table.label, seatsServed: 0, turns: 0 };
        tableEfficiency[id].seatsServed += r.partySize;
        tableEfficiency[id].turns += 1;
      }
    }

    const totalGuests = confirmed.reduce((s, r) => s + r.partySize, 0);
    const totalSeatsUsed = Object.values(tableEfficiency).reduce((s, t) => s + t.seatsServed, 0);

    res.status(200).json({
      data: {
        range: { from, to, days },
        totals: {
          reservations: reservations.length,
          confirmed: confirmed.length,
          guests: totalGuests,
          noShow,
          cancelled,
          noShowRate: reservations.length ? noShow / reservations.length : 0,
          cancellationRate: reservations.length ? cancelled / reservations.length : 0,
          revenuePerSeatProxy: totalSeatsUsed ? Number((totalGuests / totalSeatsUsed).toFixed(3)) : 0,
        },
        bySource,
        byDay: dayMap,
        tableEfficiency,
      },
    });
  } catch (err) { next(err); }
});

router.get('/export.csv', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 365);
    const to = addDays(startOfDay(new Date()), 1);
    const from = addDays(to, -days);

    const reservations = await prisma.reservation.findMany({
      where: { tenantId, date: { gte: from, lt: to } },
      include: { guest: { select: { name: true } } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    const header = 'date,time,guest,partySize,status,source\n';
    const rows = reservations.map(r =>
      `${r.date.toISOString().slice(0, 10)},${r.time},"${(r.guest?.name || '').replace(/"/g, '""')}",${r.partySize},${r.status},${r.source}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${days}d.csv"`);
    res.status(200).send(header + rows);
  } catch (err) { next(err); }
});

export default router;
