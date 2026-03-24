import { create } from 'zustand';
import type { FuelEntry, FuelStats } from '../types';

interface FuelState {
  entries: FuelEntry[];
  stats: FuelStats | null;

  loadEntries: (year: number, month: number) => Promise<void>;
  loadStats: (year: number) => Promise<void>;
  addEntry: (data: Omit<FuelEntry, 'id' | 'created_at'>) => Promise<void>;
  updateEntry: (id: number, data: Omit<FuelEntry, 'id' | 'created_at'>) => Promise<void>;
  deleteEntry: (id: number) => Promise<void>;
}

export const useFuelStore = create<FuelState>((set) => ({
  entries: [],
  stats: null,

  loadEntries: async (year, month) => {
    const res = await fetch(`/api/fuel?year=${year}&month=${month}`);
    const data = await res.json();
    set({ entries: data.entries });
  },

  loadStats: async (year) => {
    const res = await fetch(`/api/fuel/stats?year=${year}`);
    const data = await res.json();
    set({ stats: data });
  },

  addEntry: async (data) => {
    await fetch('/api/fuel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  updateEntry: async (id, data) => {
    await fetch(`/api/fuel/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  deleteEntry: async (id) => {
    await fetch(`/api/fuel/${id}`, { method: 'DELETE' });
  },
}));
