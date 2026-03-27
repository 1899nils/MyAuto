import { useEffect, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { useBluetooth } from '../../hooks/useBluetooth';
import { formatDate, formatTime, formatKm, formatDuration, liveElapsed, categoryLabel, categoryEmoji } from '../../utils/format';
import { Trip, MaintenanceEntryRaw } from '../../types';
import { api } from '../../api/client';

export function Dashboard() {
  const { stats, trips, settings, activeTrip, isTracking, loadStats, loadTrips, startTrip, endTrip, trackPoints, setView } = useTripStore();
  const { pairDevice, supported: btSupported, status: btStatus } = useBluetooth();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [btError, setBtError] = useState('');
  const [dueEntries, setDueEntries] = useState<MaintenanceEntryRaw[]>([]);
  const [dueNow, setDueNow] = useState<number>(Date.now());

  useEffect(() => {
    loadStats();
    loadTrips({ limit: 5 });
    api.getMaintenanceDue().then(data => {
      setDueEntries(data.entries as MaintenanceEntryRaw[]);
      setDueNow(data.now);
    }).catch(() => {/* ignore */});
  }, []);

  useEffect(() => {
    if (!activeTrip) { setElapsed(''); return; }
    const id = setInterval(() => setElapsed(liveElapsed(activeTrip.start_time)), 1000);
    return () => clearInterval(id);
  }, [activeTrip]);

  async function handleStartTrip() {
    setStarting(true);
    try {
      const pos = await getPosition();
      await startTrip({ startLat: pos?.coords.latitude, startLng: pos?.coords.longitude });
    } finally {
      setStarting(false);
    }
  }

  async function handleEndTrip() {
    if (!activeTrip) return;
    setEnding(true);
    try {
      const pos = await getPosition();
      const secs = Math.round((Date.now() - activeTrip.start_time) / 1000);
      const km = calcDistance(trackPoints.map(p => ({ lat: p.lat, lng: p.lng })));
      await endTrip(activeTrip.id, {
        endTime:         Date.now(),
        endLat:          pos?.coords.latitude,
        endLng:          pos?.coords.longitude,
        durationSeconds: secs,
        distanceKm:      km,
      });
      await loadStats();
    } finally {
      setEnding(false);
    }
  }

  async function handlePairBluetooth() {
    setBtError('');
    try { await pairDevice(); }
    catch (e: unknown) { setBtError(e instanceof Error ? e.message : 'Fehler beim Koppeln'); }
  }

  const monthBusiness  = stats?.byCategory.find(c => c.category === 'business');
  const monthPrivate   = stats?.byCategory.find(c => c.category === 'private');
  const totalMonthKm   = (monthBusiness?.km ?? 0) + (monthPrivate?.km ?? 0);
  const businessPct    = totalMonthKm > 0 ? Math.round(((monthBusiness?.km ?? 0) / totalMonthKm) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{formatDate(Date.now())}</p>
        </div>
      </div>

      {/* Active trip banner */}
      {isTracking && activeTrip ? (
        <div className="live-trip-card" style={{ marginBottom: 'var(--sp-md)' }}>
          <div className="live-dot" />
          <div className="live-trip-info" onClick={() => setView('active')} style={{ flex: 1, cursor: 'pointer' }}>
            <div className="live-trip-title">Fahrt läuft · {elapsed}</div>
            <div className="live-trip-sub">
              {calcDistance(trackPoints.map(p => ({ lat: p.lat, lng: p.lng }))).toFixed(1)} km
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('active')}>Karte</button>
          <button className="btn btn-danger btn-sm" onClick={handleEndTrip} disabled={ending}>
            {ending ? '…' : '⏹ Ende'}
          </button>
        </div>
      ) : (
        /* Start trip */
        <div className="glass card" style={{ marginBottom: 'var(--sp-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <div style={{ fontSize: 36 }}>🚗</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Neue Fahrt starten</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Manuell oder automatisch via Bluetooth</div>
            </div>
            <button className="btn btn-success btn-sm" onClick={handleStartTrip} disabled={starting}>
              {starting ? '⏳' : '▶ Start'}
            </button>
          </div>

          {btStatus !== 'unsupported' && (
            <div style={{ marginTop: 'var(--sp-sm)', paddingTop: 'var(--sp-sm)', borderTop: '1px solid var(--glass-border)' }}>
              {btStatus === 'no-device' && (
                <button className="btn btn-ghost btn-sm" onClick={handlePairBluetooth} style={{ width: '100%' }}>
                  🔵 Auto koppeln für Auto-Tracking
                </button>
              )}
              {btStatus === 'waiting' && (
                <div className="bt-status bt-status--waiting">
                  <span className="bt-pulse" />
                  Auto-Tracking aktiv – wartet auf Verbindung
                </div>
              )}
              {btStatus === 'connected' && (
                <div className="bt-status bt-status--connected">
                  <span className="bt-dot" />
                  Verbunden mit {settings?.bluetoothDeviceName || 'Auto'} – Fahrt startet automatisch
                </div>
              )}
              {btError && <p className="text-red" style={{ fontSize: 13, marginTop: 6 }}>{btError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Maintenance alerts */}
      {dueEntries.length > 0 && (() => {
        const overdue = dueEntries.filter(e => {
          const dateOverdue = e.next_date != null && e.next_date < dueNow;
          const kmOverdue = e.next_odometer_km != null && e.vehicle_odometer != null && e.next_odometer_km <= e.vehicle_odometer;
          return dateOverdue || kmOverdue;
        });
        const preview = dueEntries.slice(0, 3);
        return (
          <div
            className={`glass dash-maintenance-alert ${overdue.length > 0 ? 'dash-alert-overdue' : 'dash-alert-due'}`}
            style={{ marginBottom: 'var(--sp-md)', cursor: 'pointer' }}
            onClick={() => setView('fahrzeuge')}
          >
            <div className="dash-alert-header">
              {overdue.length > 0
                ? <span className="dash-alert-badge badge-overdue">⚠️ Wartung überfällig</span>
                : <span className="dash-alert-badge badge-due">🔔 Wartung fällig</span>
              }
              <span className="dash-alert-action">Alle anzeigen →</span>
            </div>
            <div className="dash-alert-items">
              {preview.map(e => {
                const days = e.next_date != null ? Math.round((e.next_date - dueNow) / (1000 * 60 * 60 * 24)) : null;
                const kmDiff = e.next_odometer_km != null && e.vehicle_odometer != null
                  ? Math.round(e.next_odometer_km - e.vehicle_odometer) : null;
                return (
                  <div key={e.id} className="dash-alert-item">
                    <span className="dash-alert-item-title">
                      {e.title}
                      {e.vehicle_name ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {e.vehicle_name}</span> : null}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {days != null && (
                        <span className={`dash-days-chip ${days < 0 ? 'chip-overdue' : 'chip-due'}`}>
                          {days < 0 ? `${Math.abs(days)}d überfällig` : days === 0 ? 'Heute' : `in ${days}d`}
                        </span>
                      )}
                      {kmDiff != null && days == null && (
                        <span className={`dash-days-chip ${kmDiff <= 0 ? 'chip-overdue' : 'chip-due'}`}>
                          {kmDiff <= 0 ? `${Math.abs(kmDiff).toLocaleString('de-DE')} km überfällig` : `noch ${kmDiff.toLocaleString('de-DE')} km`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="stats-row">
        <div className="glass-sm stat-card">
          <div className="stat-value text-accent">{stats?.today.count ?? 0}</div>
          <div className="stat-label">Heute</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value">{stats?.today.km ? stats.today.km.toFixed(1) : '0'}</div>
          <div className="stat-label">km heute</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value">{stats?.month.count ?? 0}</div>
          <div className="stat-label">Diesen Monat</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value">{stats?.month.km ? stats.month.km.toFixed(0) : '0'}</div>
          <div className="stat-label">km Monat</div>
        </div>
      </div>

      {/* Business / private split */}
      {totalMonthKm > 0 && (
        <div className="glass card" style={{ marginBottom: 'var(--sp-md)' }}>
          <div className="card-title">Aufteilung Monat</div>
          <div className="flex-between" style={{ fontSize: 14, marginBottom: 6 }}>
            <span>💼 Beruflich</span>
            <span style={{ fontWeight: 600 }}>{formatKm(monthBusiness?.km ?? 0)} ({businessPct}%)</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--glass-bg)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${businessPct}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
              borderRadius: 4, transition: 'width 0.6s var(--ease)',
            }} />
          </div>
          <div className="flex-between" style={{ fontSize: 14 }}>
            <span>🏠 Privat</span>
            <span style={{ fontWeight: 600 }}>{formatKm(monthPrivate?.km ?? 0)} ({100 - businessPct}%)</span>
          </div>
        </div>
      )}

      {/* Recent trips */}
      <div className="glass list-card" style={{ marginBottom: 0 }}>
        <div className="list-card-header">
          <span className="card-title" style={{ margin: 0 }}>Letzte Fahrten</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('history')}>Alle →</button>
        </div>
        {trips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗺️</div>
            <h3>Keine Fahrten</h3>
            <p>Starte deine erste Fahrt!</p>
          </div>
        ) : (
          trips.slice(0, 5).map(trip => (
            <div key={trip.id} className="list-item" onClick={() => setView('detail', trip.id)}>
              <div className={`list-item-icon-box ${trip.category}`}>
                {categoryEmoji(trip.category)}
              </div>
              <div className="list-item-body">
                <div className="list-item-title">
                  {trip.start_address
                    ? `${trip.start_address.split(',')[0]} → ${trip.end_address?.split(',')[0] ?? '…'}`
                    : formatDate(trip.start_time)}
                </div>
                <div className="list-item-sub">
                  {formatTime(trip.start_time)} · {categoryLabel(trip.category)}
                </div>
              </div>
              <div className="list-item-end">
                {trip.distance_km != null && <div className="list-item-value">{formatKm(trip.distance_km)}</div>}
                {trip.duration_seconds != null && <div className="list-item-label">{formatDuration(trip.duration_seconds)}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

async function getPosition(): Promise<GeolocationPosition | null> {
  if (!navigator.geolocation) return null;
  return new Promise(resolve =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000 })
  );
}

function calcDistance(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371;
    const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
    const dLng = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((points[i - 1].lat * Math.PI) / 180) * Math.cos((points[i].lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}
