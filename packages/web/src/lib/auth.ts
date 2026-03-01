import { create } from 'zustand';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export { supabase };

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenant: { id: string; name: string; slug: string };
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const { data } = await res.json();
          set({ user: data, accessToken: session.access_token });
        }
      }
    } catch (err) {
      console.error('[Auth] Init failed:', err);
    } finally {
      set({ initialized: true });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, accessToken: null });
      } else if (session) {
        set({ accessToken: session.access_token });
      }
    });
  },

  login: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');

      const { accessToken, user, tenant } = json.data;

      // Set Supabase session
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: json.data.refreshToken,
      });

      set({
        user: { ...user, tenantId: tenant.id, tenant },
        accessToken,
      });
    } finally {
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
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    },
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `API error: ${res.status}`);
  return json;
}
