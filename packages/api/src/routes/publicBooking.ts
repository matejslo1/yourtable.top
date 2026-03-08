import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { createHold, confirmHold, releaseHold } from '../services/holdService.js';
import { getAvailability } from '../services/availability.js';
import { addToWaitlist } from '../services/waitlistService.js';
import { sendConfirmationEmail } from '../services/notificationService.js';
import { getOccupiedTableIds } from '../services/tableStatus.js';
import { findOptimalTables, type TableInfo, type AdjacencyInfo } from '@yourtable/shared';
import crypto from 'crypto';

const router = Router();

// ─── Validation ──────────────────────────────────────────────────────────────

const CreateHoldSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time (HH:mm)'),
  partySize: z.number().int().min(1).max(50),
  durationMinutes: z.number().int().min(30).max(480).optional(),
});

const ConfirmHoldSchema = z.object({
  sessionToken: z.string().min(1).max(100),
  guestName: z.string().min(1).max(255),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
});

const WaitlistSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(50),
  guestName: z.string().min(1).max(255),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
});

const CancelSchema = z.object({
  token: z.string().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function resolveTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { seatingConfig: true },
  });
  if (!tenant || !tenant.isActive) return null;
  return tenant;
}

async function findTablesForParty(tenantId: string, date: Date, time: string, partySize: number, durationMinutes: number, config: any) {
  const occupiedIds = await getOccupiedTableIds(tenantId, date, time, durationMinutes);

  const floorPlans = await prisma.floorPlan.findMany({
    where: { tenantId, isActive: true },
    include: {
      tables: { where: { isActive: true }, include: { adjacencyA: true, adjacencyB: true } },
    },
  });

  const availableTables: TableInfo[] = [];
  const allAdjacency: AdjacencyInfo[] = [];
  const seenAdj = new Set<string>();

  for (const fp of floorPlans) {
    for (const table of fp.tables) {
      if (!occupiedIds.has(table.id)) {
        availableTables.push({
          id: table.id, label: table.label,
          minSeats: table.minSeats, maxSeats: table.maxSeats,
          joinGroup: table.joinGroup, joinPriority: table.joinPriority,
          isCombinable: table.isCombinable, isVip: table.isVip,
          floorPlanId: fp.id,
        });
      }
      for (const adj of [...table.adjacencyA, ...table.adjacencyB]) {
        const key = [adj.tableAId, adj.tableBId].sort().join(':');
        if (!seenAdj.has(key)) {
          seenAdj.add(key);
          allAdjacency.push({ tableAId: adj.tableAId, tableBId: adj.tableBId, canJoin: adj.canJoin, joinMaxSeats: adj.joinMaxSeats });
        }
      }
    }
  }

  const candidates = findOptimalTables(availableTables, allAdjacency, {
    partySize,
    maxJoinTables: config.maxJoinTables ?? 3,
    scoringWeights: config.scoringWeights as any ?? { waste: 1, join: 1, vip: 1, zone: 0.5 },
  });

  return candidates;
}

// ─── POST /:tenantSlug/hold — Create HOLD with auto table assignment ─────────

