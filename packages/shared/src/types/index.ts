// ============================================
// YourTable.top - Core Type Definitions
// ============================================

// ---- Enums ----

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff';

export type ReservationStatus =
  | 'HOLD'
  | 'PENDING'
  | 'CONFIRMED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'ABANDONED';

export type ReservationSource = 'online' | 'walk_in' | 'phone' | 'manual';

export type PaymentStatus = 'none' | 'deposit' | 'paid' | 'refunded';

export type TableShape = 'square' | 'round' | 'rectangle';

export type AssignedBy = 'auto' | 'manual';

export type VoucherStatus = 'active' | 'used' | 'expired' | 'cancelled';
export type VoucherType = 'digital' | 'physical';
export type DeliveryMethod = 'email' | 'print' | 'pickup' | 'delivery';

export type NotificationType =
  | 'confirmation'
  | 'reminder'
  | 'cancellation'
  | 'review_request'
  | 'waitlist_offer';

export type NotificationChannel = 'email' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export type WaitlistStatus = 'waiting' | 'offered' | 'accepted' | 'expired';

// ---- Base Entity ----

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Tenant ----

export interface Tenant extends BaseEntity {
  name: string;
  slug: string;
  address: string;
  phone: string | null;
  email: string;
  timezone: string;
  settings: TenantSettings;
  stripeAccountId: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

export interface TenantSettings {
  languages: string[];
  currency: string;
  notificationsEnabled: boolean;
  bookingWidgetEnabled: boolean;
}

// ---- User (Staff) ----

export interface User extends BaseEntity {
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Record<string, boolean>;
  isActive: boolean;
  supabaseUserId: string;
}

// ---- Floor Plan ----

export interface FloorPlan extends BaseEntity {
  tenantId: string;
  name: string;
  layoutConfig: Record<string, unknown>;
  isActive: boolean;
}

// ---- Table ----

export interface RestaurantTable extends BaseEntity {
  floorPlanId: string;
  label: string;
  minSeats: number;
  maxSeats: number;
  joinGroup: string | null;
  joinPriority: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  shape: TableShape;
  isCombinable: boolean;
  isVip: boolean;
  isActive: boolean;
}

// ---- Table Adjacency ----

export interface TableAdjacency {
  tableAId: string;
  tableBId: string;
  canJoin: boolean;
  joinMaxSeats: number | null;
}

// ---- Guest ----

export interface Guest extends BaseEntity {
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  notes: string | null;
  visitCount: number;
  noShowCount: number;
  isBlacklisted: boolean;
}

// ---- Reservation ----

export interface Reservation extends BaseEntity {
  tenantId: string;
  guestId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMinutes: number;
  partySize: number;
  status: ReservationStatus;
  source: ReservationSource;
  offerId: string | null;
  notes: string | null;
  internalNotes: string | null;
  tags: string[];
  paymentStatus: PaymentStatus;
  paymentIntentId: string | null;
  cancellationFee: number | null;
  cancellationReason: string | null;
  holdExpiresAt: Date | null;
  holdSessionToken: string | null;
  version: number;
  assignedBy: AssignedBy;
  noShowFeeCharged: boolean;
  sourceIp: string | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  reminderSentAt: Date | null;
  // Relations
  guest?: Guest;
  tables?: RestaurantTable[];
}

// ---- Seating Config ----

export interface SeatingConfig {
  tenantId: string;
  holdTtlSeconds: number;
  maxJoinTables: number;
  autoConfirm: boolean;
  noShowTimeoutMin: number;
  cancellationFeeHours: number;
  scoringWeights: ScoringWeights;
  defaultDurationMin: number;
  maxPartySize: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
}

export interface ScoringWeights {
  waste: number;
  join: number;
  vip: number;
  zone: number;
}

// ---- Operating Hours ----

export interface OperatingHours {
  tenantId: string;
  dayOfWeek: number; // 0=Mon, 6=Sun
  openTime: string;
  closeTime: string;
  lastReservation: string;
  isClosed: boolean;
  slotDurationMin: number;
}

// ---- Special Dates ----

export interface SpecialDate extends BaseEntity {
  tenantId: string;
  date: string;
  isClosed: boolean;
  customHours: Record<string, unknown> | null;
  note: string | null;
}

// ---- Waitlist ----

export interface WaitlistEntry extends BaseEntity {
  tenantId: string;
  guestId: string;
  date: string;
  time: string;
  partySize: number;
  status: WaitlistStatus;
  priority: number;
  offeredAt: Date | null;
  expiresAt: Date | null;
}

// ---- Audit Log ----

export interface AuditLogEntry extends BaseEntity {
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
}

// ---- API Response Types ----

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, string[]>;
}

// ---- Availability ----

export interface TimeSlot {
  time: string; // HH:mm
  available: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  occupancyPercent: number;
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
  isClosed: boolean;
  specialNote: string | null;
}

// ---- Hold ----

export interface HoldResponse {
  reservationId: string;
  holdExpiresAt: string;
  assignedTables: { id: string; label: string }[];
  sessionToken: string;
}
