import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';

const router = Router();

const AvailabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(50),
});

// GET /:tenantSlug/availability
router.get('/:tenantSlug/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
      include: {
        seatingConfig: true,
        operatingHours: true,
        specialDates: true,
      },
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
    const requestedDate = new Date(date);
    const dayOfWeek = (requestedDate.getDay() + 6) % 7; // Mon=0 ... Sun=6

    // Check special dates
    const specialDate = tenant.specialDates.find(
      (sd) => sd.date.toISOString().slice(0, 10) === date,
    );
    if (specialDate?.isClosed) {
      res.status(200).json({ available: false, slots: [], reason: 'ClosedSpecialDate' });
      return;
    }

    // Check operating hours
    const hours = tenant.operatingHours.find((oh) => oh.dayOfWeek === dayOfWeek);
    if (!hours || hours.isClosed) {
      res.status(200).json({ available: false, slots: [], reason: 'ClosedDay' });
      return;
    }

    // Generate time slots
    const slots: string[] = [];
    const [openH, openM] = hours.openTime.split(':').map(Number);
    const [lastH, lastM] = hours.lastReservation.split(':').map(Number);
    const slotMin = hours.slotDurationMin;

    let current = openH * 60 + openM;
    const lastSlot = lastH * 60 + lastM;

    while (current <= lastSlot) {
      const h = String(Math.floor(current / 60)).padStart(2, '0');
      const m = String(current % 60).padStart(2, '0');
      slots.push(`${h}:${m}`);
      current += slotMin;
    }

    // Filter advance booking constraints
    const minAdvanceHours = tenant.seatingConfig?.minAdvanceHours ?? 2;
    const maxAdvanceDays = tenant.seatingConfig?.maxAdvanceDays ?? 60;
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + minAdvanceHours * 3600 * 1000);
    const maxBookingDate = new Date(now.getTime() + maxAdvanceDays * 86400 * 1000);

    if (requestedDate > maxBookingDate) {
      res.status(200).json({ available: false, slots: [], reason: 'TooFarInAdvance' });
      return;
    }

    const availableSlots = slots.filter((slot) => {
      const [sh, sm] = slot.split(':').map(Number);
      const slotDatetime = new Date(requestedDate);
      slotDatetime.setHours(sh, sm, 0, 0);
      return slotDatetime >= minBookingTime;
    });

    res.status(200).json({
      available: availableSlots.length > 0,
      slots: availableSlots,
      partySize,
      date,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:tenantSlug/config  – widget configuration
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
