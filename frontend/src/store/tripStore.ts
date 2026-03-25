import { create } from 'zustand';
import { Trip, AppSettings, TripStats, TrackPoint } from '../types';
import { api } from '../api/client';

interface TripStore {
  // Active trip
  activeTrip: Trip | null;
  trackPoints: TrackPoint[];
  pendingPoints: TrackPoint[];

  // Data
  trips: Trip[];
  totalTrips: number;
  stats: TripStats | null;
  settings: AppSettings | null;

  // UI state
  isTracking: boolean;
  classifyModalTrip: Trip | null;
  view: 'dashboard' | 'active' | 'history' | 'detail' | 'settings' | 'fuel' | 'garage';
  selectedTripId: number | null;

  // Actions
  setView: (view: TripStore['view'], tripId?: number) => void;
  loadSettings: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadTrips: (params?: Parameters<typeof api.getTrips>[0]) => Promise<void>;
  startTrip: (data?: { startLat?: number; startLng?: number; bluetoothDevice?: string }) => Promise<void>;
  addManualTrip: (data: Parameters<typeof api.addManualTrip>[0]) => Promise<Trip>;
  endTrip: (tripId: number, data: Parameters<typeof api.updateTrip>[1]) => Promise<void>;
  addPoint: (point: Omit<TrackPoint, 'id' | 'trip_id'>) => void;
  flushPoints: () => Promise<void>;
  updateTrip: (id: number, data: Parameters<typeof api.updateTrip>[1]) => Promise<void>;
  deleteTrip: (id: number) => Promise<void>;
  saveSettings: (data: Partial<AppSettings>) => Promise<void>;
  setClassifyModal: (trip: Trip | null) => void;
}

export const useTripStore = create<TripStore>((set, get) => ({
  activeTrip: null,
  trackPoints: [],
  pendingPoints: [],
  trips: [],
  totalTrips: 0,
  stats: null,
  settings: null,
  isTracking: false,
  classifyModalTrip: null,
  view: 'dashboard',
  selectedTripId: null,

  setView: (view, tripId) => set({ view, selectedTripId: tripId ?? null }),

  loadSettings: async () => {
    const settings = await api.getSettings();
    set({ settings });
  },

  loadStats: async () => {
    const stats = await api.getStats();
    const hasActive = !!stats.activeTrip;
    set({
      stats,
      activeTrip: stats.activeTrip ?? null,
      // Restore tracking state after page reload
      isTracking: hasActive ? true : get().isTracking,
    });
  },

  loadTrips: async (params) => {
    const { trips, total } = await api.getTrips(params);
    set({ trips, totalTrips: total });
  },

  startTrip: async (data = {}) => {
    const trip = await api.startTrip(data);
    set({ activeTrip: trip, isTracking: true, trackPoints: [], pendingPoints: [] });
  },

  addManualTrip: async (data) => {
    const trip = await api.addManualTrip(data);
    set((s) => ({ trips: [trip, ...s.trips], totalTrips: s.totalTrips + 1 }));
    return trip;
  },

  endTrip: async (tripId, data) => {
    const updated = await api.updateTrip(tripId, data);

    // Flush any remaining points
    const { pendingPoints } = get();
    if (pendingPoints.length > 0) {
      await api.addTrackPoints(tripId, pendingPoints);
    }

    set({ activeTrip: null, isTracking: false, trackPoints: [], pendingPoints: [] });

    // Show classify modal if category is unclassified
    if (updated.category === 'unclassified') {
      const settings = get().settings;
      if (!settings || settings.defaultCategory === 'ask') {
        set({ classifyModalTrip: updated });
      }
    }
  },

  addPoint: (point) => {
    set((s) => ({
      trackPoints: [...s.trackPoints, { ...point, id: 0, trip_id: s.activeTrip?.id ?? 0 }],
      pendingPoints: [...s.pendingPoints, { ...point, id: 0, trip_id: s.activeTrip?.id ?? 0 }],
    }));

    // Flush every 10 points
    if (get().pendingPoints.length >= 10) {
      get().flushPoints();
    }
  },

  flushPoints: async () => {
    const { activeTrip, pendingPoints } = get();
    if (!activeTrip || pendingPoints.length === 0) return;
    const toFlush = [...pendingPoints];
    set({ pendingPoints: [] });
    await api.addTrackPoints(activeTrip.id, toFlush);
  },

  updateTrip: async (id, data) => {
    const updated = await api.updateTrip(id, data);
    set((s) => ({
      trips: s.trips.map((t) => (t.id === id ? updated : t)),
      classifyModalTrip: s.classifyModalTrip?.id === id ? null : s.classifyModalTrip,
    }));
  },

  deleteTrip: async (id) => {
    await api.deleteTrip(id);
    set((s) => ({ trips: s.trips.filter((t) => t.id !== id) }));
  },

  saveSettings: async (data) => {
    await api.updateSettings(data);
    await get().loadSettings();
  },

  setClassifyModal: (trip) => set({ classifyModalTrip: trip }),
}));
