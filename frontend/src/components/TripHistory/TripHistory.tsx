import { useEffect, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { TripCategory, Trip, Vehicle } from '../../types';
import {
  formatDate, formatTime, formatKm, formatDuration,
  categoryLabel, categoryEmoji, liveElapsed,
} from '../../utils/format';
import { api } from '../../api/client';
import { AddressSearch, PlaceResult } from '../ui/AddressSearch';
import { resolveAddress } from '../../utils/addressUtils';

// ---- helpers for inline add-form ----
function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(v: string): number { return new Date(v).getTime(); }

const CATEGORIES: { value: TripCategory | 'all'; label: string }[] = [
  { value: 'all',           label: 'Alle'         },
  { value: 'business',      label: '💼 Beruflich'  },
  { value: 'private',       label: '🏠 Privat'     },
  { value: 'unclassified',  label: '❓ Offen'       },
];

const MONTH_NAMES = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
];

const emptyTripForm = () => ({
  startVal:    toDatetimeLocal(Date.now() - 3_600_000),
  endVal:      toDatetimeLocal(Date.now()),
  startAddress: '',
  endAddress:   '',
  startLat: undefined as number | undefined,
  startLng: undefined as number | undefined,
  endLat:   undefined as number | undefined,
  endLng:   undefined as number | undefined,
  distanceKm: '',
  category:   'unclassified' as TripCategory,
  notes:      '',
  vehicleId:  undefined as number | undefined,
});

