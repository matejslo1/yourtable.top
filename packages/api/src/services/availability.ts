import { prisma } from '../utils/prisma.js';
import { getOccupiedTableIds } from './tableStatus.js';
import { findOptimalTables, type TableInfo, type AdjacencyInfo, type SeatingRequest } from '@yourtable/shared';

interface AvailabilityParams {
  tenantId: string;
  date: Date;
  partySize?: number;
}

interface SlotAvailability {
  time: string;
  available: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  occupancyPercent: number;
}

/**
 * Get availability for a specific date
 * Returns time slots with occupancy information
 */
export async function getAvailability(params: AvailabilityParams) {
  const { tenantId, date, partySize } = params;

  // Get day of week (0=Mon in our system)
  const jsDay = date.getDay(); // 0=Sun
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Mon

  // Check special dates first
  const specialDate = await prisma.specialDate.findFirst({
    where: { tenantId, date },
  });

  if (specialDate?.isClosed) {
    return {
      date: date.toISOString().split('T')[0],
      isClosed: true,
      specialNote: specialDate.note,
      slots: [],
    };
  }

  // Get operating hours
  const hours = await prisma.operatingHours.findFirst({
    where: { tenantId, dayOfWeek },
  });

  if (!hours || hours.isClosed) {
    return {
      date: date.toISOString().split('T')[0],
      isClosed: true,
      specialNote: null,
      slots: [],
    };
  }

  // Load seating config
  const config = await prisma.seatingConfig.findUnique({
    where: { tenantId },
  });
  if (!config) {
    return { date: date.toISOString().split('T')[0], isClosed: false, specialNote: null, slots: [] };
  }

  // Load all tables + adjacency
  const floorPlans = await prisma.floorPlan.findMany({
    where: { tenantId, isActive: true },
    include: {
      tables: {
        where: { isActive: true },
        include: { adjacencyA: true, adjacencyB: true },
      },
    },
  });

  const allTables: TableInfo[] = [];
  const allAdjacency: AdjacencyInfo[] = [];
  const seenAdj = new Set<string>();
  let totalCapacity = 0;

  for (const fp of floorPlans) {
    for (const table of fp.tables) {
      allTables.push({
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
      totalCapacity += table.maxSeats;

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

  // Generate time slots
  const slotDuration = hours.slotDurationMin;
  const [openH, openM] = hours.openTime.split(':').map(Number);
  const [lastH, lastM] = hours.lastReservation.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const lastMinutes = lastH * 60 + lastM;

  const slots: SlotAvailability[] = [];
  const durationMinutes = config.defaultDurationMin;

  for (let m = openMinutes; m <= lastMinutes; m += slotDuration) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    const time = `${hh}:${mm}`;

    const occupiedIds = await getOccupiedTableIds(tenantId, date, time, durationMinutes);
    const occupiedCapacity = allTables
      .filter(t => occupiedIds.has(t.id))
      .reduce((sum, t) => sum + t.maxSeats, 0);

    const remainingCapacity = totalCapacity - occupiedCapacity;
    const occupancyPercent = totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0;

    // If party size given, check if we can actually seat them
    let canSeat = remainingCapacity > 0;
    if (partySize && canSeat) {
      const available = allTables.filter(t => !occupiedIds.has(t.id));
      const seatingRequest: SeatingRequest = {
        partySize,
        maxJoinTables: config.maxJoinTables,
        scoringWeights: config.scoringWeights as any,
      };
      const candidates = findOptimalTables(available, allAdjacency, seatingRequest);
      canSeat = candidates.length > 0;
    }

    slots.push({
      time,
      available: canSeat,
      remainingCapacity,
      totalCapacity,
      occupancyPercent,
    });
  }

  return {
    date: date.toISOString().split('T')[0],
    isClosed: false,
    specialNote: specialDate?.note || null,
    slots,
  };
}
