const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
}

async function api<T>(tenantSlug: string, path: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE}/api/v1/public/${tenantSlug}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    // 409 = no tables available (special case)
    if (res.status === 409) {
      const err = new Error(json.message || 'Ni prostih miz') as any;
      err.code = 'NO_TABLES';
      err.canWaitlist = json.canWaitlist;
      err.alternatives = json.alternatives || [];
      throw err;
    }
    const details = json.details
      ? Object.entries(json.details).map(([f, msgs]) => `${f}: ${(msgs as string[]).join(', ')}`).join('; ')
      : null;
    throw new Error(details || json.message || `API error: ${res.status}`);
  }

  return json.data ?? json;
}

// ─── Widget Config ───────────────────────────────────────────────────────────

export interface WidgetConfig {
  name: string;
  slug: string;
  logoUrl: string | null;
  timezone: string;
  maxPartySize: number;
  holdTtlSeconds: number;
  bookingWidgetEnabled: boolean;
  waitlistEnabled?: boolean;
}

export function fetchConfig(slug: string): Promise<WidgetConfig> {
  return api(slug, '/config');
}

// ─── Availability ────────────────────────────────────────────────────────────

export interface TimeSlot {
  time: string;
  available: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  occupancyPercent: number;
}

export interface DayAvailability {
  date: string;
  isClosed: boolean;
  specialNote: string | null;
  available: boolean;
  slots: TimeSlot[];
  alternatives?: string[];
}

export function fetchAvailability(slug: string, date: string, partySize?: number): Promise<DayAvailability> {
  const params = new URLSearchParams({ date });
  if (partySize) params.set('partySize', String(partySize));
  return api(slug, `/availability?${params}`);
}

// ─── Hold ────────────────────────────────────────────────────────────────────

export interface HoldResponse {
  reservationId: string;
  holdExpiresAt: string;
  sessionToken: string;
  assignedTables: { id: string; label: string }[];
}

export function createHold(slug: string, data: {
  date: string;
  time: string;
  partySize: number;
  durationMinutes?: number;
}): Promise<HoldResponse> {
  return api(slug, '/hold', { method: 'POST', body: data });
}

export interface CompleteResponse {
  success: boolean;
  reservationId: string;
  cancelToken: string;
}

export function completeHold(slug: string, holdId: string, data: {
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  sessionToken: string;
}): Promise<CompleteResponse> {
  return api(slug, `/hold/${holdId}/complete`, { method: 'POST', body: data });
}

export function abandonHold(slug: string, holdId: string, sessionToken: string): void {
  const url = `${API_BASE}/api/v1/public/${slug}/hold/${holdId}`;
  const body = JSON.stringify({ sessionToken });
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    fetch(url, { method: 'DELETE', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  }
}

// ─── Waitlist ────────────────────────────────────────────────────────────────

export interface WaitlistResponse {
  data: { id: string };
  message: string;
}

export function joinWaitlist(slug: string, data: {
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
}): Promise<WaitlistResponse> {
  return api(slug, '/waitlist', { method: 'POST', body: data });
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export function cancelReservation(slug: string, token: string): Promise<{ success: boolean }> {
  return api(slug, '/cancel', { method: 'POST', body: { token } });
}
