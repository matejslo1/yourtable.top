const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
}

async function api<T>(tenantSlug: string, path: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE}/api/v1/public/${tenantSlug}${path}`;
  
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    const details = json.details
      ? Object.entries(json.details).map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`).join('; ')
      : null;
    throw new Error(details || json.message || `API error: ${res.status}`);
  }

  return json.data;
}

// ---- Availability ----

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
  slots: TimeSlot[];
}

export function fetchAvailability(slug: string, date: string, partySize?: number): Promise<DayAvailability> {
  const params = new URLSearchParams({ date });
  if (partySize) params.set('partySize', String(partySize));
  return api(slug, `/availability?${params}`);
}

// ---- Hold ----

export interface HoldResponse {
  reservationId: string;
  holdExpiresAt: string;
  assignedTables: { id: string; label: string }[];
  sessionToken: string;
}

export function createHold(slug: string, data: {
  date: string;
  time: string;
  partySize: number;
  durationMinutes?: number;
}): Promise<HoldResponse> {
  return api(slug, '/hold', { method: 'POST', body: data });
}

export function completeHold(slug: string, holdId: string, data: {
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  sessionToken: string;
}): Promise<unknown> {
  return api(slug, `/hold/${holdId}/complete`, { method: 'POST', body: data });
}

export function abandonHold(slug: string, holdId: string, sessionToken: string): void {
  // Use sendBeacon for reliability on page close
  const url = `${API_BASE}/api/v1/public/${slug}/hold/${holdId}`;
  const body = JSON.stringify({ sessionToken });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
  } else {
    // Fallback
    fetch(url, { method: 'DELETE', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  }
}
