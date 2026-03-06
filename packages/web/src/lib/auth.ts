import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { supabase };

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  tenantId: string;
  tenant: { id: string; name?: string; slug?: string } & Record<string, any>;
  [k: string]: any;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchMe(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const text = await res.text();
  const json = text ? safeJson(text) : {};

  if (!res.ok) {
    throw new Error(json?.message || `Auth/me failed (${res.status})`);
  }

  const me = json?.data;
  if (!me?.tenantId || !me?.tenant?.id) {
    throw new Error('Auth OK, but tenant is missing. Run seed/provision user+tenant.');
  }

  return me as AuthUser;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        try {
          const me = await fetchMe(session.access_token);
          set({ user: me, accessToken: session.access_token });
        } catch (err) {
          console.error('[Auth] /me failed:', err);
          set({ user: null, accessToken: session.access_token });
        }
      }
    } catch (err) {
      console.error('[Auth] Init failed:', err);
    } finally {
      set({ initialized: true });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, accessToken: null });
      } else if (session?.access_token) {
        set({ accessToken: session.access_token });
      }
    });
  },

  login: async (email: string, password: string) => {
    set({ loading: true });

    // timeout, da se UI nikoli ne "zatakne"
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      const text = await res.text();
      const json = text ? safeJson(text) : {};

      if (!res.ok) {
        throw new Error(json?.message || `Login failed (${res.status})`);
      }

      const accessToken: string | undefined = json?.data?.accessToken;
      const refreshToken: string | undefined = json?.data?.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error('Login response missing tokens');
      }

      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // vedno naloži app-user + tenant iz /me
      const me = await fetchMe(accessToken);
      set({ user: me, accessToken });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error('API timeout: backend ne odgovarja (10s)');
      }
      throw e;
    } finally {
      window.clearTimeout(t);
      set({ loading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, accessToken: null });
  },
}));

// API helper with auth
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return {} as T;

  const text = await res.text();
  const json = text ? safeJson(text) : {};

  if (!res.ok) {
    throw new Error(json?.message || 'An unexpected error occurred');
  }

  return json as T;
}
