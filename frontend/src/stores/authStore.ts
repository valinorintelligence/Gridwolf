import { create } from 'zustand';
import type { User, TokenResponse } from '../types';
import { api } from '../services/api';

const TOKEN_KEY = 'gridwolf_token';

/** Map snake_case backend user response to camelCase frontend User type. */
function mapUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    username: data.username as string,
    email: data.email as string,
    fullName: (data.full_name ?? data.fullName ?? '') as string,
    role: data.role as User['role'],
    isActive: (data.is_active ?? data.isActive ?? true) as boolean,
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; full_name: string }) => Promise<void>;
  demoLogin: () => void;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<TokenResponse>('/auth/login', { username, password });

      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({ token: data.access_token });

      const { data: raw } = await api.get('/auth/me');
      set({ user: mapUser(raw as Record<string, unknown>), isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data: { username: string; email: string; password: string; full_name: string }) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/register', data);
      // Auto-login after successful registration
      await get().login(data.username, data.password);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  demoLogin: () => {
    const demoUser: User = {
      id: 'demo-user',
      username: 'demo',
      email: 'demo@gridwolf.io',
      fullName: 'Demo User',
      role: 'admin',
      isActive: true,
    };
    const demoToken = 'demo-token';
    localStorage.setItem(TOKEN_KEY, demoToken);
    set({
      user: demoUser,
      token: demoToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadUser: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ isLoading: false });
      return;
    }

    set({ token, isLoading: true });

    // If it's the demo token, restore demo session without API call
    if (token === 'demo-token') {
      const { demoLogin } = get();
      demoLogin();
      return;
    }

    try {
      const { data: raw } = await api.get('/auth/me');
      set({ user: mapUser(raw as Record<string, unknown>), isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
