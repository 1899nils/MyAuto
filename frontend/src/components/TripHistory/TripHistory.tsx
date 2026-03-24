import { useEffect, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { TripCategory, Trip } from '../../types';
import { formatDate, formatTime, formatKm, formatDuration, categoryLabel } from '../../utils/format';
import { api } from '../../api/client';
import { AddTripModal } from '../ui/AddTripModal';

const CATEGORIES: { value: TripCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'business', label: '💼 Beruflich' },
  { value: 'private', label: '🏠 Privat' },
  { value: 'unclassified', label: '❓ Offen' },
];

export function TripHistory() {
  const { trips, totalTrips, loadTrips, deleteTrip, setView } = useTripStore();
  const [filter, setFilter] = useState<TripCategory | 'all'>('all');
  const [monthOffset, setMonthOffset] = useState(0);
  const [page, setPage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const PAGE_SIZE = 20;

  const now = new Date();
  const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 1);

  useEffect(() => {
    loadTrips({
      category: filter === 'all' ? undefined : filter,
      from: targetMonth.getTime(),
      to: nextMonth.getTime(),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
  }, [filter, monthOffset, page]);

  async function handleDelete(e: React.MouseEvent, trip: Trip) {
    e.stopPropagation();
    if (!confirm(`Fahrt vom ${formatDate(trip.start_time)} löschen?`)) return;
    await deleteTrip(trip.id);
    loadTrips({ category: filter === 'all' ? undefined : filter, limit: PAGE_SIZE });
  }

  const monthLabel = targetMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  function handleCreated() {
    setShowAddModal(false);
    loadTrips({
      category: filter === 'all' ? undefined : filter,
      from: targetMonth.getTime(),
      to: nextMonth.getTime(),
      limit: PAGE_SIZE,
      offset: 0,
    });
    setPage(0);
  }

  return (
    <div>
      {showAddModal && (
        <AddTripModal onClose={() => setShowAddModal(false)} onCreated={handleCreated} />
      )}
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>Fahrtenbuch</h1>
            <p>{totalTrips} Fahrten gesamt</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              + Fahrt
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => api.exportCsv()}>
              ⬇ CSV
            </button>
          </div>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex-between mb-md glass-sm" style={{ padding: '10px 16px', borderRadius: 'var(--r-full)' }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setMonthOffset(o => o + 1); setPage(0); }}>
          ←
        </button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{monthLabel}</span>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => { setMonthOffset(o => Math.max(0, o - 1)); setPage(0); }}
          disabled={monthOffset === 0}
        >
          →
        </button>
      </div>

      {/* Category filter */}
      <div className="toggle-group mb-md">
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

      {/* Trip list */}
      {trips.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">🗓️</div>
            <h3>Keine Fahrten</h3>
            <p>In diesem Monat wurden keine {filter !== 'all' ? categoryLabel(filter) + 'en' : ''} Fahrten aufgezeichnet.</p>
          </div>
        </div>
      ) : (
        <div className="glass" style={{ padding: 0 }}>
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="trip-item"
              onClick={() => setView('detail', trip.id)}
              style={{ position: 'relative' }}
            >
              <div className={`trip-item-icon ${trip.category}`}>
                {trip.category === 'business' ? '💼' : trip.category === 'private' ? '🏠' : '❓'}
              </div>
              <div className="trip-item-info">
                <div className="trip-item-route">
                  {trip.start_address
                    ? `${trip.start_address.split(',')[0]}${trip.end_address ? ` → ${trip.end_address.split(',')[0]}` : ''}`
                    : `Fahrt am ${formatDate(trip.start_time)}`}
                </div>
                <div className="trip-item-meta">
                  {formatDate(trip.start_time)}, {formatTime(trip.start_time)}
                  {trip.end_time && ` – ${formatTime(trip.end_time)}`}
                  {' · '}<span className={`badge badge-${trip.category}`}>{categoryLabel(trip.category)}</span>
                </div>
                {trip.traffic_delay_seconds && trip.traffic_delay_seconds > 120 && (
                  <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 2 }}>
                    🚦 +{formatDuration(trip.traffic_delay_seconds)} Stau
                  </div>
                )}
              </div>
              <div className="trip-item-stats">
                {trip.distance_km != null && <div className="trip-item-km">{formatKm(trip.distance_km)}</div>}
                {trip.duration_seconds != null && <div className="trip-item-time">{formatDuration(trip.duration_seconds)}</div>}
                <button
                  style={{ marginTop: 4, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={(e) => handleDelete(e, trip)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalTrips > PAGE_SIZE && (
        <div className="flex-center gap-sm mt-md">
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            ← Zurück
          </button>
          <span className="text-secondary" style={{ fontSize: 14 }}>
            Seite {page + 1} von {Math.ceil(totalTrips / PAGE_SIZE)}
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
