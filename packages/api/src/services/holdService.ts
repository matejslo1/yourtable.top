import { prisma } from '../utils/prisma.js';
import { findOptimalTables, type SeatingRequest, type TableInfo, type AdjacencyInfo } from '@yourtable/shared';
import { getOccupiedTableIds } from './tableStatus.js';
import { createAuditLog } from '../utils/audit.js';
import { AppError, ConflictError, NotFoundError } from '../utils/errors.js';
import { nanoid } from 'nanoid';

interface CreateHoldParams {
  tenantId: string;
  date: Date;
  time: string;
  partySize: number;
  durationMinutes?: number;
  sourceIp?: string;
}

interface CompleteHoldParams {
  reservationId: string;
  tenantId: string;
  sessionToken: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  paymentIntentId?: string;
  userId?: string; // if staff completes
}

/**
 * Create a HOLD reservation with optimal table assignment
 * This is the entry point for the booking widget
 */
export async function createHold(params: CreateHoldParams) {
  const { tenantId, date, time, partySize, sourceIp } = params;

  // Load seating config
  const config = await prisma.seatingConfig.findUnique({
    where: { tenantId },
  });

  if (!config) {
    throw new AppError('Seating configuration not found. Please configure your restaurant first.', 400);
  }

  const durationMinutes = params.durationMinutes || config.defaultDurationMin;

  // Check party size limits
  if (partySize > config.maxPartySize) {
    throw new AppError(
      `Maximum party size for online reservations is ${config.maxPartySize}. Please call us for larger groups.`,
      400
    );
  }

  // Check max active HOLDs from same IP (abuse protection)
  if (sourceIp) {
    const activeHolds = await prisma.reservation.count({
      where: {
        tenantId,
        status: 'HOLD',
        sourceIp,
        holdExpiresAt: { gt: new Date() },
      },
    });

    if (activeHolds >= 1) {
      throw new ConflictError('You already have an active reservation in progress. Please complete or cancel it first.');
    }
  }

  // Get available tables using seating engine
  const occupiedIds = await getOccupiedTableIds(tenantId, date, time, durationMinutes);

  // Load all active tables with adjacency
  const floorPlans = await prisma.floorPlan.findMany({
    where: { tenantId, isActive: true },
    include: {
      tables: {
        where: { isActive: true },
        include: {
          adjacencyA: true,
          adjacencyB: true,
        },
      },
    },
  });

  // Build available tables list (excluding occupied)
  const availableTables: TableInfo[] = [];
  const allAdjacency: AdjacencyInfo[] = [];
  const seenAdj = new Set<string>();

  for (const fp of floorPlans) {
    for (const table of fp.tables) {
      if (!occupiedIds.has(table.id)) {
        availableTables.push({
          id: table.id,
          label: table.label,
          minSeats: table.minSeats,
          maxSeats: table.maxSeats,
          joinGroup: table.joinGroup,
          joinPriority: table.joinPriority,
          isCombinable: table.isCombinable,
          isVip: table.isVip,
          floorPlanId: fp.id,
        });
      }

      // Collect adjacency (deduplicated)
      for (const adj of [...table.adjacencyA, ...table.adjacencyB]) {
        const key = [adj.tableAId, adj.tableBId].sort().join(':');
        if (!seenAdj.has(key)) {
          seenAdj.add(key);
          allAdjacency.push({
            tableAId: adj.tableAId,
            tableBId: adj.tableBId,
            canJoin: adj.canJoin,
            joinMaxSeats: adj.joinMaxSeats,
          });
        }
      }
    }
  }

  // Run seating algorithm
  const seatingRequest: SeatingRequest = {
    partySize,
    maxJoinTables: config.maxJoinTables,
    scoringWeights: config.scoringWeights as any,
  };

  const candidates = findOptimalTables(availableTables, allAdjacency, seatingRequest);

  if (candidates.length === 0) {
    throw new ConflictError(
      'No tables available for this time slot and party size. Please try a different time or check our waitlist.'
    );
  }

  // Take the best candidate
  const best = candidates[0];
  const tableIds = best.tables.map(t => t.id);
  const sessionToken = nanoid(32);
  const holdExpiresAt = new Date(Date.now() + config.holdTtlSeconds * 1000);

  // Create HOLD reservation with table assignment in a transaction
  // Use advisory lock to prevent race conditions
  const reservation = await prisma.$transaction(async (tx) => {
    // Double-check tables are still available (within transaction)
    const conflicting = await tx.reservationTable.findMany({
      where: {
        tableId: { in: tableIds },
        reservation: {
          tenantId,
          date,
          status: { in: ['HOLD', 'PENDING', 'CONFIRMED', 'SEATED'] },
          OR: [
            { holdExpiresAt: null },
            { holdExpiresAt: { gt: new Date() } },
          ],
        },
      },
    });

    // Check time overlap for conflicting reservations
    if (conflicting.length > 0) {
      // Re-run to get specific reservation times
      const conflictingRes = await tx.reservation.findMany({
        where: {
          id: { in: conflicting.map(c => c.reservationId) },
        },
      });

      const [reqH, reqM] = time.split(':').map(Number);
      const reqStart = reqH * 60 + reqM;
      const reqEnd = reqStart + durationMinutes;

      for (const cr of conflictingRes) {
        const [cH, cM] = cr.time.split(':').map(Number);
        const cStart = cH * 60 + cM;
        const cEnd = cStart + cr.durationMinutes;
        
        if (reqStart < cEnd && cStart < reqEnd) {
          throw new ConflictError('Selected tables are no longer available. Please try again.');
        }
      }
    }

    // Create a placeholder guest for the HOLD (will be updated on complete)
    const guest = await tx.guest.create({
      data: {
        tenantId,
        name: 'Pending...',
        email: `hold-${sessionToken}@placeholder.local`,
      },
    });

    // Create reservation
    const res = await tx.reservation.create({
      data: {
        tenantId,
        guestId: guest.id,
        date,
        time,
        durationMinutes,
        partySize,
        status: 'HOLD',
        source: 'online',
        holdExpiresAt,
        holdSessionToken: sessionToken,
        assignedBy: 'auto',
        sourceIp: sourceIp || null,
        tables: {
          create: tableIds.map(tableId => ({ tableId })),
        },
      },
      include: {
        tables: {
          include: {
            table: { select: { id: true, label: true } },
          },
        },
      },
    });

    return res;
  });

  return {
    reservationId: reservation.id,
    holdExpiresAt: holdExpiresAt.toISOString(),
    assignedTables: reservation.tables.map(rt => ({
      id: rt.table.id,
      label: rt.table.label,
    })),
    sessionToken,
    scoringBreakdown: best.breakdown,
  };
}

