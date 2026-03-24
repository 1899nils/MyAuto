import { useState, useEffect } from 'react';
import { useTripStore } from '../../store/tripStore';
import { TripCategory } from '../../types';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): number {
  return new Date(val).getTime();
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function AddTripModal({ onClose, onCreated }: Props) {
  const { addManualTrip } = useTripStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const now = Date.now();
  const oneHourAgo = now - 3600_000;

  const [startVal, setStartVal] = useState(toDatetimeLocal(oneHourAgo));
  const [endVal, setEndVal] = useState(toDatetimeLocal(now));
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [category, setCategory] = useState<TripCategory>('unclassified');
  const [notes, setNotes] = useState('');

  const startTs = fromDatetimeLocal(startVal);
  const endTs = fromDatetimeLocal(endVal);
  const durationSecs = endTs > startTs ? Math.round((endTs - startTs) / 1000) : 0;
  const valid = endTs > startTs;

  useEffect(() => {
    if (!valid) setError('Endzeit muss nach Startzeit liegen');
    else setError('');
  }, [valid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await addManualTrip({
        startTime: startTs,
        endTime: endTs,
        startAddress: startAddress.trim() || undefined,
        endAddress: endAddress.trim() || undefined,
        distanceKm: distanceKm ? parseFloat(distanceKm) : undefined,
        durationSeconds: durationSecs,
        category,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-strong add-trip-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✏️</div>
          <h2>Fahrt manuell hinzufügen</h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Zeit */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Startzeit</label>
              <input
                type="datetime-local"
                className="form-input"
                value={startVal}
                onChange={(e) => setStartVal(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Endzeit</label>
              <input
                type="datetime-local"
                className="form-input"
                value={endVal}
                onChange={(e) => setEndVal(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Dauer Anzeige */}
          {valid && durationSecs > 0 && (
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--sp-sm)', textAlign: 'center' }}>
              Dauer: {formatDuration(durationSecs)}
            </p>
          )}

          {/* Adressen */}
          <div className="form-group">
            <label className="form-label">Startadresse</label>
            <input
              type="text"
              className="form-input"
              placeholder="z.B. Musterstraße 1, Berlin"
              value={startAddress}
              onChange={(e) => setStartAddress(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Zieladresse</label>
            <input
              type="text"
              className="form-input"
              placeholder="z.B. Hauptstraße 5, München"
              value={endAddress}
              onChange={(e) => setEndAddress(e.target.value)}
            />
          </div>

          {/* Distanz */}
          <div className="form-group">
            <label className="form-label">Distanz (km)</label>
            <input
              type="number"
              className="form-input"
              placeholder="z.B. 42.5"
              min="0"
              step="0.1"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
            />
          </div>

          {/* Kategorie */}
          <div className="form-group">
            <label className="form-label">Kategorie</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-xs)' }}>
              {([
                { value: 'private', label: '🏠 Privat' },
                { value: 'business', label: '💼 Beruflich' },
                { value: 'unclassified', label: '❓ Offen' },
              ] as { value: TripCategory; label: string }[]).map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`btn btn-sm ${category === c.value ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notizen */}
          <div className="form-group">
            <label className="form-label">Notizen</label>
            <textarea
              className="form-input"
              placeholder="Optionale Notiz..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 'var(--sp-sm)' }}>{error}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)', marginTop: 'var(--sp-sm)' }}>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary btn-full" disabled={saving || !valid}>
              {saving ? '⏳ Speichern…' : '✓ Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
