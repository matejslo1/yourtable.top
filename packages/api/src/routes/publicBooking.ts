import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { createHold, confirmHold, releaseHold } from '../services/holdService.js';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreateHoldSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)'),
  partySize: z.number().int().min(1).max(50),
  tableIds: z.array(z.string().uuid()).min(1),
  sessionToken: z.string().min(1).max(100),
  guestEmail: z.string().email().optional(),
  guestName: z.string().optional(),
});

const ConfirmHoldSchema = z.object({
  sessionToken: z.string().min(1).max(100),
  guestName: z.string().min(1).max(255),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
});

const ReleaseHoldSchema = z.object({
  sessionToken: z.string().min(1).max(100),
});

// ─── Helper: resolve tenant by slug ──────────────────────────────────────────

async function resolveTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { seatingConfig: true },
  });
  if (!tenant || !tenant.isActive) return null;
  return tenant;
}

// ─── POST /:tenantSlug/hold — Create a new HOLD ───────────────────────────────

router.post('/:tenantSlug/hold', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) {
      res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 });
      return;
    }

    const parsed = CreateHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 });
      return;
    }

    const { date, time, partySize, tableIds, sessionToken, guestEmail, guestName } = parsed.data;

    // Check for an existing active HOLD with same sessionToken (idempotency)
    const existing = await prisma.reservation.findFirst({
      where: {
        tenantId: tenant.id,
        holdSessionToken: sessionToken,
        status: 'HOLD',
        holdExpiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      res.status(200).json({
        reservationId: existing.id,
        expiresAt: existing.holdExpiresAt,
        message: 'Existing hold returned',
      });
      return;
    }

    // Find or create a placeholder guest
    let guest = guestEmail
      ? await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: guestEmail } })
      : null;

    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          tenantId: tenant.id,
          name: guestName ?? 'Guest',
          email: guestEmail,
        },
      });
    }

    const ttl = tenant.seatingConfig?.holdTtlSeconds ?? 420;
    const durationMinutes = tenant.seatingConfig?.defaultDurationMin ?? 90;

    const { reservationId, expiresAt } = await createHold({
      tenantId: tenant.id,
      guestId: guest.id,
      date: new Date(date),
      time,
      durationMinutes,
      partySize,
      tableIds,
      sessionToken,
      sourceIp: req.ip,
      holdTtlSeconds: ttl,
    });

    res.status(201).json({ reservationId, expiresAt });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:tenantSlug/hold/:reservationId — Confirm a HOLD ──────────────────
//
// This is the endpoint that was returning 404.
// URL: POST /api/v1/public/:tenantSlug/hold/:reservationId
//

router.post('/:tenantSlug/hold/:reservationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) {
      res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 });
      return;
    }

    const parsed = ConfirmHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 });
      return;
    }

    const { sessionToken, guestName, guestEmail, guestPhone, notes } = parsed.data;

    try {
      const result = await confirmHold({
        reservationId: req.params.reservationId,
        tenantId: tenant.id,
        sessionToken,
        guestName,
        guestEmail,
        guestPhone,
        notes,
      });

      res.status(200).json({ ...result, message: 'Reservation confirmed successfully' });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'HoldNotFound') {
        res.status(404).json({
          error: 'HoldNotFound',
          message: 'Hold not found, already confirmed, or expired. Please start a new booking.',
          statusCode: 404,
        });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:tenantSlug/hold/:reservationId — Release / abandon a HOLD ──────

router.delete('/:tenantSlug/hold/:reservationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await resolveTenant(req.params.tenantSlug);
    if (!tenant) {
      res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 });
      return;
    }

    const parsed = ReleaseHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 });
      return;
    }

    await releaseHold({
      reservationId: req.params.reservationId,
      tenantId: tenant.id,
      sessionToken: parsed.data.sessionToken,
    });

    res.status(200).json({ success: true, message: 'Hold released' });
  } catch (err) {
    next(err);
  }
});

export default router;
