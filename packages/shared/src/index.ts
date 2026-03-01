import { z } from 'zod';

// ---- Common ----

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:mm)');

// ---- Auth ----

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
});

// ---- Tenant ----

export const createTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  address: z.string().min(5),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email(),
  timezone: z.string().default('Europe/Ljubljana'),
});

export const updateTenantSchema = createTenantSchema.partial();

// ---- User / Staff ----

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(255),
  role: z.enum(['owner', 'admin', 'manager', 'staff']),
  password: z.string().min(8),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  role: z.enum(['owner', 'admin', 'manager', 'staff']).optional(),
  isActive: z.boolean().optional(),
  permissions: z.record(z.boolean()).optional(),
});

// ---- Floor Plan ----

export const createFloorPlanSchema = z.object({
  name: z.string().min(1).max(255),
  layoutConfig: z.record(z.unknown()).default({}),
});

export const updateFloorPlanSchema = createFloorPlanSchema.partial();

// ---- Table ----

export const createTableSchema = z.object({
  floorPlanId: z.string().uuid(),
  label: z.string().min(1).max(50),
  minSeats: z.number().int().min(1).max(50),
  maxSeats: z.number().int().min(1).max(50),
  joinGroup: z.string().max(50).nullable().optional(),
  joinPriority: z.number().int().min(0).default(0),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(20).default(80),
  height: z.number().min(20).default(80),
  shape: z.enum(['square', 'round', 'rectangle']).default('square'),
  isCombinable: z.boolean().default(false),
  isVip: z.boolean().default(false),
}).refine(data => data.maxSeats >= data.minSeats, {
  message: 'maxSeats must be >= minSeats',
  path: ['maxSeats'],
});

export const updateTableSchema = createTableSchema.partial().omit({ floorPlanId: true } as any);

// ---- Table Adjacency ----

export const createAdjacencySchema = z.object({
  tableAId: z.string().uuid(),
  tableBId: z.string().uuid(),
  canJoin: z.boolean().default(true),
  joinMaxSeats: z.number().int().min(1).nullable().optional(),
}).refine(data => data.tableAId !== data.tableBId, {
  message: 'Tables must be different',
  path: ['tableBId'],
});

// ---- Guest ----

export const createGuestSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

export const updateGuestSchema = createGuestSchema.partial();

// ---- Reservation ----

export const createReservationSchema = z.object({
  guestId: z.string().uuid().optional(),
  // Inline guest creation (when guestId not provided)
  guestName: z.string().min(1).max(255).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(50).optional(),
  // Reservation fields
  date: dateSchema,
  time: timeSchema,
  durationMinutes: z.number().int().min(15).max(480).default(90),
  partySize: z.number().int().min(1).max(50),
  source: z.enum(['online', 'walk_in', 'phone', 'manual']).default('manual'),
  offerId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  tableIds: z.array(z.string().uuid()).optional(),
}).refine(
  data => data.guestId || data.guestName,
  { message: 'Either guestId or guestName is required', path: ['guestId'] }
);

export const updateReservationSchema = z.object({
  date: dateSchema.optional(),
  time: timeSchema.optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(1000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  tableIds: z.array(z.string().uuid()).optional(),
});

export const updateReservationStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  reason: z.string().max(500).optional(),
});

// ---- Hold ----

export const createHoldSchema = z.object({
  date: dateSchema,
  time: timeSchema,
  partySize: z.number().int().min(1).max(50),
  durationMinutes: z.number().int().min(15).max(480).optional(),
});

export const completeHoldSchema = z.object({
  guestName: z.string().min(1).max(255),
  guestEmail: z.string().email(),
  guestPhone: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  sessionToken: z.string(),
  paymentIntentId: z.string().optional(),
});

// ---- Availability ----

export const availabilityQuerySchema = z.object({
  date: dateSchema,
  partySize: z.coerce.number().int().min(1).max(50).optional(),
});

// ---- Operating Hours ----

export const operatingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: timeSchema,
  closeTime: timeSchema,
  lastReservation: timeSchema,
  isClosed: z.boolean().default(false),
  slotDurationMin: z.number().int().min(15).max(120).default(30),
});

export const bulkOperatingHoursSchema = z.object({
  hours: z.array(operatingHoursSchema).length(7),
});

// ---- Special Dates ----

export const createSpecialDateSchema = z.object({
  date: dateSchema,
  isClosed: z.boolean().default(false),
  customHours: z.record(z.unknown()).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
});

// ---- Seating Config ----

export const updateSeatingConfigSchema = z.object({
  holdTtlSeconds: z.number().int().min(60).max(1800).optional(),
  maxJoinTables: z.number().int().min(1).max(5).optional(),
  autoConfirm: z.boolean().optional(),
  noShowTimeoutMin: z.number().int().min(5).max(60).optional(),
  cancellationFeeHours: z.number().int().min(0).max(72).optional(),
  scoringWeights: z.object({
    waste: z.number().min(0).max(5),
    join: z.number().min(0).max(5),
    vip: z.number().min(0).max(5),
    zone: z.number().min(0).max(5),
  }).optional(),
  defaultDurationMin: z.number().int().min(15).max(480).optional(),
  maxPartySize: z.number().int().min(1).max(50).optional(),
  minAdvanceHours: z.number().int().min(0).max(168).optional(),
  maxAdvanceDays: z.number().int().min(1).max(365).optional(),
});

// ---- Waitlist ----

export const createWaitlistSchema = z.object({
  guestId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(255).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(50).optional(),
  date: dateSchema,
  time: timeSchema,
  partySize: z.number().int().min(1).max(50),
});
