import { prisma } from '../utils/prisma.js';
import { findOptimalTables, type TableInfo, type AdjacencyInfo, type SeatingRequest } from '@yourtable/shared';
import { getOccupiedTableIds } from './tableStatus.js';
import { createAuditLog } from '../utils/audit.js';
import { AppError, NotFoundError, ConflictError } from '../utils/errors.js';

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  HOLD: ['PENDING', 'CONFIRMED', 'EXPIRED', 'ABANDONED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
  ABANDONED: [],
};

interface CreateReservationParams {
  tenantId: string;
  userId: string;
  guestId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  date: Date;
  time: string;
  durationMinutes: number;
  partySize: number;
  source: string;
  notes?: string;
  internalNotes?: string;
  tableIds?: string[];
}

/**
 * Create a reservation (staff-initiated: manual, phone, walk-in)
 * Unlike HOLD flow, this goes directly to PENDING or CONFIRMED
 */
export async function createReservation(params: CreateReservationParams) {
  const {
    tenantId, userId, date, time, durationMinutes, partySize,
    source, notes, internalNotes, tableIds,
  } = params;

  // Load config
  const config = await prisma.seatingConfig.findUnique({ where: { tenantId } });
  if (!config) throw new AppError('Seating configuration not found', 400);

  // Resolve or create guest
  let guestId = params.guestId;
  if (!guestId) {
    if (!params.guestName) throw new AppError('Guest name or guestId is required', 400);
    
    // Try find existing guest by email
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

  // Assign tables
  let assignedTableIds: string[] = [];
  let assignedBy: 'auto' | 'manual' = 'auto';

  if (tableIds && tableIds.length > 0) {
    // Manual table assignment by staff
    assignedTableIds = tableIds;
    assignedBy = 'manual';

    // Verify tables exist and are available
    const occupiedIds = await getOccupiedTableIds(tenantId, date, time, durationMinutes);
    const conflicting = tableIds.filter(id => occupiedIds.has(id));
    if (conflicting.length > 0) {
      throw new ConflictError('One or more selected tables are already occupied for this time slot');
    }
  } else {
    // Auto-assign using seating engine
    const occupiedIds = await getOccupiedTableIds(tenantId, date, time, durationMinutes);

    const floorPlans = await prisma.floorPlan.findMany({
      where: { tenantId, isActive: true },
      include: {
        tables: {
          where: { isActive: true },
          include: { adjacencyA: true, adjacencyB: true },
        },
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
            allAdjacency.push({
              tableAId: adj.tableAId, tableBId: adj.tableBId,
              canJoin: adj.canJoin, joinMaxSeats: adj.joinMaxSeats,
            });
          }
        }
      }
    }

    // Check if guest is VIP
    const guest = await prisma.guest.findUnique({ where: { id: guestId } });
    const isVip = Array.isArray(guest?.tags) && (guest.tags as string[]).includes('VIP');

    const candidates = findOptimalTables(availableTables, allAdjacency, {
      partySize,
      isVipGuest: isVip,
      maxJoinTables: config.maxJoinTables,
      scoringWeights: config.scoringWeights as any,
    });

    if (candidates.length === 0) {
      throw new ConflictError('No tables available for this time and party size');
    }

    assignedTableIds = candidates[0].tables.map(t => t.id);
  }

  const status = config.autoConfirm ? 'CONFIRMED' : 'PENDING';

  // Create reservation
  const reservation = await prisma.reservation.create({
    data: {
      tenantId,
      guestId: guestId!,
      date,
      time,
      durationMinutes,
      partySize,
      status,
      source: source as any,
      notes: notes || null,
      internalNotes: internalNotes || null,
      assignedBy,
      confirmedAt: status === 'CONFIRMED' ? new Date() : null,
      tables: {
        create: assignedTableIds.map(tableId => ({ tableId })),
      },
    },
    include: {
      guest: true,
      tables: { include: { table: { select: { id: true, label: true } } } },
    },
  });

  await createAuditLog({
    tenantId,
    userId,
    action: 'create',
    entityType: 'reservation',
    entityId: reservation.id,
    changes: { status, source, partySize, tableIds: assignedTableIds },
  });

  return reservation;
}

