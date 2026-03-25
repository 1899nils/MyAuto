import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { MaintenanceEntryRaw } from '../../types';

type MaintenanceType = 'oil_change' | 'tuev' | 'tires' | 'brakes' | 'service' | 'other';

const TYPE_ICONS: Record<MaintenanceType, string> = {
  oil_change: '🔧',
  tuev:       '🔍',
  tires:      '🔄',
  brakes:     '🛑',
  service:    '⚙️',
  other:      '📝',
};

const TYPE_LABELS: Record<MaintenanceType, string> = {
  oil_change: 'Ölwechsel',
  tuev:       'TÜV / HU',
  tires:      'Reifenwechsel',
  brakes:     'Bremsen',
  service:    'Inspektion',
  other:      'Sonstiges',
};

const TYPE_OPTIONS: MaintenanceType[] = ['oil_change', 'tuev', 'tires', 'brakes', 'service', 'other'];

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toInputDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

function daysUntil(ts: number): number {
  const now = Date.now();
  return Math.round((ts - now) / (1000 * 60 * 60 * 24));
}

function urgencyClass(entry: MaintenanceEntryRaw): '' | 'wartung-due' | 'wartung-overdue' {
  if (entry.next_date == null) return '';
  const days = daysUntil(entry.next_date);
  if (days < 0) return 'wartung-overdue';
  if (days <= 30) return 'wartung-due';
  return '';
}

const emptyForm = () => ({
  title: '',
  type: 'service' as MaintenanceType,
  date: toInputDate(Date.now()),
  odometer: '',
  cost: '',
  workshop: '',
  notes: '',
  next_date: '',
  next_odometer: '',
});

export function Wartung() {
  const [entries, setEntries] = useState<MaintenanceEntryRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.getMaintenanceEntries();
      setEntries(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function openEdit(entry: MaintenanceEntryRaw) {
    setForm({
      title: entry.title,
      type: entry.type,
      date: entry.date != null ? toInputDate(entry.date) : '',
      odometer: entry.odometer_km != null ? String(entry.odometer_km) : '',
      cost: entry.cost != null ? String(entry.cost) : '',
      workshop: entry.workshop ?? '',
      notes: entry.notes ?? '',
      next_date: entry.next_date != null ? toInputDate(entry.next_date) : '',
      next_odometer: entry.next_odometer_km != null ? String(entry.next_odometer_km) : '',
    });
    setEditId(entry.id);
    setShowForm(true);
    setError('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Titel ist erforderlich'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        date: form.date ? parseDateLocal(form.date) : null,
        odometer_km: form.odometer ? parseFloat(form.odometer) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        workshop: form.workshop.trim() || null,
        notes: form.notes.trim() || null,
        next_date: form.next_date ? parseDateLocal(form.next_date) : null,
        next_odometer_km: form.next_odometer ? parseFloat(form.next_odometer) : null,
      };
      if (editId != null) {
        await api.updateMaintenanceEntry(editId, payload);
      } else {
        await api.createMaintenanceEntry(payload);
      }
      await load();
      setShowForm(false);
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteMaintenanceEntry(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen');
    } finally {
      setDeleteConfirm(null);
    }
  }

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  return (
    <div className="wartung-view">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🔧 Wartungsplan</h1>
          <p className="page-subtitle">Serviceheft & Wartungshistorie</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Wartung hinzufügen</button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="glass wartung-error">{error}</div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="glass inline-form">
          <h3 className="inline-form-title">
            {editId != null ? 'Eintrag bearbeiten' : 'Neue Wartung'}
          </h3>
          <form onSubmit={handleSave}>
            {/* Title + Type row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Bezeichnung *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. Ölwechsel 10W-40"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Typ</label>
                <select
                  className="form-input"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as MaintenanceType }))}
                >
                  {TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date + Odometer row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Datum (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kilometerstand (optional)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="85420"
                  step="1"
                  min="0"
                  value={form.odometer}
                  onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
                />
              </div>
            </div>

            {/* Cost + Workshop row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kosten € (optional)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="149.90"
                  step="0.01"
                  min="0"
                  value={form.cost}
                  onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Werkstatt (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. AutoService Müller"
                  value={form.workshop}
                  onChange={e => setForm(f => ({ ...f, workshop: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notizen (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Nächstes Mal Luftfilter auch wechseln"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Next service */}
            <div className="wartung-next-section">
              <div className="wartung-next-label">Nächste Wartung fällig</div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Datum (optional)</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.next_date}
                    onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Kilometerstand (optional)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="95000"
                    step="1"
                    min="0"
                    value={form.next_odometer}
                    onChange={e => setForm(f => ({ ...f, next_odometer: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '…' : editId != null ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Entry list */}
      {loading ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Lade Einträge…</h3>
          </div>
        </div>
      ) : entries.length === 0 && !showForm ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">🔧</div>
            <h3>Keine Wartungseinträge</h3>
            <p>Füge deinen ersten Eintrag hinzu</p>
          </div>
        </div>
      ) : (
        <div className="wartung-list">
          {entries.map(entry => {
            const uClass = urgencyClass(entry);
            const typeKey = entry.type as MaintenanceType;
            const days = entry.next_date != null ? daysUntil(entry.next_date) : null;

            return (
              <div key={entry.id} className={`glass wartung-card ${uClass}`}>
                {/* Card header */}
                <div className="wartung-card-header">
                  <div className="wartung-type-icon">{TYPE_ICONS[typeKey] ?? '📝'}</div>
                  <div className="wartung-card-body">
                    <div className="wartung-card-title">{entry.title}</div>
                    <div className="wartung-card-meta">
                      <span className="wartung-type-badge">{TYPE_LABELS[typeKey] ?? entry.type}</span>
                      {entry.date != null && (
                        <span className="wartung-meta-item">📅 {fmtDate(entry.date)}</span>
                      )}
                      {entry.odometer_km != null && (
                        <span className="wartung-meta-item">🛣️ {entry.odometer_km.toLocaleString('de-DE')} km</span>
                      )}
                      {entry.workshop && (
                        <span className="wartung-meta-item">🏪 {entry.workshop}</span>
                      )}
                      {entry.cost != null && (
                        <span className="wartung-meta-item text-accent">{fmtEur(entry.cost)}</span>
                      )}
                    </div>
                    {entry.notes && (
                      <div className="wartung-card-notes">{entry.notes}</div>
                    )}
                  </div>
                  <div className="wartung-card-actions">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => openEdit(entry)}
                      title="Bearbeiten"
                    >✏️</button>
                    {deleteConfirm === entry.id ? (
                      <>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id)}>Löschen</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>✕</button>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setDeleteConfirm(entry.id)}
                        title="Löschen"
                      >🗑️</button>
                    )}
                  </div>
                </div>

                {/* Next service info */}
                {(entry.next_date != null || entry.next_odometer_km != null) && (
                  <div className={`wartung-next-info ${uClass}`}>
                    <span className="wartung-next-title">Nächste Wartung:</span>
                    {entry.next_date != null && (
                      <span className="wartung-next-date">
                        {fmtDate(entry.next_date)}
                        {days != null && (
                          <span className={`wartung-days-badge ${days < 0 ? 'overdue' : days <= 30 ? 'due' : 'ok'}`}>
                            {days < 0
                              ? `${Math.abs(days)} Tage überfällig`
                              : days === 0
                              ? 'Heute fällig'
                              : `in ${days} Tagen`}
                          </span>
                        )}
                      </span>
                    )}
                    {entry.next_odometer_km != null && (
                      <span className="wartung-next-odo">
                        bei {entry.next_odometer_km.toLocaleString('de-DE')} km
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
