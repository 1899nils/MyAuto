import { useEffect, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { useBluetooth } from '../../hooks/useBluetooth';
import { formatDate, formatTime, formatKm, formatDuration, liveElapsed, categoryLabel } from '../../utils/format';
import { Trip } from '../../types';

export function Dashboard() {
  const { stats, trips, settings, activeTrip, isTracking, loadStats, loadTrips, startTrip, endTrip, trackPoints, setView } = useTripStore();
  const { pairDevice, supported: btSupported, status: btStatus } = useBluetooth();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [btError, setBtError] = useState('');

  useEffect(() => { loadStats(); loadTrips({ limit: 5 }); }, []);

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
        endTime: Date.now(),
        endLat: pos?.coords.latitude,
        endLng: pos?.coords.longitude,
        durationSeconds: secs,
        distanceKm: km,
      });
      await loadStats();
    } finally {
      setEnding(false);
    }
  }

  async function handlePairBluetooth() {
    setBtError('');
    try {
      await pairDevice();
    } catch (e: unknown) {
      setBtError(e instanceof Error ? e.message : 'Fehler beim Koppeln');
    }
  }

  const monthBusiness = stats?.byCategory.find(c => c.category === 'business');
  const monthPrivate = stats?.byCategory.find(c => c.category === 'private');
  const totalMonthKm = (monthBusiness?.km ?? 0) + (monthPrivate?.km ?? 0);
  const businessPct = totalMonthKm > 0 ? Math.round(((monthBusiness?.km ?? 0) / totalMonthKm) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>{formatDate(Date.now())}</p>
      </div>

      {/* Active Trip Banner */}
      {isTracking && activeTrip && (
        <div className="active-banner glass mb-md" onClick={() => setView('active')}>
          <div className="active-dot" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Fahrt läuft – {elapsed}</div>
            <div className="text-secondary" style={{ fontSize: 13 }}>
              {calcDistance(trackPoints.map(p => ({ lat: p.lat, lng: p.lng }))).toFixed(1)} km
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleEndTrip(); }} disabled={ending}>
            {ending ? 'Beende…' : '⏹ Beenden'}
          </button>
        </div>
      )}

      {/* Start Trip (only if not tracking) */}
      {!isTracking && (
        <div className="glass card mb-md" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚗</div>
          <h2 style={{ marginBottom: 8, fontSize: 20 }}>Neue Fahrt starten</h2>
          <p className="text-secondary mb-md" style={{ fontSize: 14 }}>
            Manuell oder automatisch via Bluetooth wenn du dein Auto startest
          </p>
          <button className="btn btn-success btn-lg btn-full" onClick={handleStartTrip} disabled={starting}>
            {starting ? '⏳ Starte…' : '▶ Fahrt starten'}
          </button>
          {btStatus !== 'unsupported' && (
            <div className="mt-md">
              {btStatus === 'no-device' && (
                <button className="btn btn-ghost btn-sm" onClick={handlePairBluetooth}>
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
              {btError && <p className="text-red mt-sm" style={{ fontSize: 13 }}>{btError}</p>}
            </div>
          )}
        </div>
      )}

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

      {/* Business vs Private Split */}
      {totalMonthKm > 0 && (
        <div className="glass card mb-md">
          <div className="card-title">Diesen Monat</div>
          <div className="flex-between mb-sm">
            <span style={{ fontSize: 14 }}>💼 Beruflich</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {formatKm(monthBusiness?.km ?? 0)} ({businessPct}%)
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 4,
            background: 'var(--glass-bg)',
            overflow: 'hidden',
            marginBottom: 10
          }}>
            <div style={{
              height: '100%',
              width: `${businessPct}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
              borderRadius: 4,
              transition: 'width 0.6s var(--ease)'
            }} />
          </div>
          <div className="flex-between">
            <span style={{ fontSize: 14 }}>🏠 Privat</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {formatKm(monthPrivate?.km ?? 0)} ({100 - businessPct}%)
            </span>
          </div>
        </div>
      )}

      {/* Recent Trips */}
      <div className="glass card" style={{ padding: 0 }}>
        <div style={{ padding: 'var(--sp-md) var(--sp-lg)' }} className="flex-between">
          <span className="card-title" style={{ marginBottom: 0 }}>Letzte Fahrten</span>
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
            <TripListItem key={trip.id} trip={trip} onClick={() => setView('detail', trip.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function TripListItem({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  return (
    <div className="trip-item" onClick={onClick}>
      <div className={`trip-item-icon ${trip.category}`}>
        {trip.category === 'business' ? '💼' : trip.category === 'private' ? '🏠' : '❓'}
      </div>
      <div className="trip-item-info">
        <div className="trip-item-route">
          {trip.start_address
            ? `${trip.start_address.split(',')[0]} → ${trip.end_address?.split(',')[0] ?? '…'}`
            : formatDate(trip.start_time)}
        </div>
        <div className="trip-item-meta">
          {formatTime(trip.start_time)} &bull; {categoryLabel(trip.category)}
          {trip.traffic_delay_seconds && trip.traffic_delay_seconds > 60
            ? ` &bull; 🚦 +${formatDuration(trip.traffic_delay_seconds)} Stau`
            : ''}
        </div>
      </div>
      <div className="trip-item-stats">
        {trip.distance_km && <div className="trip-item-km">{trip.distance_km.toFixed(1)} km</div>}
        {trip.duration_seconds && <div className="trip-item-time">{formatDuration(trip.duration_seconds)}</div>}
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