/**
 * Update reservation status with validation
 */
export async function updateReservationStatus(
  reservationId: string,
  tenantId: string,
  userId: string,
  newStatus: string,
  reason?: string
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, tenantId },
    include: { guest: true },
  });

  if (!reservation) throw new NotFoundError('Reservation', reservationId);

  // Validate status transition
  const allowed = STATUS_TRANSITIONS[reservation.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot change status from ${reservation.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`,
      400
    );
  }

  const updateData: any = {
    status: newStatus,
    version: { increment: 1 },
  };

  // Status-specific side effects
  switch (newStatus) {
    case 'CONFIRMED':
      updateData.confirmedAt = new Date();
      break;

    case 'CANCELLED':
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = reason || null;
      break;

    case 'NO_SHOW':
      // Increment guest no-show count
      await prisma.guest.update({
        where: { id: reservation.guestId },
        data: { noShowCount: { increment: 1 } },
      });
      break;

    case 'COMPLETED':
      // Increment guest visit count
      await prisma.guest.update({
        where: { id: reservation.guestId },
        data: { visitCount: { increment: 1 } },
      });
      break;

    case 'SEATED':
      // Nothing extra for now
      break;
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: updateData,
    include: {
      guest: true,
      tables: { include: { table: { select: { id: true, label: true } } } },
    },
  });

  await createAuditLog({
    tenantId,
    userId,
    action: 'status_change',
    entityType: 'reservation',
    entityId: reservationId,
    changes: { from: reservation.status, to: newStatus, reason },
  });

  return updated;
}

/**
 * Update reservation details (date, time, party size, tables)
 */
export async function updateReservation(
  reservationId: string,
  tenantId: string,
  userId: string,
  data: {
    date?: Date;
    time?: string;
    durationMinutes?: number;
    partySize?: number;
    notes?: string | null;
    internalNotes?: string | null;
    tableIds?: string[];
  }
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, tenantId },
  });

  if (!reservation) throw new NotFoundError('Reservation', reservationId);

  // Can only edit active reservations
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED', 'ABANDONED'].includes(reservation.status)) {
    throw new AppError(`Cannot edit a ${reservation.status} reservation`, 400);
  }

  const updateData: any = {
    version: { increment: 1 },
  };

  if (data.date !== undefined) updateData.date = data.date;
  if (data.time !== undefined) updateData.time = data.time;
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.partySize !== undefined) updateData.partySize = data.partySize;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;

  // If table reassignment requested
  if (data.tableIds) {
    const date = data.date || reservation.date;
    const time = data.time || reservation.time;
    const duration = data.durationMinutes || reservation.durationMinutes;

    // Check availability (exclude current reservation)
    const occupiedIds = await getOccupiedTableIds(tenantId, date, time, duration);
    // Remove current reservation's tables from occupied set
    const currentTables = await prisma.reservationTable.findMany({
      where: { reservationId },
    });
    for (const ct of currentTables) {
      occupiedIds.delete(ct.tableId);
    }

    const conflicting = data.tableIds.filter(id => occupiedIds.has(id));
    if (conflicting.length > 0) {
      throw new ConflictError('One or more selected tables are occupied');
    }

    // Replace table assignments
    await prisma.reservationTable.deleteMany({ where: { reservationId } });
    await prisma.reservationTable.createMany({
      data: data.tableIds.map(tableId => ({ reservationId, tableId })),
    });
    updateData.assignedBy = 'manual';
  }

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: updateData,
    include: {
      guest: true,
      tables: { include: { table: { select: { id: true, label: true } } } },
    },
  });

  await createAuditLog({
    tenantId,
    userId,
    action: 'update',
    entityType: 'reservation',
    entityId: reservationId,
    changes: { before: reservation, after: updated },
  });

  return updated;
}
