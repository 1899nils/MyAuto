import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { api } from '../../api/client';
import { Trip, TripCategory } from '../../types';
import { formatDate, formatTime, formatKm, formatDuration, categoryLabel, categoryEmoji } from '../../utils/format';
import { loadGoogleMaps, createPolyline } from '../../utils/maps';

export function TripDetail() {
  const { selectedTripId, trips, settings, updateTrip, setView, deleteTrip } = useTripStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<TripCategory>('unclassified');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
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

    // Reset map instance when trip changes
    mapInstanceRef.current = null;

    loadGoogleMaps(settings.googleMapsApiKey).then(() => {
      if (!mapRef.current) return;

      const center = trip.start_lat && trip.start_lng
        ? { lat: trip.start_lat, lng: trip.start_lng }
        : { lat: 51.1657, lng: 10.4515 };

      const map = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
        styles: darkMapStyle,
      });
      mapInstanceRef.current = map;

      // Draw route
      const drawRouteAndMarkers = (path: { lat: number; lng: number }[]) => {
        if (path.length > 1) {
          createPolyline(path).setMap(map);
          const bounds = new google.maps.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { top: 48, right: 32, bottom: 48, left: 32 });
        }

        // Start marker – green circle with "A"
        if (trip.start_lat && trip.start_lng) {
          new google.maps.Marker({
            position: { lat: trip.start_lat, lng: trip.start_lng },
            map,
            title: 'Start',
            zIndex: 10,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#34C759',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2.5,
              scale: 11,
            },
            label: { text: 'A', color: '#ffffff', fontWeight: '700', fontSize: '11px' },
          });
        }

        // End marker – red circle with "B"
        if (trip.end_lat && trip.end_lng) {
          new google.maps.Marker({
            position: { lat: trip.end_lat, lng: trip.end_lng },
            map,
            title: 'Ziel',
            zIndex: 10,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#FF3B30',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2.5,
              scale: 11,
            },
            label: { text: 'B', color: '#ffffff', fontWeight: '700', fontSize: '11px' },
          });
        }
      };

      if (trip.route_polyline) {
        const path = google.maps.geometry.encoding
          .decodePath(trip.route_polyline)
          .map(p => ({ lat: p.lat(), lng: p.lng() }));
        drawRouteAndMarkers(path);
      } else {
        api.getTrackPoints(trip.id).then(points => {
          drawRouteAndMarkers(points.map(p => ({ lat: p.lat, lng: p.lng })));
        });
      }
    });
  }, [trip?.id, settings?.googleMapsApiKey]);

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

  const hasRoute = !!(trip.start_address || trip.end_address || trip.start_lat || trip.end_lat);

  return (
    <div className="trip-detail">
      {/* ── Header ─────────────────────────────────── */}
      <div className="trip-detail-header">
        <button className="btn btn-ghost btn-sm" onClick={() => setView('history')}>
          ← Zurück
        </button>
        <div className="page-actions">
          {!editing && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              ✏️ Bearbeiten
            </button>
          )}
          {deleteConfirm ? (
            <>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>Löschen</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(false)}>Abbrechen</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
              onClick={() => setDeleteConfirm(true)}>🗑</button>
          )}
        </div>
      </div>

      {/* ── Title ──────────────────────────────────── */}
      <div className="trip-detail-title">
        <span className={`list-item-icon-box ${trip.category}`} style={{ width: 48, height: 48, fontSize: 24 }}>
          {categoryEmoji(trip.category)}
        </span>
        <div>
          <h1 className="page-title" style={{ fontSize: 22 }}>
            {formatDate(trip.start_time)}
          </h1>
          <p className="page-subtitle">
            {formatTime(trip.start_time)}
            {trip.end_time ? ` – ${formatTime(trip.end_time)}` : ''}
          </p>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────── */}
      {settings?.googleMapsApiKey ? (
        <div className="trip-detail-map glass">
          <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 'var(--r-lg)' }} />
        </div>
      ) : (
        <div className="trip-detail-map glass flex-center">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
            <p className="text-secondary" style={{ fontSize: 13 }}>
              Google Maps API Key in Einstellungen hinterlegen
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────── */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--sp-md)' }}>
        <div className="glass-sm stat-card">
          <div className="stat-value">{trip.distance_km ? trip.distance_km.toFixed(1) : '—'}</div>
          <div className="stat-label">km</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value">{trip.duration_seconds ? formatDuration(trip.duration_seconds) : '—'}</div>
          <div className="stat-label">Dauer</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value" style={{
            color: trip.traffic_delay_seconds && trip.traffic_delay_seconds > 60 ? 'var(--orange)' : undefined,
          }}>
            {trip.traffic_delay_seconds && trip.traffic_delay_seconds > 60
              ? `+${formatDuration(trip.traffic_delay_seconds)}`
              : '—'}
          </div>
          <div className="stat-label">🚦 Stau</div>
        </div>
      </div>

      {/* ── Details card ───────────────────────────── */}
      {editing ? (
        <div className="glass inline-form">
          <h3 className="inline-form-title">Fahrt bearbeiten</h3>
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
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Zweck der Fahrt, Kundenname, …"
              rows={3}
              style={{ resize: 'none' }}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setNotes(trip.notes || ''); setCategory(trip.category); }}>
              Abbrechen
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '…' : '✓ Speichern'}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass card" style={{ marginBottom: 'var(--sp-md)', padding: 0 }}>
          {/* Category row */}
          <div className="trip-detail-row">
            <span className="trip-detail-row-label">Kategorie</span>
            <span className={`badge badge-${trip.category}`}>{categoryEmoji(trip.category)} {categoryLabel(trip.category)}</span>
          </div>

          {/* Route rows */}
          {hasRoute && (
            <>
              <div className="trip-detail-divider" />
              <div className="trip-detail-row">
                <span className="trip-detail-row-icon" style={{ color: 'var(--green)' }}>●</span>
                <span className="trip-detail-row-text">
                  {trip.start_address?.split(',')[0] || (trip.start_lat ? `${trip.start_lat.toFixed(4)}, ${trip.start_lng?.toFixed(4)}` : 'Unbekannt')}
                </span>
              </div>
              <div className="trip-detail-route-line" />
              <div className="trip-detail-row">
                <span className="trip-detail-row-icon" style={{ color: 'var(--red)' }}>●</span>
                <span className="trip-detail-row-text">
                  {trip.end_address?.split(',')[0] || (trip.end_lat ? `${trip.end_lat.toFixed(4)}, ${trip.end_lng?.toFixed(4)}` : 'Unbekannt')}
                </span>
              </div>
            </>
          )}

          {/* Notes */}
          {trip.notes && (
            <>
              <div className="trip-detail-divider" />
              <div className="trip-detail-row" style={{ alignItems: 'flex-start' }}>
                <span className="trip-detail-row-label">Notiz</span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'right', flex: 1 }}>{trip.notes}</span>
              </div>
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
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c67a5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
