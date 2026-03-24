import { useEffect, useRef, useCallback } from 'react';
import { useTripStore } from '../store/tripStore';

export function useGeolocation() {
  const { isTracking, addPoint, activeTrip } = useTripStore();
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isTracking || !activeTrip) {
      stopTracking();
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;

        // Skip if less than 10m from last point
        if (lastPointRef.current) {
          const dist = haversineMeters(lastPointRef.current.lat, lastPointRef.current.lng, lat, lng);
          if (dist < 10) return;
        }

        lastPointRef.current = { lat, lng };
        addPoint({
          lat,
          lng,
          timestamp: pos.timestamp,
          speed_kmh: speed != null ? speed * 3.6 : undefined,
          accuracy: accuracy,
        });
      },
      (err) => console.warn('Geolocation error:', err.message),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return stopTracking;
  }, [isTracking, activeTrip, addPoint, stopTracking]);

  return { supported: typeof navigator !== 'undefined' && 'geolocation' in navigator };
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { haversineMeters };
