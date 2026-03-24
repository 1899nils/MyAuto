import { useEffect, useState } from 'react';
import { useFuelStore } from '../../store/fuelStore';
import type { FuelEntry } from '../../types';

type ComputedField = 'liters' | 'pricePerLiter' | 'totalCost';

function toLocalDateString(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toInputDate(ts: number) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

const emptyForm = () => ({
  date: toInputDate(Date.now()),
  liters: '',
  pricePerLiter: '',
  totalCost: '',
  odometer: '',
  notes: '',
  computed: 'totalCost' as ComputedField,
});

export function Spritmonitor() {
  const { entries, stats, loadEntries, loadStats, addEntry, updateEntry, deleteEntry } = useFuelStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadEntries(year);
    loadStats();
  }, [year]);

  // Bidirectional calculation
  function handleFieldChange(field: 'liters' | 'pricePerLiter' | 'totalCost', value: string) {
    const updated = { ...form, [field]: value };
    const l = parseFloat(updated.liters);
    const p = parseFloat(updated.pricePerLiter);
    const t = parseFloat(updated.totalCost);

    // Compute the "other" field based on which two are filled
    if (field !== 'totalCost' && !isNaN(l) && !isNaN(p)) {
      updated.totalCost = (l * p).toFixed(2);
      updated.computed = 'totalCost';
    } else if (field === 'totalCost' && !isNaN(t) && !isNaN(l) && l > 0) {
      updated.pricePerLiter = (t / l).toFixed(3);
      updated.computed = 'pricePerLiter';
    } else if (field === 'totalCost' && !isNaN(t) && !isNaN(p) && p > 0) {
      updated.liters = (t / p).toFixed(2);
      updated.computed = 'liters';
    }

    setForm(updated);
  }

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(entry: FuelEntry) {
    setForm({
      date: toInputDate(entry.date),
      liters: String(entry.liters),
      pricePerLiter: String(entry.price_per_liter),
      totalCost: String(entry.total_cost),
      odometer: entry.odometer_km != null ? String(entry.odometer_km) : '',
      notes: entry.notes ?? '',
      computed: 'totalCost',
    });
    setEditId(entry.id);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const l = parseFloat(form.liters);
    const p = parseFloat(form.pricePerLiter);
    const t = parseFloat(form.totalCost);
    if (isNaN(l) || isNaN(p) || isNaN(t)) return;

    setSaving(true);
    const payload = {
      date: new Date(form.date).getTime(),
      liters: l,
      price_per_liter: p,
      total_cost: t,
      odometer_km: form.odometer ? parseFloat(form.odometer) : null,
      notes: form.notes || null,
    };

    if (editId != null) {
      await updateEntry(editId, payload);
    } else {
      await addEntry(payload);
    }
    await loadEntries(year);
    await loadStats();
    setSaving(false);
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteEntry(id);
    await loadEntries(year);
    await loadStats();
    setDeleteConfirm(null);
  }

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const fmtL = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';

  return (
    <div className="sprit-view">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">⛽ Spritmonitor</h1>
          <p className="page-subtitle">Tankverlauf & Kosten</p>
        </div>
        <div className="year-nav">
          <button className="btn btn-ghost btn-icon" onClick={() => setYear(y => y - 1)}>‹</button>
          <span className="year-label">{year}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => setYear(y => y + 1)}>›</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="glass-sm stat-card">
            <div className="stat-value text-accent">{stats.fillCount}</div>
            <div className="stat-label">Tankstopps</div>
          </div>
          <div className="glass-sm stat-card">
            <div className="stat-value">{fmtEur(stats.totalCost)}</div>
            <div className="stat-label">Gesamtkosten</div>
          </div>
          <div className="glass-sm stat-card">
            <div className="stat-value">{fmtL(stats.totalLiters)}</div>
            <div className="stat-label">Gesamt Liter</div>
          </div>
        </div>
      )}
      {stats && (
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="glass-sm stat-card">
            <div className="stat-value">
              {stats.avgPrice > 0
                ? stats.avgPrice.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €'
                : '–'}
            </div>
            <div className="stat-label">Ø Preis/L</div>
          </div>
          <div className="glass-sm stat-card">
            <div className="stat-value">
              {stats.avgConsumption != null
                ? stats.avgConsumption.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L'
                : '–'}
            </div>
            <div className="stat-label">Ø l/100km</div>
          </div>
          <div className="glass-sm stat-card">
            <div className="stat-value">
              {stats.costPerKm != null
                ? stats.costPerKm.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                : '–'}
            </div>
            <div className="stat-label">Kosten/km</div>
          </div>
        </div>
      )}

      {/* Add button */}
      <button className="btn btn-primary btn-full" onClick={openAdd} style={{ marginBottom: 'var(--sp-md)' }}>
        + Tanken erfassen
      </button>

      {/* Inline Form */}
      {showForm && (
        <div className="glass fuel-form">
          <h3 className="fuel-form-title">{editId != null ? 'Eintrag bearbeiten' : 'Neuer Tankstopp'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Datum</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>

            {/* Bidirectional fields */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">
                  Liter {form.computed === 'liters' && <span className="computed-badge">⟵ berechnet</span>}
                </label>
                <input
                  type="number"
                  className={`form-input ${form.computed === 'liters' ? 'computed-input' : ''}`}
                  placeholder="z.B. 42.50"
                  step="0.01"
                  value={form.liters}
                  onChange={e => handleFieldChange('liters', e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">
                  Preis/L €  {form.computed === 'pricePerLiter' && <span className="computed-badge">⟵ berechnet</span>}
                </label>
                <input
                  type="number"
                  className={`form-input ${form.computed === 'pricePerLiter' ? 'computed-input' : ''}`}
                  placeholder="z.B. 1.789"
                  step="0.001"
                  value={form.pricePerLiter}
                  onChange={e => handleFieldChange('pricePerLiter', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Gesamt €  {form.computed === 'totalCost' && <span className="computed-badge">⟵ berechnet</span>}
              </label>
              <input
                type="number"
                className={`form-input fuel-total-input ${form.computed === 'totalCost' ? 'computed-input' : ''}`}
                placeholder="z.B. 76.00"
                step="0.01"
                value={form.totalCost}
                onChange={e => handleFieldChange('totalCost', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kilometerstand (optional)</label>
              <input
                type="number"
                className="form-input"
                placeholder="z.B. 85420"
                step="1"
                value={form.odometer}
                onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notiz (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Tankstelle A1"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>
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
      <div className="fuel-list">
        {entries.length === 0 && !showForm && (
          <div className="empty-state">
            <div style={{ fontSize: 48 }}>⛽</div>
            <h3>Keine Einträge</h3>
            <p>Erfasse deinen ersten Tankstopp</p>
          </div>
        )}
        {entries.map((entry, idx) => {
          // Compute consumption vs previous entry (entries are desc, so next index = previous date)
          const prev = entries[idx + 1];
          let consumption: number | null = null;
          if (prev && prev.odometer_km != null && entry.odometer_km != null) {
            const km = entry.odometer_km - prev.odometer_km;
            if (km > 0) consumption = (entry.liters / km) * 100;
          }

          return (
            <div key={entry.id} className="glass-sm fuel-item">
              <div className="fuel-item-left">
                <div className="fuel-item-icon">⛽</div>
                <div className="fuel-item-info">
                  <div className="fuel-item-date">{toLocalDateString(entry.date)}</div>
                  <div className="fuel-item-meta">
                    {entry.liters.toLocaleString('de-DE', { minimumFractionDigits: 2 })} L
                    {' · '}
                    {entry.price_per_liter.toLocaleString('de-DE', { minimumFractionDigits: 3 })} €/L
                    {consumption != null && (
                      <> · <span style={{ color: 'var(--text-accent)' }}>
                        {consumption.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} l/100km
                      </span></>
                    )}
                  </div>
                  {entry.notes && <div className="fuel-item-notes">{entry.notes}</div>}
                </div>
              </div>
              <div className="fuel-item-right">
                <div className="fuel-item-cost">{fmtEur(entry.total_cost)}</div>
                {entry.odometer_km != null && (
                  <div className="fuel-item-odo">{entry.odometer_km.toLocaleString('de-DE')} km</div>
                )}
                <div className="fuel-item-actions">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(entry)}>✏️</button>
                  {deleteConfirm === entry.id ? (
                    <>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id)}>Löschen</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>✕</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDeleteConfirm(entry.id)}>🗑️</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
