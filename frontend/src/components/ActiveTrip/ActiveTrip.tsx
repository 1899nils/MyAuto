import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useTripSync, useLiveStats } from '../../hooks/useTrip';
import { formatDuration, formatKm, formatSpeed } from '../../utils/format';
import { loadGoogleMaps, createTrafficLayer, createPolyline, createMarker } from '../../utils/maps';

function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;
    navigator.wakeLock.request('screen').then(lock => {
      if (cancelled) { lock.release(); return; }
      lockRef.current = lock;
    }).catch(() => {});
    return () => {
      cancelled = true;
      lockRef.current?.release();
      lockRef.current = null;
    };
  }, [active]);
}

export function ActiveTrip() {
  const { activeTrip, isTracking, trackPoints, endTrip, setView } = useTripStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState('0s');
  const { distanceKm, avgSpeed } = useLiveStats();
  useGeolocation();
  useTripSync();
  useWakeLock(isTracking);

  const settings = useTripStore(s => s.settings);

  useEffect(() => {
    if (!activeTrip) return;
    const id = setInterval(() => {
      const secs = Math.round((Date.now() - activeTrip.start_time) / 1000);
      setElapsed(formatDuration(secs));
    }, 1000);
    return () => clearInterval(id);
  }, [activeTrip]);

  useEffect(() => {
    if (!mapRef.current || !settings?.googleMapsApiKey) return;

    loadGoogleMaps(settings.googleMapsApiKey).then(() => {
      if (!mapRef.current) return;
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        zoom: 15,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyle,
      });

      createTrafficLayer().setMap(mapInstanceRef.current);

      polylineRef.current = createPolyline([]);
      polylineRef.current.setMap(mapInstanceRef.current);
    });
  }, [settings?.googleMapsApiKey]);

  // Update map with new track points
  useEffect(() => {
    if (!mapInstanceRef.current || trackPoints.length === 0) return;

    const latLngs = trackPoints.map(p => ({ lat: p.lat, lng: p.lng }));
    polylineRef.current?.setPath(latLngs);

    const last = latLngs[latLngs.length - 1];
    mapInstanceRef.current.panTo(last);

    // Update or create car marker
    if (!markerRef.current) {
      markerRef.current = createMarker(last, '🚗', mapInstanceRef.current);
    } else {
      markerRef.current.setPosition(last);
    }
  }, [trackPoints]);

  async function handleEnd() {
    if (!activeTrip) return;
    setEnding(true);
    try {
      const secs = Math.round((Date.now() - activeTrip.start_time) / 1000);
      const last = trackPoints[trackPoints.length - 1];
      await endTrip(activeTrip.id, {
        endTime: Date.now(),
        endLat: last?.lat,
        endLng: last?.lng,
        durationSeconds: secs,
        distanceKm,
      });
      setView('dashboard');
    } finally {
      setEnding(false);
    }
  }

  if (!isTracking || !activeTrip) {
    return (
      <div>
        <div className="page-header">
          <h1>Aktive Fahrt</h1>
        </div>
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">🚗</div>
            <h3>Keine aktive Fahrt</h3>
            <p>Starte eine Fahrt vom Dashboard.</p>
          </div>
          <div style={{ padding: '0 var(--sp-lg) var(--sp-lg)' }}>
            <button className="btn btn-primary btn-full" onClick={() => setView('dashboard')}>
              Zum Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: 'calc(100dvh - var(--tab-bar-height, 80px))' }}>
      {/* Map */}
      {settings?.googleMapsApiKey ? (
        <div
          ref={mapRef}
          style={{ position: 'absolute', inset: 0, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
        />
      ) : (
        <div className="glass flex-center" style={{ position: 'absolute', inset: 0, borderRadius: 'var(--r-lg)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <p className="text-secondary mt-sm">Google Maps API Key in Einstellungen hinterlegen</p>
          </div>
        </div>
      )}

      {/* Stats overlay */}
      <div style={{
        position: 'absolute', top: 16, left: 16, right: 16,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, zIndex: 10,
      }}>
        <div className="glass-strong" style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{elapsed}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Dauer</div>
        </div>
        <div className="glass-strong" style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatKm(distanceKm)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Strecke</div>
        </div>
        <div className="glass-strong" style={{ padding: '12px', textAlign: 'center', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{formatSpeed(avgSpeed)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ø Tempo</div>
        </div>
      </div>

      {/* Warning: keep tab open */}
      <div style={{
        position: 'absolute', bottom: 112, left: 16, right: 16, zIndex: 10,
        background: 'rgba(255,160,0,0.15)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,160,0,0.35)',
        borderRadius: 'var(--r-md)', padding: '8px 12px',
        fontSize: 12, color: 'rgba(255,220,100,0.9)', textAlign: 'center',
      }}>
        App muss im Vordergrund bleiben · Tab nicht schließen
      </div>

      {/* End button */}
      <div style={{ position: 'absolute', bottom: 32, left: 16, right: 16, zIndex: 10 }}>
        <button
          className="btn btn-danger btn-lg btn-full"
          onClick={handleEnd}
          disabled={ending}
          style={{ boxShadow: '0 8px 30px rgba(255,59,48,0.5)' }}
        >
          {ending ? '⏳ Speichern…' : '⏹ Fahrt beenden'}
        </button>
      </div>
    </div>
  );
}

const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c67a5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
