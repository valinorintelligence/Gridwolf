import { create } from 'zustand';
import type { ObjectTypeDefinition } from '../types';

interface OntologyState {
  objectTypes: ObjectTypeDefinition[];
  selectedTypeId: string | null;
  selectedObjectId: string | null;
  searchQuery: string;
  filters: Record<string, unknown>;
  setObjectTypes: (types: ObjectTypeDefinition[]) => void;
  selectType: (typeId: string | null) => void;
  selectObject: (objectId: string | null) => void;
  setSearch: (query: string) => void;
  setFilters: (filters: Record<string, unknown>) => void;
}

export const useOntologyStore = create<OntologyState>((set) => ({
  objectTypes: [],
  selectedTypeId: null,
  selectedObjectId: null,
  searchQuery: '',
  filters: {},

  setObjectTypes: (objectTypes) => set({ objectTypes }),

  selectType: (selectedTypeId) =>
    set({ selectedTypeId, selectedObjectId: null }),

  selectObject: (selectedObjectId) => set({ selectedObjectId }),

  setSearch: (searchQuery) => set({ searchQuery }),

  setFilters: (filters) => set({ filters }),
}));
