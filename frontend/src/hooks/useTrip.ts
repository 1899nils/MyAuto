import { useEffect, useRef } from 'react';
import { useTripStore } from '../store/tripStore';
import { haversineMeters } from './useGeolocation';
import { TrackPoint } from '../types';

// Flush track points every 30s during active trip
export function useTripSync() {
  const { isTracking, flushPoints } = useTripStore();

  useEffect(() => {
    if (!isTracking) return;
    const id = setInterval(() => flushPoints(), 30_000);
    return () => clearInterval(id);
  }, [isTracking, flushPoints]);
}

// Calculate live stats from track points
export function useLiveStats() {
  const { trackPoints, activeTrip } = useTripStore();

  const distanceKm = calcDistance(trackPoints);
  const durationSeconds = activeTrip
    ? Math.round((Date.now() - activeTrip.start_time) / 1000)
    : 0;

  const recentPoints = trackPoints.slice(-5);
  const avgSpeed = recentPoints.length > 1
    ? recentPoints.reduce((s, p) => s + (p.speed_kmh ?? 0), 0) / recentPoints.length
    : 0;

  return { distanceKm, durationSeconds, avgSpeed };
}

export function useElapsedTimer(active: boolean): number {
  const startRef = useRef(Date.now());
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      elapsedRef.current = Math.round((Date.now() - startRef.current) / 1000);
      // Force re-render via Zustand is unnecessary; components that need
      // live elapsed time should derive it from activeTrip.start_time directly
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return elapsedRef.current;
}

function calcDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total / 1000;
}
