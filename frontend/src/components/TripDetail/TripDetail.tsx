import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { api } from '../../api/client';
import { Trip, TripCategory } from '../../types';
import { formatDate, formatTime, formatKm, formatDuration, categoryLabel, categoryEmoji } from '../../utils/format';
import { loadGoogleMaps, createPolyline, createTrafficLayer } from '../../utils/maps';

export function TripDetail() {
  const { selectedTripId, trips, settings, updateTrip, setView, deleteTrip } = useTripStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<TripCategory>('unclassified');
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!selectedTripId) return;
    const found = trips.find(t => t.id === selectedTripId);
    if (found) {
      setTrip(found);
      setNotes(found.notes || '');
      setCategory(found.category);
    } else {
      api.getTrip(selectedTripId).then(t => {
        setTrip(t);
        setNotes(t.notes || '');
        setCategory(t.category);
      });
    }
  }, [selectedTripId]);

  useEffect(() => {
    if (!trip || !mapRef.current || !settings?.googleMapsApiKey) return;

    loadGoogleMaps(settings.googleMapsApiKey).then(() => {
      if (!mapRef.current) return;

      const center = trip.start_lat && trip.start_lng
        ? { lat: trip.start_lat, lng: trip.start_lng }
        : { lat: 51.1657, lng: 10.4515 }; // Germany center

      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkMapStyle,
      });

      createTrafficLayer().setMap(mapInstanceRef.current);

      // Draw route polyline
      if (trip.route_polyline) {
        const path = google.maps.geometry.encoding.decodePath(trip.route_polyline);
        const polyline = createPolyline(path.map(p => ({ lat: p.lat(), lng: p.lng() })));
        polyline.setMap(mapInstanceRef.current);

        // Fit bounds to route
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        mapInstanceRef.current.fitBounds(bounds, 40);
      } else {
        // Draw raw track points if no polyline
        api.getTrackPoints(trip.id).then(points => {
          if (points.length === 0 || !mapInstanceRef.current) return;
          const path = points.map(p => ({ lat: p.lat, lng: p.lng }));
          const polyline = createPolyline(path);
          polyline.setMap(mapInstanceRef.current!);

          const bounds = new google.maps.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          mapInstanceRef.current!.fitBounds(bounds, 40);
        });
      }

      // Start / end markers
      if (trip.start_lat && trip.start_lng) {
        new google.maps.Marker({
          position: { lat: trip.start_lat, lng: trip.start_lng },
          map: mapInstanceRef.current,
          title: 'Start',
          label: { text: '🚦', fontSize: '20px' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        });
      }
      if (trip.end_lat && trip.end_lng) {
        new google.maps.Marker({
          position: { lat: trip.end_lat, lng: trip.end_lng },
          map: mapInstanceRef.current,
          title: 'Ende',
          label: { text: '🏁', fontSize: '20px' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        });
      }
    });
  }, [trip, settings?.googleMapsApiKey]);

  async function handleSave() {
    if (!trip) return;
    setSaving(true);
    try {
      await updateTrip(trip.id, { category, notes });
      setEditing(false);
      setTrip(prev => prev ? { ...prev, category, notes } : null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!trip) return;
    if (!confirm('Diese Fahrt wirklich löschen?')) return;
    await deleteTrip(trip.id);
    setView('history');
  }

  if (!trip) {
    return (
      <div className="flex-center" style={{ height: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <button className="btn btn-ghost btn-sm" onClick={() => setView('history')}>← Zurück</button>
          <div className="flex gap-sm">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(e => !e)}>
              {editing ? '✕ Abbrechen' : '✏️ Bearbeiten'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleDelete} style={{ color: 'var(--red)' }}>🗑</button>
          </div>
        </div>
        <h1 style={{ marginTop: 12 }}>
          {categoryEmoji(trip.category)} Fahrt vom {formatDate(trip.start_time)}
        </h1>
        <p>{formatTime(trip.start_time)}{trip.end_time ? ` – ${formatTime(trip.end_time)}` : ''}</p>
      </div>

      {/* Map */}
      {settings?.googleMapsApiKey ? (
        <div className="glass mb-md" style={{ height: 300, padding: 0 }}>
          <div ref={mapRef} className="map-container" />
        </div>
      ) : (
        <div className="glass mb-md flex-center" style={{ height: 200 }}>
          <p className="text-secondary">Google Maps API Key in Einstellungen hinterlegen</p>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row mb-md">
        <div className="glass-sm stat-card">
          <div className="stat-value">{trip.distance_km ? trip.distance_km.toFixed(1) : '—'}</div>
          <div className="stat-label">km</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value">{trip.duration_seconds ? formatDuration(trip.duration_seconds) : '—'}</div>
          <div className="stat-label">Dauer</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value" style={{ color: trip.traffic_delay_seconds && trip.traffic_delay_seconds > 60 ? 'var(--orange)' : undefined }}>
            {trip.traffic_delay_seconds && trip.traffic_delay_seconds > 0
              ? `+${formatDuration(trip.traffic_delay_seconds)}`
              : '—'}
          </div>
          <div className="stat-label">🚦 Stau</div>
        </div>
      </div>

      {/* Route info */}
      <div className="glass card mb-md">
        <div className="card-title">Route</div>
        <div style={{ fontSize: 15 }}>
          <div>📍 {trip.start_address || (trip.start_lat ? `${trip.start_lat.toFixed(4)}, ${trip.start_lng?.toFixed(4)}` : 'Unbekannt')}</div>
          <div style={{ margin: '8px 0', color: 'var(--text-tertiary)', paddingLeft: 10 }}>│</div>
          <div>🏁 {trip.end_address || (trip.end_lat ? `${trip.end_lat.toFixed(4)}, ${trip.end_lng?.toFixed(4)}` : 'Unbekannt')}</div>
        </div>
      </div>

      {/* Classify / edit */}
      {editing ? (
        <div className="glass card mb-md">
          <div className="card-title">Bearbeiten</div>
          <div className="form-group">
            <label className="form-label">Kategorie</label>
            <div className="toggle-group">
              {(['private', 'business', 'unclassified'] as TripCategory[]).map(cat => (
                <button
                  key={cat}
                  className={`toggle-btn ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {categoryEmoji(cat)} {categoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notiz</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Zweck der Fahrt, Kundenname, …"
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Speichern…' : '✓ Speichern'}
          </button>
        </div>
      ) : (
        <div className="glass card mb-md">
          <div className="flex-between">
            <span className="card-title" style={{ marginBottom: 0 }}>Kategorie</span>
            <span className={`badge badge-${trip.category}`}>{categoryEmoji(trip.category)} {categoryLabel(trip.category)}</span>
          </div>
          {trip.notes && (
            <>
              <div className="divider" />
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{trip.notes}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c67a5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
