import { create } from 'zustand';

export interface Widget {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
  isDefault: boolean;
}

interface DashboardState {
  widgets: Widget[];
  isEditing: boolean;
  savedDashboards: Dashboard[];
  addWidget: (widget: Widget) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  toggleEditing: () => void;
  saveDashboard: (name: string) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  widgets: [],
  isEditing: false,
  savedDashboards: [],

  addWidget: (widget) =>
    set((state) => ({
      widgets: [...state.widgets, widget],
    })),

  removeWidget: (id) =>
    set((state) => ({
      widgets: state.widgets.filter((w) => w.id !== id),
    })),

  updateWidget: (id, updates) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),

  toggleEditing: () =>
    set((state) => ({
      isEditing: !state.isEditing,
    })),

  saveDashboard: (name) => {
    const { widgets, savedDashboards } = get();
    const dashboard: Dashboard = {
      id: generateId(),
      name,
      widgets: [...widgets],
      isDefault: savedDashboards.length === 0,
    };
    set({ savedDashboards: [...savedDashboards, dashboard] });
  },
}));
