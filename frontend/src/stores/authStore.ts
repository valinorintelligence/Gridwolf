import { create } from 'zustand';
import type { User, TokenResponse } from '../types';
import { api } from '../services/api';

const TOKEN_KEY = 'gridwolf_token';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
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
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const { data } = await api.post<TokenResponse>('/auth/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      localStorage.setItem(TOKEN_KEY, data.access_token);
      set({ token: data.access_token });

      const { data: user } = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
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
      const { data: user } = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
