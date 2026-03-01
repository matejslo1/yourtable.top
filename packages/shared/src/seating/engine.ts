/**
 * YourTable.top - Seating Engine
 * 
 * Optimal table assignment algorithm with:
 * - Single table matching
 * - Multi-table combination (join groups + adjacency)
 * - Scoring: waste penalty + join penalty + VIP bonus + zone preference
 * - HOLD-aware: excludes tables with active holds/reservations
 */

export interface TableInfo {
  id: string;
  label: string;
  minSeats: number;
  maxSeats: number;
  joinGroup: string | null;
  joinPriority: number;
  isCombinable: boolean;
  isVip: boolean;
  floorPlanId: string;
}

export interface AdjacencyInfo {
  tableAId: string;
  tableBId: string;
  canJoin: boolean;
  joinMaxSeats: number | null;
}

export interface ScoringWeights {
  waste: number;  // penalty for unused seats (default 1.0)
  join: number;   // penalty for combining tables (default 1.0)
  vip: number;    // bonus for VIP match (default 1.0)
  zone: number;   // bonus for zone preference (default 0.5)
}

export interface SeatingRequest {
  partySize: number;
  isVipGuest?: boolean;
  preferredZone?: string | null;  // floor_plan_id or join_group
  maxJoinTables: number;          // from seating_config
  scoringWeights: ScoringWeights;
}

export interface TableCandidate {
  tables: TableInfo[];
  score: number;
  breakdown: {
    wastePenalty: number;
    joinPenalty: number;
    vipBonus: number;
    zoneBonus: number;
  };
  totalCapacity: number;
}

/**
 * Find optimal table assignment for a reservation
 * Returns sorted candidates (best first) or empty array if nothing fits
 */
export function findOptimalTables(
  availableTables: TableInfo[],
  adjacency: AdjacencyInfo[],
  request: SeatingRequest
): TableCandidate[] {
  const { partySize, maxJoinTables, scoringWeights } = request;
  const candidates: TableCandidate[] = [];

  // Phase A: Single table candidates
  for (const table of availableTables) {
    if (table.maxSeats >= partySize && table.minSeats <= partySize) {
      candidates.push(scoreCandidate([table], request));
    }
  }

  // Phase B: Multi-table combinations (only if no single table fits or for optimization)
  if (maxJoinTables >= 2) {
    const combinables = availableTables.filter(t => t.isCombinable && t.joinGroup);
    
    // Group by joinGroup
    const groups = new Map<string, TableInfo[]>();
    for (const table of combinables) {
      const group = table.joinGroup!;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(table);
    }

    // Build adjacency lookup
    const adjMap = new Map<string, Set<string>>();
    const adjMaxSeats = new Map<string, number>();
    for (const adj of adjacency) {
      if (!adj.canJoin) continue;
      if (!adjMap.has(adj.tableAId)) adjMap.set(adj.tableAId, new Set());
      if (!adjMap.has(adj.tableBId)) adjMap.set(adj.tableBId, new Set());
      adjMap.get(adj.tableAId)!.add(adj.tableBId);
      adjMap.get(adj.tableBId)!.add(adj.tableAId);
      if (adj.joinMaxSeats) {
        const key = [adj.tableAId, adj.tableBId].sort().join(':');
        adjMaxSeats.set(key, adj.joinMaxSeats);
      }
    }

    // Generate combinations within each join group
    for (const [_groupName, groupTables] of groups) {
      // Sort by join priority for deterministic results
      const sorted = [...groupTables].sort((a, b) => a.joinPriority - b.joinPriority);
      
      // 2-table combinations
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const t1 = sorted[i];
          const t2 = sorted[j];
          
          // Check adjacency
          if (!adjMap.get(t1.id)?.has(t2.id)) continue;
          
          const combo = [t1, t2];
          const totalMax = getComboMaxSeats(combo, adjMaxSeats);
          const totalMin = combo.reduce((sum, t) => sum + t.minSeats, 0);
          
          if (totalMax >= partySize && totalMin <= partySize) {
            candidates.push(scoreCandidate(combo, request));
          }

          // 3-table combinations
          if (maxJoinTables >= 3 && sorted.length > 2) {
            for (let k = j + 1; k < sorted.length; k++) {
              const t3 = sorted[k];
              // t3 must be adjacent to at least one of t1, t2
              if (!adjMap.get(t3.id)?.has(t1.id) && !adjMap.get(t3.id)?.has(t2.id)) continue;
              
              const triCombo = [t1, t2, t3];
              const triMax = getComboMaxSeats(triCombo, adjMaxSeats);
              const triMin = triCombo.reduce((sum, t) => sum + t.minSeats, 0);
              
              if (triMax >= partySize && triMin <= partySize) {
                candidates.push(scoreCandidate(triCombo, request));
              }
            }
          }
        }
      }
    }
  }

  // Sort by score (lowest = best)
  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Tiebreaker: fewer tables preferred
    if (a.tables.length !== b.tables.length) return a.tables.length - b.tables.length;
    // Tiebreaker: lower join priority
    const aPrio = Math.min(...a.tables.map(t => t.joinPriority));
    const bPrio = Math.min(...b.tables.map(t => t.joinPriority));
    return aPrio - bPrio;
  });

  return candidates;
}