export function TripHistory() {
  const {
    trips, totalTrips, loadTrips, deleteTrip, setView,
    isTracking, activeTrip, trackPoints, endTrip, loadStats,
    addManualTrip, settings,
  } = useTripStore();
  const aliases = settings?.addressAliases ?? {};

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filter, setFilter] = useState<TripCategory | 'all'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<number | undefined>(undefined);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // load vehicles for filter + form
  useEffect(() => { api.getVehicles().then(r => setVehicles(r.vehicles)); }, []);

  // live elapsed for active trip
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!activeTrip) { setElapsed(''); return; }
    const id = setInterval(() => setElapsed(liveElapsed(activeTrip.start_time)), 1000);
    return () => clearInterval(id);
  }, [activeTrip]);

  // inline add-form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTripForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [ending, setEnding] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // PDF export
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [pdfYear, setPdfYear] = useState(now.getFullYear());
  useEffect(() => {
    if (!showPdfMenu) return;
    const handler = () => setShowPdfMenu(false);
    setTimeout(() => window.addEventListener('click', handler), 0);
    return () => window.removeEventListener('click', handler);
  }, [showPdfMenu]);

  const startTs = fromDatetimeLocal(form.startVal);
  const endTs   = fromDatetimeLocal(form.endVal);
  const valid   = endTs > startTs;

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setPage(0);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setPage(0);
  }

  const periodStart = new Date(year, month - 1, 1).getTime();
  const periodEnd   = new Date(year, month,     1).getTime();

  useEffect(() => {
    loadTrips({
      category:   filter === 'all' ? undefined : filter,
      vehicle_id: vehicleFilter,
      from:       periodStart,
      to:         periodEnd,
      limit:      PAGE_SIZE,
      offset:     page * PAGE_SIZE,
    });
  }, [filter, vehicleFilter, year, month, page]);

  async function handleEnd() {
    if (!activeTrip) return;
    setEnding(true);
    try {
      const secs = Math.round((Date.now() - activeTrip.start_time) / 1000);
      const last = trackPoints[trackPoints.length - 1];
      const km   = calcDistance(trackPoints.map(p => ({ lat: p.lat, lng: p.lng })));
      await endTrip(activeTrip.id, {
        endTime:         Date.now(),
        endLat:          last?.lat,
        endLng:          last?.lng,
        durationSeconds: secs,
        distanceKm:      km,
      });
      await loadStats();
    } finally {
      setEnding(false);
    }
  }

  async function handleAddTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setFormError('');
    try {
      await addManualTrip({
        startTime:       startTs,
        endTime:         endTs,
        startAddress:    form.startAddress.trim() || undefined,
        endAddress:      form.endAddress.trim()   || undefined,
        startLat:        form.startLat,
        startLng:        form.startLng,
        endLat:          form.endLat,
        endLng:          form.endLng,
        distanceKm:      form.distanceKm ? parseFloat(form.distanceKm) : undefined,
        durationSeconds: Math.round((endTs - startTs) / 1000),
        category:        form.category,
        notes:           form.notes.trim() || undefined,
        vehicleId:       form.vehicleId,
      });
      setShowForm(false);
      setForm(emptyTripForm());
      // navigate to the month of the saved trip
      const d = new Date(startTs);
      setYear(d.getFullYear());
      setMonth(d.getMonth() + 1);
      loadTrips({
        category: filter === 'all' ? undefined : filter,
        from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        to:   new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
        limit: PAGE_SIZE, offset: 0,
      });
      setPage(0);
    } catch {
      setFormError('Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, trip: Trip) {
    e.stopPropagation();
    await deleteTrip(trip.id);
    setDeleteConfirm(null);
    loadTrips({ category: filter === 'all' ? undefined : filter, from: periodStart, to: periodEnd, limit: PAGE_SIZE, offset: 0 });
  }

  const liveDist = calcDistance(trackPoints.map(p => ({ lat: p.lat, lng: p.lng })));
  const totalPages = Math.ceil(totalTrips / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🚗 Fahrten</h1>
          <p className="page-subtitle">{totalTrips} Fahrten gesamt</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(s => !s); setForm(emptyTripForm()); }}>
            {showForm ? '✕' : '+ Erfassen'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => api.exportCsv()} title="CSV exportieren">
            ⬇ CSV
          </button>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPdfMenu(s => !s)} title="Fahrtenbuch PDF">
              📄 PDF
            </button>
            {showPdfMenu && (
              <div className="glass" style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 100,
                padding: 'var(--sp-md)', minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>
                  Steuerliches Fahrtenbuch
                </p>
                <div className="form-group" style={{ marginBottom: 'var(--sp-sm)' }}>
                  <label className="form-label">Jahr</label>
                  <input
                    type="number"
                    className="form-input"
                    value={pdfYear}
                    min={2020} max={now.getFullYear()}
                    onChange={e => setPdfYear(Number(e.target.value))}
                    style={{ textAlign: 'center' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { api.exportLogbookPdf(pdfYear, 'business'); setShowPdfMenu(false); }}
                  >
                    💼 Berufliche Fahrten
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { api.exportLogbookPdf(pdfYear, 'private'); setShowPdfMenu(false); }}
                  >
                    🏠 Private Fahrten
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active trip banner */}
      {isTracking && activeTrip && (
        <div className="live-trip-card">
          <div className="live-dot" />
          <div className="live-trip-info" onClick={() => setView('active')} style={{ flex: 1, cursor: 'pointer' }}>
            <div className="live-trip-title">Fahrt läuft · {elapsed}</div>
            <div className="live-trip-sub">{liveDist > 0 ? formatKm(liveDist) : 'Standort wird erfasst…'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('active')}>Karte</button>
          <button className="btn btn-danger btn-sm" onClick={handleEnd} disabled={ending}>
            {ending ? '…' : '⏹ Ende'}
          </button>
        </div>
      )}

      {/* Period navigation */}
      <div className="period-nav">
        <button className="btn btn-ghost btn-icon" onClick={prevMonth}>‹</button>
        <div className="period-nav-label">
          <span className="period-month">{MONTH_NAMES[month - 1]}</span>
          <span className="period-year">{year}</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={nextMonth}>›</button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'center', marginTop: 'var(--sp-sm)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        <div className="toggle-group">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`toggle-btn ${filter === c.value ? 'active' : ''}`}
              onClick={() => { setFilter(c.value); setPage(0); }}
            >
              {c.label}
            </button>
          ))}
        </div>
        {vehicles.length > 0 && (
          <select
            className="form-input"
            style={{ width: 'auto', minWidth: 140, fontSize: 13 }}
            value={vehicleFilter ?? ''}
            onChange={e => { setVehicleFilter(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
          >
            <option value="">🚗 Alle Fahrzeuge</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name as string}</option>)}
          </select>
        )}
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="glass inline-form">
          <h3 className="inline-form-title">Fahrt manuell erfassen</h3>
          <form onSubmit={handleAddTrip}>

            {/* Von */}
            <div className="form-group">
              <label className="form-label">Von</label>
              <AddressSearch
                value={form.startAddress}
                onChange={v => setForm(f => ({ ...f, startAddress: v, startLat: undefined, startLng: undefined }))}
                onPlace={(p: PlaceResult) => setForm(f => ({ ...f, startAddress: p.address, startLat: p.lat, startLng: p.lng }))}
                placeholder="Startadresse suchen…"
              />
              {form.startLat && (
                <p className="form-hint" style={{ textAlign: 'left', marginTop: 4 }}>
                  📍 {form.startLat.toFixed(5)}, {form.startLng?.toFixed(5)}
                </p>
              )}
            </div>

            {/* Nach */}
            <div className="form-group">
              <label className="form-label">Nach</label>
              <AddressSearch
                value={form.endAddress}
                onChange={v => setForm(f => ({ ...f, endAddress: v, endLat: undefined, endLng: undefined }))}
                onPlace={(p: PlaceResult) => setForm(f => ({ ...f, endAddress: p.address, endLat: p.lat, endLng: p.lng }))}
                placeholder="Zieladresse suchen…"
              />
              {form.endLat && (
                <p className="form-hint" style={{ textAlign: 'left', marginTop: 4 }}>
                  📍 {form.endLat.toFixed(5)}, {form.endLng?.toFixed(5)}
                </p>
              )}
            </div>

            {/* Abfahrt */}
            <div className="form-group">
              <label className="form-label">Abfahrt</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.startVal}
                onChange={e => setForm(f => ({ ...f, startVal: e.target.value }))}
                required
              />
            </div>

            {/* Ankunft */}
            <div className="form-group">
              <label className="form-label">Ankunft</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.endVal}
                onChange={e => setForm(f => ({ ...f, endVal: e.target.value }))}
                required
              />
              {valid && endTs > startTs && (
                <p className="form-hint" style={{ textAlign: 'left', marginTop: 4 }}>
                  Dauer: {formatDuration(Math.round((endTs - startTs) / 1000))}
                </p>
              )}
            </div>

            {/* Distanz */}
            <div className="form-group">
              <label className="form-label">Distanz (km)</label>
              <input
                type="number"
                className="form-input"
                placeholder="z.B. 42.5"
                min="0" step="0.1"
                value={form.distanceKm}
                onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))}
              />
            </div>

            {/* Kategorie */}
            <div className="form-group">
              <label className="form-label">Kategorie</label>
              <div className="toggle-group">
                {([
                  { value: 'private',      label: '🏠 Privat'    },
                  { value: 'business',     label: '💼 Beruflich' },
                  { value: 'unclassified', label: '❓ Offen'      },
                ] as { value: TripCategory; label: string }[]).map(c => (
                  <button
                    key={c.value}
                    type="button"
                    className={`toggle-btn ${form.category === c.value ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fahrzeug */}
            {vehicles.length > 0 && (
              <div className="form-group">
                <label className="form-label">Fahrzeug</label>
                <select
                  className="form-input"
                  value={form.vehicleId ?? ''}
                  onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value ? Number(e.target.value) : undefined }))}
                >
                  <option value="">– kein Fahrzeug –</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.name as string}</option>)}
                </select>
              </div>
            )}

            {/* Notiz */}
            <div className="form-group">
              <label className="form-label">Notiz (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Zweck der Fahrt, Kundenname, …"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {formError && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--sp-sm)' }}>{formError}</p>}

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || !valid}>
                {saving ? '…' : '✓ Speichern'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trip list */}
      {trips.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">🗓️</div>
            <h3>Keine Fahrten</h3>
            <p>{MONTH_NAMES[month - 1]} {year} — nichts aufgezeichnet</p>
          </div>
        </div>
      ) : (
        <div className="glass list-card">
          {trips.map(trip => (
            <div
              key={trip.id}
              className="list-item"
              onClick={() => setView('detail', trip.id)}
            >
              <div className={`list-item-icon-box ${trip.category}`}>
                {categoryEmoji(trip.category)}
              </div>
              <div className="list-item-body">
                <div className="list-item-title">
                  {trip.start_address
                    ? `${resolveAddress(trip.start_address, aliases)}${trip.end_address ? ` → ${resolveAddress(trip.end_address, aliases)}` : ''}`
                    : `Fahrt am ${formatDate(trip.start_time)}`}
                </div>
                <div className="list-item-sub">
                  {formatDate(trip.start_time)}, {formatTime(trip.start_time)}
                  {trip.end_time && ` – ${formatTime(trip.end_time)}`}
                  {' · '}
                  <span className={`badge badge-${trip.category}`}>{categoryLabel(trip.category)}</span>
                </div>
                {trip.traffic_delay_seconds && trip.traffic_delay_seconds > 120 && (
                  <div className="list-item-tag" style={{ color: 'var(--orange)' }}>
                    🚦 +{formatDuration(trip.traffic_delay_seconds)} Stau
                  </div>
                )}
              </div>
              <div className="list-item-end">
                {trip.distance_km != null && <div className="list-item-value">{formatKm(trip.distance_km)}</div>}
                {trip.duration_seconds != null && <div className="list-item-label">{formatDuration(trip.duration_seconds)}</div>}
                <div className="list-item-actions" onClick={e => e.stopPropagation()}>
                  {deleteConfirm === trip.id ? (
                    <>
                      <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, trip)}>Löschen</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>✕</button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setDeleteConfirm(trip.id)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-center gap-sm" style={{ marginTop: 'var(--sp-md)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            ← Zurück
          </button>
          <span className="text-secondary" style={{ fontSize: 14 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= totalTrips}
          >
            Weiter →
          </button>
        </div>
      )}
    </div>
  );
}

function calcDistance(points: { lat: number; lng: number }[]): number {
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
