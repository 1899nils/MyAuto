import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { api } from '../../api/client';
import { Trip, TripCategory, Vehicle } from '../../types';
import { formatDate, formatTime, formatKm, formatDuration, categoryLabel, categoryEmoji } from '../../utils/format';
import { loadGoogleMaps, createPolyline } from '../../utils/maps';
import { resolveAddress } from '../../utils/addressUtils';
import { showToast } from '../ui/Toast';

// Small helper to update a trip silently (fire-and-forget, no store re-render needed here)
async function patchTrip(id: number, data: Parameters<typeof api.updateTrip>[1]) {
  try { await api.updateTrip(id, data); } catch { /* ignore */ }
}

export function TripDetail() {
  const { selectedTripId, trips, settings, updateTrip, setView, deleteTrip } = useTripStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<TripCategory>('unclassified');
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [noRouteData, setNoRouteData] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    api.getVehicles().then(r => setVehicles(r.vehicles)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTripId) return;
    const found = trips.find(t => t.id === selectedTripId);
    if (found) {
      setTrip(found);
      setNotes(found.notes || '');
      setCategory(found.category);
      setVehicleId(found.vehicle_id ?? null);
    } else {
      api.getTrip(selectedTripId).then(t => {
        setTrip(t);
        setNotes(t.notes || '');
        setCategory(t.category);
        setVehicleId(t.vehicle_id ?? null);
      });
    }
  }, [selectedTripId]);

  useEffect(() => {
    setNoRouteData(false);
  }, [trip?.id]);

  useEffect(() => {
    if (!trip || !mapRef.current || !settings?.googleMapsApiKey) return;

    // Don't bother loading the map if there's nothing to show
    const hasData = trip.route_polyline || trip.start_lat || trip.end_lat
      || trip.start_address || trip.end_address;
    if (!hasData) { setNoRouteData(true); return; }

    mapInstanceRef.current = null;

    const t = trip; // narrowed, non-null reference for closures

    loadGoogleMaps(settings.googleMapsApiKey).then(() => {
      if (!mapRef.current) return;

      const center: google.maps.LatLngLiteral = t.start_lat && t.start_lng
        ? { lat: t.start_lat, lng: t.start_lng }
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

      // ── helper: draw polyline + A/B markers ─────────────────
      function placeMarker(pos: google.maps.LatLngLiteral, label: string, color: string) {
        new google.maps.Marker({
          position: pos, map, zIndex: 10,
          title: label === 'A' ? 'Start' : 'Ziel',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color, fillOpacity: 1,
            strokeColor: '#ffffff', strokeWeight: 2.5,
            scale: 11,
          },
          label: { text: label, color: '#ffffff', fontWeight: '700', fontSize: '11px' },
        });
      }

      function drawRoute(
        path: google.maps.LatLngLiteral[],
        startPos?: google.maps.LatLngLiteral,
        endPos?: google.maps.LatLngLiteral,
      ) {
        if (path.length > 1) {
          createPolyline(path).setMap(map);
          const bounds = new google.maps.LatLngBounds();
          path.forEach(p => bounds.extend(p));
          map.fitBounds(bounds, { top: 48, right: 32, bottom: 48, left: 32 });
        }
        const s = startPos ?? (t.start_lat && t.start_lng
          ? { lat: t.start_lat, lng: t.start_lng } : path[0]);
        const e = endPos ?? (t.end_lat && t.end_lng
          ? { lat: t.end_lat, lng: t.end_lng } : path[path.length - 1]);
        if (s) placeMarker(s, 'A', '#34C759');
        if (e) placeMarker(e, 'B', '#FF3B30');
      }

      // ── fallback 3a: address strings → Directions API ────────
      function tryAddressRoute() {
        const origin = t.start_address?.trim() || null;
        const destination = t.end_address?.trim() || null;
        if (!origin || !destination) {
          // fallback 3b: straight line between coordinates
          tryCoordRoute();
          return;
        }

        new google.maps.DirectionsService().route(
          { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
          (result, status) => {
            if (status !== google.maps.DirectionsStatus.OK || !result) {
              tryCoordRoute();
              return;
            }
            const leg = result.routes[0].legs[0];
            const path = result.routes[0].overview_path
              .map(p => ({ lat: p.lat(), lng: p.lng() }));
            drawRoute(
              path,
              { lat: leg.start_location.lat(), lng: leg.start_location.lng() },
              { lat: leg.end_location.lat(),   lng: leg.end_location.lng()   },
            );
            // Auto-save distance if not yet set
            if (!t.distance_km && leg.distance?.value) {
              const km = Math.round(leg.distance.value / 10) / 100;
              setTrip(prev => prev ? { ...prev, distance_km: km } : prev);
              patchTrip(t.id, { distanceKm: km });
            }
          },
        );
      }

      // ── fallback 3b: straight line between stored coordinates ─
      function tryCoordRoute() {
        const s = t.start_lat && t.start_lng ? { lat: t.start_lat, lng: t.start_lng } : null;
        const e = t.end_lat   && t.end_lng   ? { lat: t.end_lat,   lng: t.end_lng   } : null;
        if (!s && !e) { setNoRouteData(true); return; }
        if (s) placeMarker(s, 'A', '#34C759');
        if (e) placeMarker(e, 'B', '#FF3B30');
        if (s && e) {
          createPolyline([s, e]).setMap(map);
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(s); bounds.extend(e);
          map.fitBounds(bounds, { top: 48, right: 32, bottom: 48, left: 32 });
        } else if (s) {
          map.setCenter(s); map.setZoom(14);
        }
      }

      // ── priority 1: encoded polyline ─────────────────────────
      if (t.route_polyline) {
        const path = google.maps.geometry.encoding
          .decodePath(t.route_polyline)
          .map(p => ({ lat: p.lat(), lng: p.lng() }));
        drawRoute(path);
        return;
      }

      // ── priority 2: raw GPS track points ─────────────────────
      api.getTrackPoints(t.id).then(points => {
        if (points.length > 1) {
          drawRoute(points.map(p => ({ lat: p.lat, lng: p.lng })));
        } else {
          // ── priority 3: derive route from addresses / coords ──
          tryAddressRoute();
        }
      });
    });
  }, [trip?.id, settings?.googleMapsApiKey]);

  async function handleSave() {
    if (!trip) return;
    setSaving(true);
    try {
      await updateTrip(trip.id, { category, notes, vehicleId });
      setEditing(false);
      setTrip(prev => prev ? { ...prev, category, notes, vehicle_id: vehicleId } : null);
      showToast('Fahrt gespeichert');
    } catch {
      showToast('Fehler beim Speichern', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!trip) return;
    await deleteTrip(trip.id);
    showToast('Fahrt gelöscht', 'info');
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
      {settings?.googleMapsApiKey && !noRouteData ? (
        <div className="trip-detail-map glass">
          <div ref={mapRef} style={{ width: '100%', height: '280px', borderRadius: 'var(--r-lg)' }} />
        </div>
      ) : (
        <div className="trip-detail-map glass flex-center">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🗺️</div>
            <p className="text-secondary" style={{ fontSize: 13 }}>
              {!settings?.googleMapsApiKey
                ? 'Google Maps API Key in Einstellungen hinterlegen'
                : 'Keine Standortdaten für diese Fahrt'}
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
          {vehicles.length > 0 && (
            <div className="form-group">
              <label className="form-label">Fahrzeug</label>
              <select
                className="form-input"
                value={vehicleId ?? ''}
                onChange={e => setVehicleId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">– kein Fahrzeug –</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name as string}</option>)}
              </select>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setNotes(trip.notes || ''); setCategory(trip.category); setVehicleId(trip.vehicle_id ?? null); }}>
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
                  {trip.start_address ? resolveAddress(trip.start_address, settings?.addressAliases) : (trip.start_lat ? `${trip.start_lat.toFixed(4)}, ${trip.start_lng?.toFixed(4)}` : 'Unbekannt')}
                </span>
              </div>
              <div className="trip-detail-route-line" />
              <div className="trip-detail-row">
                <span className="trip-detail-row-icon" style={{ color: 'var(--red)' }}>●</span>
                <span className="trip-detail-row-text">
                  {trip.end_address ? resolveAddress(trip.end_address, settings?.addressAliases) : (trip.end_lat ? `${trip.end_lat.toFixed(4)}, ${trip.end_lng?.toFixed(4)}` : 'Unbekannt')}
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