/**
 * Score a table candidate - lower score is better
 */
function scoreCandidate(tables: TableInfo[], request: SeatingRequest): TableCandidate {
  const { partySize, isVipGuest, preferredZone, scoringWeights } = request;
  
  const totalCapacity = tables.reduce((sum, t) => sum + t.maxSeats, 0);
  
  // Waste penalty: how much capacity is wasted (0-100)
  const wastePenalty = ((totalCapacity - partySize) / totalCapacity) * 100;
  
  // Join penalty: penalize combining tables
  let joinPenalty = 0;
  if (tables.length === 2) joinPenalty = 30;
  else if (tables.length === 3) joinPenalty = 50;
  else if (tables.length > 3) joinPenalty = 80;
  
  // VIP bonus: negative score (=better) if VIP guest + VIP table
  let vipBonus = 0;
  if (isVipGuest && tables.some(t => t.isVip)) {
    vipBonus = -20;
  } else if (!isVipGuest && tables.some(t => t.isVip)) {
    // Slight penalty for seating non-VIP at VIP table (preserve for VIPs)
    vipBonus = 10;
  }
  
  // Zone preference bonus
  let zoneBonus = 0;
  if (preferredZone) {
    const matchesFloor = tables.some(t => t.floorPlanId === preferredZone);
    const matchesGroup = tables.some(t => t.joinGroup === preferredZone);
    if (matchesFloor || matchesGroup) {
      zoneBonus = -10;
    }
  }
  
  const score = 
    scoringWeights.waste * wastePenalty +
    scoringWeights.join * joinPenalty +
    scoringWeights.vip * vipBonus +
    scoringWeights.zone * zoneBonus;
  
  return {
    tables,
    score: Math.round(score * 100) / 100,
    breakdown: {
      wastePenalty: Math.round(wastePenalty * 100) / 100,
      joinPenalty,
      vipBonus,
      zoneBonus,
    },
    totalCapacity,
  };
}

/**
 * Get max seats for a combination (uses adjacency overrides if available)
 */
function getComboMaxSeats(tables: TableInfo[], adjMaxSeats: Map<string, number>): number {
  // Check if there's an adjacency override for this exact pair
  if (tables.length === 2) {
    const key = [tables[0].id, tables[1].id].sort().join(':');
    const override = adjMaxSeats.get(key);
    if (override) return override;
  }
  
  // Default: sum of individual max seats
  return tables.reduce((sum, t) => sum + t.maxSeats, 0);
}

/**
 * Check if a specific set of tables is available for a given time slot
 */
export function areTablesAvailable(
  tableIds: string[],
  occupiedTableIds: Set<string>
): boolean {
  return tableIds.every(id => !occupiedTableIds.has(id));
}

/**
 * Get all occupied table IDs for a given date/time/duration
 * This includes HOLD, PENDING, CONFIRMED, SEATED reservations
 */
export function getBlockingStatuses(): string[] {
  return ['HOLD', 'PENDING', 'CONFIRMED', 'SEATED'];
}
