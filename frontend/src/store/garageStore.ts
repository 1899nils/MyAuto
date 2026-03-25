import { create } from 'zustand';
import { api } from '../api/client';
import type { Vehicle } from '../types';

interface GarageState {
  vehicles: Vehicle[];
  loading: boolean;

  loadVehicles: () => Promise<void>;
  createVehicle: (data: FormData) => Promise<Vehicle>;
  updateVehicle: (id: number, data: FormData) => Promise<Vehicle>;
  deleteVehicle: (id: number) => Promise<void>;
}

export const useGarageStore = create<GarageState>((set) => ({
  vehicles: [],
  loading: false,

  loadVehicles: async () => {
    set({ loading: true });
    try {
      const data = await api.getVehicles();
      set({ vehicles: data.vehicles });
    } finally {
      set({ loading: false });
    }
  },

  createVehicle: async (data) => {
    const vehicle = await api.createVehicle(data);
    set((s) => ({ vehicles: [vehicle, ...s.vehicles] }));
    return vehicle;
  },

  updateVehicle: async (id, data) => {
    const vehicle = await api.updateVehicle(id, data);
    set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? vehicle : v)) }));
    return vehicle;
  },

  deleteVehicle: async (id) => {
    await api.deleteVehicle(id);
    set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) }));
  },
}));
