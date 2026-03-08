import { prisma } from '../utils/prisma.js';
import { getBlockingStatuses } from '@yourtable/shared';

/**
 * Get all occupied table IDs for a given tenant, date, and time range
 * Considers: HOLD, PENDING, CONFIRMED, SEATED reservations
 * that overlap with the requested time window
 */
export async function getOccupiedTableIds(
  tenantId: string,
  date: Date,
  time: string,
  durationMinutes: number
): Promise<Set<string>> {
  const blockingStatuses = getBlockingStatuses();

  // Calculate time window
  const [hours, minutes] = time.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;

  // Find all reservations that overlap with requested time window
  const overlapping = await prisma.reservation.findMany({
    where: {
      tenantId,
      date,
      status: { in: blockingStatuses as any },
      // Also filter out expired HOLDs (belt and suspenders - cleanup job handles this too)
      OR: [
        { holdExpiresAt: null },
        { holdExpiresAt: { gt: new Date() } },
      ],
    },
    include: {
      tables: { select: { tableId: true } },
    },
  });

  const occupiedIds = new Set<string>();

  for (const res of overlapping) {
    // Parse reservation time window
    const [rH, rM] = res.time.split(':').map(Number);
    const rStart = rH * 60 + rM;
    const rEnd = rStart + res.durationMinutes;

    // Check overlap: two intervals overlap if start1 < end2 AND start2 < end1
    if (startMinutes < rEnd && rStart < endMinutes) {
      for (const rt of res.tables) {
        occupiedIds.add(rt.tableId);
      }
    }
  }

  return occupiedIds;
}

/**
 * Get real-time status of all tables for a specific time slot
 * Returns table info with availability status
 */
export async function getTableStatuses(
  tenantId: string,
  date: Date,
  time: string,
  durationMinutes: number = 90
) {
  // Get all active tables for this tenant
  const floorPlans = await prisma.floorPlan.findMany({
    where: { tenantId, isActive: true },
    include: {
      tables: {
        where: { isActive: true },
        orderBy: { label: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const occupiedIds = await getOccupiedTableIds(tenantId, date, time, durationMinutes);

  // Get reservation details for occupied tables
  const blockingStatuses = getBlockingStatuses();
  const reservations = await prisma.reservation.findMany({
    where: {
      tenantId,
      date,
      status: { in: blockingStatuses as any },
    },
    include: {
      tables: { select: { tableId: true } },
      guest: { select: { name: true, tags: true } },
    },
  });

  // Map tableId -> reservation info
  const tableReservationMap = new Map<string, {
    reservationId: string;
    guestName: string;
    partySize: number;
    time: string;
    durationMinutes: number;
    status: string;
    tags: unknown;
  }>();

  for (const res of reservations) {
    const [rH, rM] = res.time.split(':').map(Number);
    const rStart = rH * 60 + rM;
    const rEnd = rStart + res.durationMinutes;
    const [qH, qM] = time.split(':').map(Number);
    const qStart = qH * 60 + qM;
    const qEnd = qStart + durationMinutes;

    if (qStart < rEnd && rStart < qEnd) {
      for (const rt of res.tables) {
        tableReservationMap.set(rt.tableId, {
          reservationId: res.id,
          guestName: res.guest.name,
          partySize: res.partySize,
          time: res.time,
          durationMinutes: res.durationMinutes,
          status: res.status,
          tags: res.guest.tags,
        });
      }
    }
  }

  return floorPlans.map(fp => ({
    id: fp.id,
    name: fp.name,
    layoutConfig: fp.layoutConfig,
    tables: fp.tables.map(table => ({
      id: table.id,
      label: table.label,
      minSeats: table.minSeats,
      maxSeats: table.maxSeats,
      positionX: table.positionX,
      positionY: table.positionY,
      width: table.width,
      height: table.height,
      shape: table.shape,
      isVip: table.isVip,
      isCombinable: table.isCombinable,
      joinGroup: table.joinGroup,
      isOccupied: occupiedIds.has(table.id),
      reservation: tableReservationMap.get(table.id) || null,
    })),
  }));
}