/**
 * Complete a HOLD - convert to PENDING/CONFIRMED with guest data
 */
export async function completeHold(params: CompleteHoldParams) {
  const {
    reservationId, tenantId, sessionToken,
    guestName, guestEmail, guestPhone, notes, paymentIntentId,
  } = params;

  // Find the HOLD reservation
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      tenantId,
      status: 'HOLD',
      holdSessionToken: sessionToken,
    },
    include: {
      tables: { include: { table: { select: { id: true, label: true } } } },
    },
  });

  if (!reservation) {
    throw new NotFoundError('Hold reservation');
  }

  // Check if HOLD has expired
  if (reservation.holdExpiresAt && reservation.holdExpiresAt < new Date()) {
    // Clean up expired hold
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { status: 'EXPIRED' },
    });
    throw new AppError('Your reservation hold has expired. Please try again.', 410);
  }

  // Load config for auto-confirm setting
  const config = await prisma.seatingConfig.findUnique({
    where: { tenantId },
  });

  const newStatus = config?.autoConfirm ? 'CONFIRMED' : 'PENDING';

  // Update guest + reservation in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Find or create proper guest
    let guest = await tx.guest.findFirst({
      where: { tenantId, email: guestEmail },
    });

    if (guest) {
      // Update existing guest
      await tx.guest.update({
        where: { id: guest.id },
        data: { name: guestName, phone: guestPhone || guest.phone },
      });
    } else {
      // The placeholder guest from HOLD
      guest = await tx.guest.update({
        where: { id: reservation.guestId },
        data: {
          name: guestName,
          email: guestEmail,
          phone: guestPhone || null,
        },
      });
    }

    // If guest was different from placeholder, update reservation
    const guestId = guest.id !== reservation.guestId ? guest.id : reservation.guestId;

    // Update reservation
    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        guestId,
        status: newStatus,
        notes: notes || null,
        holdExpiresAt: null, // Clear hold
        holdSessionToken: null,
        paymentIntentId: paymentIntentId || null,
        paymentStatus: paymentIntentId ? 'deposit' : 'none',
        confirmedAt: newStatus === 'CONFIRMED' ? new Date() : null,
      },
      include: {
        guest: true,
        tables: { include: { table: { select: { id: true, label: true } } } },
      },
    });

    // Delete placeholder guest if we used existing
    if (guest.id !== reservation.guestId) {
      await tx.guest.delete({ where: { id: reservation.guestId } }).catch(() => {});
    }

    return updated;
  });

  await createAuditLog({
    tenantId,
    userId: params.userId || null,
    action: 'status_change',
    entityType: 'reservation',
    entityId: reservationId,
    changes: { from: 'HOLD', to: newStatus, guestEmail },
  });

  return result;
}

/**
 * Abandon a HOLD (guest closed widget)
 */
export async function abandonHold(reservationId: string, tenantId: string, sessionToken: string) {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      tenantId,
      status: 'HOLD',
      holdSessionToken: sessionToken,
    },
  });

  if (!reservation) return; // Already expired or completed, no-op

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'ABANDONED', holdExpiresAt: null, holdSessionToken: null },
    });

    // Delete placeholder guest
    await tx.guest.delete({ where: { id: reservation.guestId } }).catch(() => {});
  });
}

/**
 * Cleanup expired HOLDs (called by cron job)
 */
export async function cleanupExpiredHolds() {
  const expired = await prisma.reservation.findMany({
    where: {
      status: 'HOLD',
      holdExpiresAt: { lt: new Date() },
    },
    select: { id: true, guestId: true, tenantId: true },
  });

  if (expired.length === 0) return 0;

  for (const hold of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: hold.id },
        data: { status: 'EXPIRED', holdExpiresAt: null, holdSessionToken: null },
      });

      // Delete placeholder guest (only if it's a placeholder)
      const guest = await tx.guest.findUnique({ where: { id: hold.guestId } });
      if (guest?.email?.includes('@placeholder.local')) {
        // Delete any reservations referencing this guest first to avoid FK violation
        await tx.reservation.deleteMany({ where: { guestId: hold.guestId } });
        await tx.guest.delete({ where: { id: hold.guestId } });
      }
    });
  }

  console.log(`[HoldCleanup] Expired ${expired.length} holds`);
  return expired.length;
}
