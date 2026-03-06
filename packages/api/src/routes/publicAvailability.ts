import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { getAvailability } from '../services/availability.js';

const router = Router();

const AvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
});

// GET /:tenantSlug/availability — REAL availability with capacity checking
router.get('/:tenantSlug/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
      include: { seatingConfig: true },
    });

    if (!tenant || !tenant.isActive) {
      res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 });
      return;
    }

    const parsed = AvailabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', message: parsed.error.errors[0].message, statusCode: 400 });
      return;
    }

    const { date, partySize } = parsed.data;
    const requestedDate = new Date(`${date}T00:00:00`);

    // Check advance booking limits
    const now = new Date();
    const minAdvanceHours = tenant.seatingConfig?.minAdvanceHours ?? 2;
    const maxAdvanceDays = tenant.seatingConfig?.maxAdvanceDays ?? 60;
    const minBookingTime = new Date(now.getTime() + minAdvanceHours * 3600 * 1000);
    const maxBookingDate = new Date(now.getTime() + maxAdvanceDays * 86400 * 1000);

    if (requestedDate > maxBookingDate) {
      res.status(200).json({ available: false, slots: [], reason: 'TooFarInAdvance' });
      return;
    }

    // Use real availability service — checks actual table capacity!
    const availability = await getAvailability({
      tenantId: tenant.id,
      date: requestedDate,
      partySize,
    });

    if (availability.isClosed) {
      res.status(200).json({
        available: false,
        slots: [],
        reason: 'Closed',
        specialNote: availability.specialNote,
      });
      return;
    }

    // Filter out past time slots for today
    const filteredSlots = availability.slots.filter(slot => {
      const [sh, sm] = slot.time.split(':').map(Number);
      const slotDatetime = new Date(requestedDate);
      slotDatetime.setHours(sh, sm, 0, 0);
      return slotDatetime >= minBookingTime;
    });

    // Find alternative times if requested slot is full
    const availableSlots = filteredSlots.filter(s => s.available);
    const unavailableSlots = filteredSlots.filter(s => !s.available);

    res.status(200).json({
      date,
      partySize,
      isClosed: false,
      specialNote: availability.specialNote,
      available: availableSlots.length > 0,
      slots: filteredSlots,
      // Suggest alternatives if many slots are full
      alternatives: availableSlots.length < 3 && availableSlots.length > 0
        ? availableSlots.map(s => s.time)
        : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:tenantSlug/config — widget configuration
router.get('/:tenantSlug/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
      include: { seatingConfig: true },
    });

    if (!tenant || !tenant.isActive) {
      res.status(404).json({ error: 'NotFound', message: 'Restaurant not found', statusCode: 404 });
      return;
    }

    const settings = tenant.settings as Record<string, unknown>;

    res.status(200).json({
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      timezone: tenant.timezone,
      languages: settings?.languages ?? ['en'],
      currency: settings?.currency ?? 'EUR',
      bookingWidgetEnabled: settings?.bookingWidgetEnabled ?? true,
      maxPartySize: tenant.seatingConfig?.maxPartySize ?? 12,
      minAdvanceHours: tenant.seatingConfig?.minAdvanceHours ?? 2,
      maxAdvanceDays: tenant.seatingConfig?.maxAdvanceDays ?? 60,
      holdTtlSeconds: tenant.seatingConfig?.holdTtlSeconds ?? 420,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
