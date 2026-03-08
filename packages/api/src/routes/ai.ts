import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/shift-summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const date = new Date(`${dateStr}T00:00:00`);

    const reservations = await prisma.reservation.findMany({
      where: { tenantId, date },
      include: {
        guest: { select: { noShowCount: true, visitCount: true } },
      },
      orderBy: { time: 'asc' },
    });

    const total = reservations.length;
    const active = reservations.filter(r => ['CONFIRMED', 'SEATED', 'PENDING'].includes(r.status)).length;
    const noShows = reservations.filter(r => r.status === 'NO_SHOW').length;
    const highRisk = reservations.filter(r => r.guest.noShowCount >= 2).length;

    const peakByHour: Record<string, number> = {};
    for (const r of reservations) {
      const hour = r.time.slice(0, 2) + ':00';
      peakByHour[hour] = (peakByHour[hour] ?? 0) + r.partySize;
    }
    const peakHour = Object.entries(peakByHour).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const recommendations: string[] = [];
    if (highRisk > 0) recommendations.push(`Danes imate ${highRisk} rezervacij z gosti z zgodovino no-show. Potrdite prihod pravoèasno.`);
    if (peakHour) recommendations.push(`Najveèji pritisk je predviden okoli ${peakHour}. Okrepite host ekipo 30 minut prej.`);
    if (noShows / Math.max(total, 1) > 0.12) recommendations.push('Stopnja no-show je povišana. Razmislite o strožji deposit politiki za visoke termine.');
    if (recommendations.length === 0) recommendations.push('Shift izgleda stabilen. Fokus na hitro obraèanje miz in upsell pri peak urah.');

    const summary = `Datum ${dateStr}: ${total} rezervacij, ${active} aktivnih, ${noShows} no-show. Peak ura: ${peakHour || 'n/a'}.`;

    res.status(200).json({
      data: {
        date: dateStr,
        summary,
        metrics: { total, active, noShows, highRisk, peakHour },
        recommendations,
      },
    });
  } catch (err) { next(err); }
});

export default router;
