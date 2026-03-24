import { AppSettings, Trip, TrackPoint, TripCategory, TripStats } from '../types';

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

  // Track Points
  addTrackPoints: (tripId: number, points: Omit<TrackPoint, 'id' | 'trip_id'>[]) =>
    req<{ inserted: number }>(`/trips/${tripId}/points`, { method: 'POST', body: JSON.stringify(points) }),

  getTrackPoints: (tripId: number) => req<TrackPoint[]>(`/trips/${tripId}/points`),

  // Settings
  getSettings: () => req<AppSettings>('/settings'),

  updateSettings: (data: Partial<AppSettings>) =>
    req<{ ok: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
