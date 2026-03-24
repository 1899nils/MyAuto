import { useEffect, useRef, useCallback } from 'react';
import { useTripStore } from '../store/tripStore';

const POLL_INTERVAL = 30_000; // 30 seconds

export function useBluetooth() {
  const { settings, activeTrip, isTracking, startTrip } = useTripStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  interface BtDevice { id: string; name?: string; gatt?: { connected: boolean }; }
  interface BtApi {
    requestDevice(opts: { acceptAllDevices: boolean; optionalServices?: string[] }): Promise<BtDevice>;
    getDevices(): Promise<BtDevice[]>;
  }

  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const bt = () => (navigator as Navigator & { bluetooth: BtApi }).bluetooth;

  const pairDevice = useCallback(async () => {
    if (!supported) throw new Error('Web Bluetooth not supported in this browser');

    const device = await bt().requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service'],
    });

    await useTripStore.getState().saveSettings({
      bluetoothDeviceName: device.name || 'Unbekanntes Gerät',
      bluetoothDeviceId: device.id,
    });

    return device;
  }, [supported]);

  const checkConnection = useCallback(async () => {
    if (!supported || !settings?.bluetoothDeviceId) return;

    try {
      const btApi = bt();
      if (!('getDevices' in btApi)) return; // Firefox/Safari fallback

      const devices = await btApi.getDevices();
      const carDevice = devices.find((d) => d.id === settings.bluetoothDeviceId);

      if (carDevice?.gatt?.connected && !isTracking) {
        // Car BT is connected and no active trip → auto start
        const { coords } = await getCurrentPosition();
        await startTrip({
          startLat: coords.latitude,
          startLng: coords.longitude,
          bluetoothDevice: carDevice.name || settings.bluetoothDeviceName,
        });
      } else if (!carDevice?.gatt?.connected && isTracking && activeTrip) {
        // Car BT disconnected → auto end trip
        const store = useTripStore.getState();
        const { trackPoints } = store;
        const lastPoint = trackPoints[trackPoints.length - 1];
        await store.endTrip(activeTrip.id, {
          endTime: Date.now(),
          endLat: lastPoint?.lat,
          endLng: lastPoint?.lng,
          durationSeconds: Math.round((Date.now() - activeTrip.start_time) / 1000),
          distanceKm: calcTotalDistanceKm(trackPoints.map((p) => ({ lat: p.lat, lng: p.lng }))),
        });
      }
    } catch {
      // Ignore - permissions may not be granted
    }
  }, [supported, settings, isTracking, activeTrip, startTrip]);

  useEffect(() => {
    if (!supported || !settings?.bluetoothDeviceId) return;

    checkConnection();
    intervalRef.current = setInterval(checkConnection, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [supported, settings?.bluetoothDeviceId, checkConnection]);

  return { supported, pairDevice };
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
  );
}

function calcTotalDistanceKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371;
    const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
    const dLng = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((points[i - 1].lat * Math.PI) / 180) *
        Math.cos((points[i].lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}
