import { AppSettings, Trip, TrackPoint, TripCategory, TripStats, Vehicle, MaintenanceEntryRaw, YearStats } from '../types';

const BASE = '/api';

// ── Auth token helpers ────────────────────────────────────────────────────────

const TOKEN_KEY = 'myauto_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Called when any API request returns 401
let _onUnauthorized: (() => void) | null = null;
export function onUnauthorized(cb: () => void) { _onUnauthorized = cb; }

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers, ...options });
  if (res.status === 401) {
    clearToken();
    _onUnauthorized?.();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  getAuthStatus: () => fetch(`${BASE}/auth/status`).then(r => r.json()) as Promise<{ pinSet: boolean }>,
  authLogin: (pin: string) => fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
  }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() as Promise<{ token: string }>; }),
  authSetup: (pin: string, currentPin?: string) => fetch(`${BASE}/auth/setup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin, currentPin }),
  }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() as Promise<{ token: string }>; }),

  // Trips
  getTrips: (params?: { category?: TripCategory; from?: number; to?: number; vehicle_id?: number; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.category)   q.set('category', params.category);
    if (params?.from)       q.set('from', String(params.from));
    if (params?.to)         q.set('to', String(params.to));
    if (params?.vehicle_id) q.set('vehicle_id', String(params.vehicle_id));
    if (params?.limit)      q.set('limit', String(params.limit));
    if (params?.offset)     q.set('offset', String(params.offset));
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
    vehicleId?: number;
  }) => req<Trip>('/trips', { method: 'POST', body: JSON.stringify(data) }),

  getMaintenanceByVehicle: (vehicleId: number) =>
    req<{ entries: MaintenanceEntryRaw[] }>(`/maintenance?vehicle_id=${vehicleId}`),

  updateTrip: (id: number, data: Partial<{
    endTime: number; endLat: number; endLng: number; endAddress: string; startAddress: string;
    distanceKm: number; durationSeconds: number; trafficDelaySeconds: number;
    category: TripCategory; notes: string; routePolyline: string; vehicleId: number | null;
  }>) => req<Trip>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTrip: (id: number) => req<void>(`/trips/${id}`, { method: 'DELETE' }),

  exportCsv: () => window.open(`${BASE}/trips/export/csv`, '_blank'),

  exportLogbookPdf: (year: number, category: 'business' | 'private' = 'business') =>
    window.open(`${BASE}/logbook/pdf?year=${year}&category=${category}`, '_blank'),

  getYearStats: (year: number) => req<YearStats>(`/stats/year?year=${year}`),

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

  // Fuel
  getFuelEntries: (params?: { year?: number; month?: number; vehicle_id?: number }) => {
    const q = new URLSearchParams();
    if (params?.year)       q.set('year',       String(params.year));
    if (params?.month)      q.set('month',      String(params.month));
    if (params?.vehicle_id) q.set('vehicle_id', String(params.vehicle_id));
    return req<{ entries: import('../types').FuelEntry[] }>(`/fuel?${q}`);
  },
  getFuelStats: (year?: number) =>
    req<import('../types').FuelStats>(`/fuel/stats${year ? `?year=${year}` : ''}`),
  createFuelEntry: (data: Omit<import('../types').FuelEntry, 'id' | 'created_at' | 'vehicle_name'>) =>
    req<import('../types').FuelEntry>('/fuel', { method: 'POST', body: JSON.stringify(data) }),
  updateFuelEntry: (id: number, data: Omit<import('../types').FuelEntry, 'id' | 'created_at' | 'vehicle_name'>) =>
    req<import('../types').FuelEntry>(`/fuel/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFuelEntry: (id: number) => req<void>(`/fuel/${id}`, { method: 'DELETE' }),

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
