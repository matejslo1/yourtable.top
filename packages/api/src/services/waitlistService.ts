import { prisma } from '../utils/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { AppError, NotFoundError } from '../utils/errors.js';

/**
 * Add guest to waitlist for a specific date/time
 */
export async function addToWaitlist(params: {
  tenantId: string;
  guestId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  date: Date;
  time: string;
  partySize: number;
}) {
  const { tenantId, date, time, partySize } = params;

  // Resolve guest
  let guestId = params.guestId;
  if (!guestId) {
    if (!params.guestName) throw new AppError('Guest name or guestId is required', 400);

    let guest = null;
    if (params.guestEmail) {
      guest = await prisma.guest.findFirst({
        where: { tenantId, email: params.guestEmail },
      });
    }

    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          tenantId,
          name: params.guestName,
          email: params.guestEmail || null,
          phone: params.guestPhone || null,
        },
      });
    }
    guestId = guest.id;
  }

  // Check VIP status for priority
  const guest = await prisma.guest.findFirst({ where: { id: guestId, tenantId } });
  const isVip = Array.isArray(guest?.tags) && (guest.tags as string[]).includes('VIP');

  const entry = await prisma.waitlistEntry.create({
    data: {
      tenantId,
      guestId,
      date,
      time,
      partySize,
      priority: isVip ? 10 : 0,
    },
    include: {
      guest: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return entry;
}

/**
 * Get waitlist for a specific date
 */
export async function getWaitlist(tenantId: string, date?: Date) {
  const where: any = { tenantId, status: 'waiting' };
  if (date) where.date = date;

  return prisma.waitlistEntry.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: {
      guest: { select: { id: true, name: true, email: true, phone: true, tags: true } },
    },
  });
}

/**
 * Offer a spot to a waitlisted guest
 * Sets expiry timer for them to accept
 */
export async function offerSpot(entryId: string, tenantId: string, userId?: string) {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, tenantId, status: 'waiting' },
  });

  if (!entry) throw new NotFoundError('Waitlist entry', entryId);

  // Load config for offer expiry
  const config = await prisma.seatingConfig.findUnique({ where: { tenantId } });
  const offerExpiryMinutes = 15; // Could be configurable

  const updated = await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: {
      status: 'offered',
      offeredAt: new Date(),
      expiresAt: new Date(Date.now() + offerExpiryMinutes * 60 * 1000),
    },
    include: {
      guest: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  if (userId) {
    await createAuditLog({
      tenantId,
      userId,
      action: 'status_change',
      entityType: 'waitlist',
      entityId: entryId,
      changes: { from: 'waiting', to: 'offered' },
    });
  }

  // TODO Phase 5: Send notification to guest

  return updated;
}

/**
 * Accept waitlist offer (creates a HOLD for the guest)
 */
export async function acceptWaitlistOffer(entryId: string, tenantId: string) {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, tenantId, status: 'offered' },
  });

  if (!entry) throw new NotFoundError('Waitlist entry', entryId);

  if (entry.expiresAt && entry.expiresAt < new Date()) {
    await prisma.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'expired' },
    });
    throw new AppError('The offer has expired', 410);
  }

  await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: { status: 'accepted' },
  });

  return entry;
}

/**
 * Remove from waitlist
 */
export async function removeFromWaitlist(entryId: string, tenantId: string) {
  await prisma.waitlistEntry.deleteMany({
    where: { id: entryId, tenantId },
  });
}

/**
 * Cleanup expired waitlist offers
 */
export async function cleanupExpiredOffers() {
  const expired = await prisma.waitlistEntry.updateMany({
    where: {
      status: 'offered',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  });

  if (expired.count > 0) {
    console.log(`[Waitlist] Expired ${expired.count} waitlist offers`);
  }

  return expired.count;
}
