import prisma from '../lib/prisma.js';

/**
 * Clean up expired HOLD reservations → mark them EXPIRED
 */
export async function cleanupExpiredHolds(): Promise<number> {
  const result = await prisma.reservation.updateMany({
    where: {
      status: 'HOLD',
      holdExpiresAt: { lt: new Date() },
    },
    data: {
      status: 'EXPIRED',
    },
  });
  return result.count;
}

/**
 * Create a new HOLD reservation for the booking widget
 */
export async function createHold(params: {
  tenantId: string;
  guestId: string;
  date: Date;
  time: string;
  durationMinutes: number;
  partySize: number;
  tableIds: string[];
  sessionToken: string;
  sourceIp?: string;
  holdTtlSeconds?: number;
}): Promise<{ reservationId: string; expiresAt: Date }> {
  const ttl = params.holdTtlSeconds ?? 420;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  const reservation = await prisma.reservation.create({
    data: {
      tenantId: params.tenantId,
      guestId: params.guestId,
      date: params.date,
      time: params.time,
      durationMinutes: params.durationMinutes,
      partySize: params.partySize,
      status: 'HOLD',
      source: 'online',
      holdExpiresAt: expiresAt,
      holdSessionToken: params.sessionToken,
      sourceIp: params.sourceIp,
      tables: {
        create: params.tableIds.map((tableId) => ({ tableId })),
      },
    },
  });

  return { reservationId: reservation.id, expiresAt };
}

/**
 * Confirm a HOLD → CONFIRMED (used in publicBooking route)
 */
export async function confirmHold(params: {
  reservationId: string;
  tenantId: string;
  sessionToken: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
}): Promise<{ success: boolean; reservationId: string }> {
  // Verify the hold exists, belongs to tenant, is still valid and session token matches
  const hold = await prisma.reservation.findFirst({
    where: {
      id: params.reservationId,
      tenantId: params.tenantId,
      status: 'HOLD',
      holdSessionToken: params.sessionToken,
      holdExpiresAt: { gt: new Date() },
    },
  });

  if (!hold) {
    throw new Error('HoldNotFound');
  }

  // Update guest info and confirm
  await prisma.$transaction([
    prisma.guest.update({
      where: { id: hold.guestId },
      data: {
        name: params.guestName,
        email: params.guestEmail,
        phone: params.guestPhone,
      },
    }),
    prisma.reservation.update({
      where: { id: params.reservationId },
      data: {
        status: 'CONFIRMED',
        notes: params.notes,
        confirmedAt: new Date(),
        holdExpiresAt: null,
        holdSessionToken: null,
      },
    }),
  ]);

  return { success: true, reservationId: params.reservationId };
}

/**
 * Release / abandon a HOLD
 */
export async function releaseHold(params: {
  reservationId: string;
  tenantId: string;
  sessionToken: string;
}): Promise<void> {
  await prisma.reservation.updateMany({
    where: {
      id: params.reservationId,
      tenantId: params.tenantId,
      status: 'HOLD',
      holdSessionToken: params.sessionToken,
    },
    data: {
      status: 'ABANDONED',
    },
  });
}
