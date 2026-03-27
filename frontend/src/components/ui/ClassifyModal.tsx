import { useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { TripCategory } from '../../types';
import { formatDate, formatDuration, formatKm } from '../../utils/format';
import { resolveAddress } from '../../utils/addressUtils';

export function ClassifyModal() {
  const { classifyModalTrip, setClassifyModal, updateTrip, settings } = useTripStore();
  const [saving, setSaving] = useState(false);

  if (!classifyModalTrip) return null;
  const trip = classifyModalTrip;

  async function choose(category: TripCategory) {
    setSaving(true);
    try {
      await updateTrip(trip.id, { category });
    } finally {
      setSaving(false);
      setClassifyModal(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setClassifyModal(null)}>
      <div className="modal glass-strong" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🚗</div>
          <h2>Fahrt klassifizieren</h2>
          <p>
            {formatDate(trip.start_time)} &bull;{' '}
            {trip.distance_km ? formatKm(trip.distance_km) : '—'} &bull;{' '}
            {trip.duration_seconds ? formatDuration(trip.duration_seconds) : '—'}
          </p>
          {trip.end_address && (
            <p style={{ fontSize: 14, marginTop: -8 }}>
              → {resolveAddress(trip.end_address, settings?.addressAliases)}
            </p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
          <button
            className="btn btn-ghost btn-full"
            style={{ flexDirection: 'column', gap: 6, padding: 20 }}
            onClick={() => choose('private')}
            disabled={saving}
          >
            <span style={{ fontSize: 32 }}>🏠</span>
            <span>Privat</span>
          </button>
          <button
            className="btn btn-primary btn-full"
            style={{ flexDirection: 'column', gap: 6, padding: 20 }}
            onClick={() => choose('business')}
            disabled={saving}
          >
            <span style={{ fontSize: 32 }}>💼</span>
            <span>Beruflich</span>
          </button>
        </div>

        <button
          className="btn btn-ghost btn-full mt-md"
          onClick={() => setClassifyModal(null)}
          disabled={saving}
        >
          Später klassifizieren
        </button>
      </div>
    </div>
  );
}