router.post('/:tenantSlug/hold', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 }); return; }

    const parsed = CreateHoldSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 }); return; }

    const { date, time, partySize, durationMinutes } = parsed.data;
    const config = tenant.seatingConfig;
    const ttl = config?.holdTtlSeconds ?? 420;
    const duration = durationMinutes ?? config?.defaultDurationMin ?? 90;
    const dateObj = new Date(`${date}T00:00:00`);

    // Generate session token
    const sessionToken = crypto.randomBytes(24).toString('hex');

    // Check for existing active HOLD with same session (idempotency)
    const existing = await prisma.reservation.findFirst({
      where: {
        tenantId: tenant.id, holdSessionToken: sessionToken,
        status: 'HOLD', holdExpiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      res.status(200).json({
        reservationId: existing.id,
        holdExpiresAt: existing.holdExpiresAt,
        sessionToken,
        assignedTables: [],
        message: 'Existing hold returned',
      });
      return;
    }

    // BACKEND finds optimal tables — widget never sends tableIds!
    const candidates = await findTablesForParty(tenant.id, dateObj, time, partySize, duration, config || {});

    if (candidates.length === 0) {
      // Find alternative available times
      let alternatives: string[] = [];
      try {
        const avail = await getAvailability({ tenantId: tenant.id, date: dateObj, partySize });
        const availableSlots = avail.slots
          .filter((s: any) => s.available && s.time !== time)
          .map((s: any) => s.time);

        // Find closest slots to the requested time
        const [reqH, reqM] = time.split(':').map(Number);
        const reqMinutes = reqH * 60 + reqM;
        alternatives = availableSlots
          .sort((a: string, b: string) => {
            const [aH, aM] = a.split(':').map(Number);
            const [bH, bM] = b.split(':').map(Number);
            return Math.abs(aH * 60 + aM - reqMinutes) - Math.abs(bH * 60 + bM - reqMinutes);
          })
          .slice(0, 5);
      } catch (_) { /* ignore — just won't have alternatives */ }

      // No tables available — return 409 with alternatives
      res.status(409).json({
        error: 'NoTablesAvailable',
        message: 'Za ta termin ni prostih miz',
        statusCode: 409,
        partySize,
        date,
        time,
        canWaitlist: config?.waitlistEnabled ?? false,
        alternatives,
      });
      return;
    }

    const bestCandidate = candidates[0];
    const tableIds = bestCandidate.tables.map(t => t.id);

    // Create placeholder guest
    const guest = await prisma.guest.create({
      data: { tenantId: tenant.id, name: 'Guest', email: null },
    });

    const { reservationId, expiresAt } = await createHold({
      tenantId: tenant.id, guestId: guest.id,
      date: dateObj, time, durationMinutes: duration, partySize,
      tableIds, sessionToken,
      sourceIp: req.ip, holdTtlSeconds: ttl,
    });

    res.status(201).json({
      reservationId,
      holdExpiresAt: expiresAt.toISOString(),
      sessionToken,
      assignedTables: bestCandidate.tables.map(t => ({ id: t.id, label: t.label })),
    });
  } catch (err) { next(err); }
});

// ─── POST /:tenantSlug/hold/:reservationId/complete — Confirm HOLD ───────────

router.post('/:tenantSlug/hold/:reservationId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 }); return; }

    const parsed = ConfirmHoldSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 }); return; }

    const { sessionToken, guestName, guestEmail, guestPhone, notes } = parsed.data;

    try {
      const result = await confirmHold({
        reservationId: req.params.reservationId,
        tenantId: tenant.id,
        sessionToken, guestName, guestEmail, guestPhone, notes,
      });

      // Generate cancel token and store it
      const cancelToken = crypto.randomBytes(24).toString('hex');
      await prisma.reservation.update({
        where: { id: req.params.reservationId },
        data: { holdSessionToken: cancelToken }, // reuse for cancel token
      });

      // Send confirmation email (async)
      sendConfirmationEmail(req.params.reservationId).catch(err =>
        console.error('[Notification] Confirmation email failed:', err)
      );

      res.status(200).json({
        ...result,
        cancelToken,
        message: 'Reservation confirmed successfully',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'HoldNotFound') {
        res.status(404).json({ error: 'HoldNotFound', message: 'Hold expired or already confirmed. Please start a new booking.', statusCode: 404 });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// ─── DELETE /:tenantSlug/hold/:reservationId — Abandon HOLD ──────────────────

router.delete('/:tenantSlug/hold/:reservationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 }); return; }

    const { sessionToken } = req.body || {};
    if (sessionToken) {
      await releaseHold({ reservationId: req.params.reservationId, tenantId: tenant.id, sessionToken });
    }
    res.status(200).json({ success: true });
  } catch (err) { next(err); }
});

// ─── POST /:tenantSlug/waitlist — Public waitlist entry ──────────────────────

router.post('/:tenantSlug/waitlist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 }); return; }

    const parsed = WaitlistSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 }); return; }

    const { date, time, partySize, guestName, guestEmail, guestPhone } = parsed.data;

    const entry = await addToWaitlist({
      tenantId: tenant.id,
      guestName, guestEmail, guestPhone: guestPhone || undefined,
      date: new Date(`${date}T00:00:00`), time, partySize,
    });

    res.status(201).json({
      data: entry,
      message: 'Dodani ste na čakalno vrsto. Obvestili vas bomo ko se sprosti mesto.',
    });
  } catch (err) { next(err); }
});

// ─── POST /:tenantSlug/cancel — Public cancel with token ─────────────────────

router.post('/:tenantSlug/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 }); return; }

    const parsed = CancelSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'ValidationError', message: 'Cancel token is required', statusCode: 400 }); return; }

    const reservation = await prisma.reservation.findFirst({
      where: {
        tenantId: tenant.id,
        holdSessionToken: parsed.data.token,
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    if (!reservation) {
      res.status(404).json({ error: 'NotFound', message: 'Reservation not found or already cancelled', statusCode: 404 });
      return;
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Guest cancelled via link' },
    });

    res.status(200).json({ success: true, message: 'Rezervacija uspešno preklicana' });
  } catch (err) { next(err); }
});

export default router;
