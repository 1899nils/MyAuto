import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { api } from '../../api/client';
import { loadGoogleMaps } from '../../utils/maps';
import { Trip } from '../../types';

const CAT_COLORS: Record<string, string> = {
  business:     '#007AFF',
  private:      '#34C759',
  unclassified: '#FF9F0A',
};

export function Karte() {
  const { settings } = useTripStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'no-key' | 'error' | 'ready'>('loading');
  const [tripCount, setTripCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'business' | 'private'>('all');
  const polylinesRef = useRef<{ line: google.maps.Polyline; cat: string }[]>([]);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const apiKey = settings?.googleMapsApiKey;
    if (!apiKey) { setStatus('no-key'); return; }

    loadGoogleMaps(apiKey).then(async () => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        zoom: 10,
        center: { lat: 48.137154, lng: 11.576124 }, // Munich default
        mapTypeId: 'roadmap',
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
      mapInstanceRef.current = map;

      // Load all completed trips
      const data = await api.getTrips({ limit: 500 });
      const tripsWithRoute = data.trips.filter(
        (t: Trip) => t.start_lat && t.start_lng && t.end_lat && t.end_lng
      );
      setTripCount(tripsWithRoute.length);

      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;

      for (const trip of tripsWithRoute) {
        const path: google.maps.LatLngLiteral[] = [];

        // If route_polyline available, decode it
        if (trip.route_polyline) {
          const decoded = google.maps.geometry.encoding.decodePath(trip.route_polyline);
          decoded.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }));
        } else {
          // Fall back to start→end straight line
          path.push({ lat: trip.start_lat!, lng: trip.start_lng! });
          path.push({ lat: trip.end_lat!, lng: trip.end_lng! });
        }

        path.forEach(p => { bounds.extend(p); hasPoints = true; });

        const color = CAT_COLORS[trip.category] ?? '#8E8E93';
        const line = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map,
        });
        polylinesRef.current.push({ line, cat: trip.category });
      }

      if (hasPoints) map.fitBounds(bounds);
      setStatus('ready');
    }).catch(() => setStatus('error'));
  }, [settings?.googleMapsApiKey]);

  // Apply filter
  useEffect(() => {
    polylinesRef.current.forEach(({ line, cat }) => {
      const visible = filter === 'all' || cat === filter;
      line.setVisible(visible);
    });
  }, [filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🗺️ Karte</h1>
          <p className="page-subtitle">{status === 'ready' ? `${tripCount} Fahrten` : 'Alle Routen'}</p>
        </div>
        {status === 'ready' && (
          <div className="page-actions">
            <select
              className="form-input"
              value={filter}
              onChange={e => setFilter(e.target.value as typeof filter)}
              style={{ width: 'auto' }}
            >
              <option value="all">Alle</option>
              <option value="business">💼 Beruflich</option>
              <option value="private">🏠 Privat</option>
            </select>
          </div>
        )}
      </div>

      {status === 'no-key' && (
        <div className="glass" style={{ padding: 'var(--sp-xl)', textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 40 }}>🗺️</div>
          <h3>Google Maps API Key fehlt</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Trage deinen Google Maps API Key in den Einstellungen ein, um die Karte zu nutzen.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="glass" style={{ padding: 'var(--sp-xl)', textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h3>Karte konnte nicht geladen werden</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Google Maps API Key überprüfen.</p>
        </div>
      )}

      {status === 'loading' && (
        <div className="glass" style={{ padding: 'var(--sp-xl)', textAlign: 'center', flex: 1 }}>
          <p style={{ color: 'var(--text-secondary)' }}>Lade Karte…</p>
        </div>
      )}

      {/* Legend */}
      {status === 'ready' && (
        <div style={{ display: 'flex', gap: 'var(--sp-md)', padding: '8px var(--sp-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span><span style={{ color: '#007AFF' }}>━</span> Beruflich</span>
          <span><span style={{ color: '#34C759' }}>━</span> Privat</span>
          <span><span style={{ color: '#FF9F0A' }}>━</span> Offen</span>
        </div>
      )}

      <div
        ref={mapRef}
        style={{
          flex: 1,
          minHeight: 400,
          borderRadius: '0 0 var(--radius) var(--radius)',
          display: status === 'no-key' || status === 'error' ? 'none' : 'block',
        }}
      />
    </div>
  );
}
