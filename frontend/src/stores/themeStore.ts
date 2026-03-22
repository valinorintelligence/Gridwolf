import { create } from 'zustand';

const THEME_KEY = 'gridwolf_theme';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  initTheme: () => void;
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',

  toggleTheme: () => {
    const newTheme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
    set({ theme: newTheme });
  },

  initTheme: () => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    const theme: Theme = stored === 'light' ? 'light' : 'dark';
    applyTheme(theme);
    set({ theme });
  },
}));
