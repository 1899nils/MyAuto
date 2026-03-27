import { create } from 'zustand';
import { api } from '../api/client';
import type { FuelEntry, FuelStats } from '../types';

interface FuelState {
  entries: FuelEntry[];
  stats: FuelStats | null;

  loadEntries: (year: number, month: number, vehicle_id?: number) => Promise<void>;
  loadStats: (year: number) => Promise<void>;
  addEntry: (data: Omit<FuelEntry, 'id' | 'created_at' | 'vehicle_name'>) => Promise<void>;
  updateEntry: (id: number, data: Omit<FuelEntry, 'id' | 'created_at' | 'vehicle_name'>) => Promise<void>;
  deleteEntry: (id: number) => Promise<void>;
}

export const useFuelStore = create<FuelState>((set) => ({
  entries: [],
  stats: null,

  loadEntries: async (year, month, vehicle_id) => {
    const data = await api.getFuelEntries({ year, month, vehicle_id });
    set({ entries: data.entries });
  },

  loadStats: async (year) => {
    const data = await api.getFuelStats(year);
    set({ stats: data });
  },

  addEntry: async (data) => {
    await api.createFuelEntry(data);
  },

  updateEntry: async (id, data) => {
    await api.updateFuelEntry(id, data);
  },

  deleteEntry: async (id) => {
    await api.deleteFuelEntry(id);
  },
}));
