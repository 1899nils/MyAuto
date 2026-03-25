import { AppSettings, Trip, TrackPoint, TripCategory, TripStats, Vehicle, MaintenanceEntryRaw } from '../types';

const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Trips
  getTrips: (params?: { category?: TripCategory; from?: number; to?: number; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.from) q.set('from', String(params.from));
    if (params?.to) q.set('to', String(params.to));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return req<{ trips: Trip[]; total: number }>(`/trips?${q}`);
  },

  getTrip: (id: number) => req<Trip>(`/trips/${id}`),

  getStats: () => req<TripStats>(`/trips/stats`),

  startTrip: (data: { startLat?: number; startLng?: number; bluetoothDevice?: string }) =>
    req<Trip>('/trips', { method: 'POST', body: JSON.stringify(data) }),

  addManualTrip: (data: {
    startTime: number; endTime: number;
    startAddress?: string; endAddress?: string;
    startLat?: number; startLng?: number;
    endLat?: number; endLng?: number;
    distanceKm?: number; durationSeconds?: number;
    category: TripCategory; notes?: string;
  }) => req<Trip>('/trips', { method: 'POST', body: JSON.stringify(data) }),

  updateTrip: (id: number, data: Partial<{
    endTime: number; endLat: number; endLng: number; endAddress: string; startAddress: string;
    distanceKm: number; durationSeconds: number; trafficDelaySeconds: number;
    category: TripCategory; notes: string; routePolyline: string;
  }>) => req<Trip>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTrip: (id: number) => req<void>(`/trips/${id}`, { method: 'DELETE' }),

  exportCsv: () => window.open(`${BASE}/trips/export/csv`, '_blank'),

  exportLogbookPdf: (year: number, category: 'business' | 'private' = 'business') =>
    window.open(`${BASE}/logbook/pdf?year=${year}&category=${category}`, '_blank'),

  // Track Points
  addTrackPoints: (tripId: number, points: Omit<TrackPoint, 'id' | 'trip_id'>[]) =>
    req<{ inserted: number }>(`/trips/${tripId}/points`, { method: 'POST', body: JSON.stringify(points) }),

  getTrackPoints: (tripId: number) => req<TrackPoint[]>(`/trips/${tripId}/points`),

  // Settings
  getSettings: () => req<AppSettings>('/settings'),

  updateSettings: (data: Partial<AppSettings>) =>
    req<{ ok: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Vehicles
  getVehicles: () => req<{ vehicles: Vehicle[] }>('/vehicles'),

  getVehicle: (id: number) => req<Vehicle>(`/vehicles/${id}`),

  createVehicle: (data: FormData) =>
    fetch('/api/vehicles', { method: 'POST', body: data }).then(r => {
      if (!r.ok) throw new Error(`API /vehicles: ${r.status}`);
      return r.json() as Promise<Vehicle>;
    }),

  updateVehicle: (id: number, data: FormData) =>
    fetch(`/api/vehicles/${id}`, { method: 'PUT', body: data }).then(r => {
      if (!r.ok) throw new Error(`API /vehicles/${id}: ${r.status}`);
      return r.json() as Promise<Vehicle>;
    }),

  deleteVehicle: (id: number) => req<void>(`/vehicles/${id}`, { method: 'DELETE' }),

  // Maintenance
  getMaintenanceEntries: () =>
    req<{ entries: MaintenanceEntryRaw[] }>('/maintenance'),

  getMaintenanceDue: () =>
    req<{ entries: MaintenanceEntryRaw[]; now: number }>('/maintenance/due'),

  createMaintenanceEntry: (data: {
    title: string; type: string;
    date?: number | null; odometer_km?: number | null; cost?: number | null;
    workshop?: string | null; notes?: string | null;
    next_date?: number | null; next_odometer_km?: number | null;
  }) => req<MaintenanceEntryRaw>('/maintenance', { method: 'POST', body: JSON.stringify(data) }),

  updateMaintenanceEntry: (id: number, data: {
    title: string; type: string;
    date?: number | null; odometer_km?: number | null; cost?: number | null;
    workshop?: string | null; notes?: string | null;
    next_date?: number | null; next_odometer_km?: number | null;
  }) => req<MaintenanceEntryRaw>(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteMaintenanceEntry: (id: number) => req<void>(`/maintenance/${id}`, { method: 'DELETE' }),

  uploadVehiclePhoto: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('photo', file);
    return fetch(`/api/vehicles/${id}/photo`, { method: 'POST', body: fd }).then(r => {
      if (!r.ok) throw new Error(`API /vehicles/${id}/photo: ${r.status}`);
      return r.json() as Promise<Vehicle>;
    });
  },
};
