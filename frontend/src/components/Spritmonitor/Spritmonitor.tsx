import { useEffect, useState } from 'react';
import { useFuelStore } from '../../store/fuelStore';
import { api } from '../../api/client';
import type { FuelEntry, FuelType, Vehicle } from '../../types';
import { FUEL_TYPE_LABELS } from '../../types';

type ComputedField = 'liters' | 'pricePerLiter' | 'totalCost';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Parse YYYY-MM-DD as local date (avoids UTC-offset day-shift bug) */
function parseDateLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

function toInputDate(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const emptyForm = (vehicleId?: number) => ({
  date: toInputDate(Date.now()),
  liters: '',
  pricePerLiter: '',
  totalCost: '',
  odometer: '',
  notes: '',
  computed: 'totalCost' as ComputedField,
  vehicleId: vehicleId ?? undefined as number | undefined,
  fuelType: 'super' as FuelType,
});

export function Spritmonitor() {
  const { entries, stats, loadEntries, loadStats, addEntry, updateEntry, deleteEntry } = useFuelStore();

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based
  const [vehicleFilter, setVehicleFilter] = useState<number | undefined>(undefined);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [showForm, setShowForm]         = useState(false);
  const [editId, setEditId]             = useState<number | null>(null);
  const [form, setForm]                 = useState(emptyForm());
  const [saving, setSaving]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    api.getVehicles().then(r => setVehicles(r.vehicles)).catch(() => {});
  }, []);

  useEffect(() => {
    loadEntries(year, month, vehicleFilter);
    loadStats(year);
  }, [year, month, vehicleFilter]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Bidirectional calculation
  function handleFieldChange(field: 'liters' | 'pricePerLiter' | 'totalCost', value: string) {
    const updated = { ...form, [field]: value };
    const l = parseFloat(updated.liters);
    const p = parseFloat(updated.pricePerLiter);
    const t = parseFloat(updated.totalCost);

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
    setForm(emptyForm(vehicleFilter));
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
      vehicleId: entry.vehicle_id ?? undefined,
      fuelType: (entry.fuel_type as FuelType) ?? 'super',
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
      date: parseDateLocal(form.date),
      liters: l,
      price_per_liter: p,
      total_cost: t,
      odometer_km: form.odometer ? parseFloat(form.odometer) : null,
      notes: form.notes || null,
      vehicle_id: form.vehicleId ?? null,
      fuel_type: form.fuelType,
    };

    if (editId != null) {
      await updateEntry(editId, payload);
    } else {
      await addEntry(payload);
      // Navigate to the month of the newly saved entry
      const saved = new Date(payload.date);
      setYear(saved.getFullYear());
      setMonth(saved.getMonth() + 1);
    }
    await loadEntries(year, month);
    await loadStats(year);
    setSaving(false);
    setShowForm(false);
    setEditId(null);
  }

  async function handleDelete(id: number) {
    await deleteEntry(id);
    await loadEntries(year, month);
    await loadStats(year);
    setDeleteConfirm(null);
  }

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const monthTotal = entries.reduce((s, e) => s + e.total_cost, 0);
  const monthLiters = entries.reduce((s, e) => s + e.liters, 0);

  return (
    <div className="sprit-view">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">⛽ Spritmonitor</h1>
          <p className="page-subtitle">Tankverlauf & Kosten</p>
        </div>
        <div className="page-actions">
          {vehicles.length > 0 && (
            <select
              className="form-input"
              style={{ width: 'auto', fontSize: 13 }}
              value={vehicleFilter ?? ''}
              onChange={e => setVehicleFilter(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">🚗 Alle Fahrzeuge</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name as string}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Tanken</button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="period-nav">
        <button className="btn btn-ghost btn-icon" onClick={prevMonth}>‹</button>
        <div className="period-nav-label">
          <span className="period-month">{MONTH_NAMES[month - 1]}</span>
          <span className="period-year">{year}</span>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={nextMonth}>›</button>
      </div>

      {/* Monthly summary bar */}
      {entries.length > 0 && (
        <div className="glass-sm month-summary">
          <div className="month-summary-item">
            <span className="month-summary-value">{entries.length}</span>
            <span className="month-summary-label">Stops</span>
          </div>
          <div className="month-summary-divider" />
          <div className="month-summary-item">
            <span className="month-summary-value">
              {monthLiters.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
            </span>
            <span className="month-summary-label">Getankt</span>
          </div>
          <div className="month-summary-divider" />
          <div className="month-summary-item">
            <span className="month-summary-value text-accent">{fmtEur(monthTotal)}</span>
            <span className="month-summary-label">Kosten</span>
          </div>
        </div>
      )}

      {/* Yearly stats (collapsible section) */}
      {stats && stats.fillCount > 0 && (
        <details className="glass yearly-stats">
          <summary className="yearly-stats-title">
            Jahresübersicht {year}
          </summary>
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 'var(--sp-sm)' }}>
            <div className="stat-card-mini">
              <div className="stat-value-sm text-accent">{stats.fillCount}</div>
              <div className="stat-label-sm">Tankstopps</div>
            </div>
            <div className="stat-card-mini">
              <div className="stat-value-sm">{fmtEur(stats.totalCost)}</div>
              <div className="stat-label-sm">Gesamtkosten</div>
            </div>
            <div className="stat-card-mini">
              <div className="stat-value-sm">
                {stats.totalLiters.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
              </div>
              <div className="stat-label-sm">Gesamt Liter</div>
            </div>
          </div>
          <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 'var(--sp-sm)' }}>
            <div className="stat-card-mini">
              <div className="stat-value-sm">
                {stats.avgPrice > 0
                  ? stats.avgPrice.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €'
                  : '–'}
              </div>
              <div className="stat-label-sm">Ø Preis/L</div>
            </div>
            <div className="stat-card-mini">
              <div className="stat-value-sm">
                {stats.avgConsumption != null
                  ? stats.avgConsumption.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L'
                  : '–'}
              </div>
              <div className="stat-label-sm">Ø l/100km</div>
            </div>
            <div className="stat-card-mini">
              <div className="stat-value-sm">
                {stats.costPerKm != null
                  ? stats.costPerKm.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                  : '–'}
              </div>
              <div className="stat-label-sm">Kosten/km</div>
            </div>
          </div>
        </details>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="glass inline-form">
          <h3 className="inline-form-title">{editId != null ? 'Eintrag bearbeiten' : 'Neuer Tankstopp'}</h3>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Datum</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              {vehicles.length > 0 && (
                <div className="form-group" style={{ flex: 1 }}>
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
            </div>

            {/* Fuel type */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kraftstoff</label>
                <select
                  className="form-input"
                  value={form.fuelType}
                  onChange={e => setForm(f => ({ ...f, fuelType: e.target.value as FuelType }))}
                >
                  {(Object.keys(FUEL_TYPE_LABELS) as FuelType[]).map(k => (
                    <option key={k} value={k}>{FUEL_TYPE_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bidirectional calculation row */}
            <div className="fuel-calc-grid">
              <div className="form-group">
                <label className="form-label">
                  Liter{form.computed === 'liters' && <span className="computed-badge"> ⟵ berechnet</span>}
                </label>
                <input
                  type="number"
                  className={`form-input${form.computed === 'liters' ? ' computed-input' : ''}`}
                  placeholder="42.50"
                  step="0.01"
                  min="0"
                  value={form.liters}
                  onChange={e => handleFieldChange('liters', e.target.value)}
                  required
                />
              </div>
              <div className="fuel-calc-op">×</div>
              <div className="form-group">
                <label className="form-label">
                  Preis/L €{form.computed === 'pricePerLiter' && <span className="computed-badge"> ⟵</span>}
                </label>
                <input
                  type="number"
                  className={`form-input${form.computed === 'pricePerLiter' ? ' computed-input' : ''}`}
                  placeholder="1.789"
                  step="0.001"
                  min="0"
                  value={form.pricePerLiter}
                  onChange={e => handleFieldChange('pricePerLiter', e.target.value)}
                  required
                />
              </div>
              <div className="fuel-calc-op">=</div>
              <div className="form-group">
                <label className="form-label">
                  Gesamt €{form.computed === 'totalCost' && <span className="computed-badge"> ⟵</span>}
                </label>
                <input
                  type="number"
                  className={`form-input fuel-total-input${form.computed === 'totalCost' ? ' computed-input' : ''}`}
                  placeholder="76.00"
                  step="0.01"
                  min="0"
                  value={form.totalCost}
                  onChange={e => handleFieldChange('totalCost', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-row">
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
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Notiz (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. Tankstelle A1"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
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
      {entries.length === 0 && !showForm ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">⛽</div>
            <h3>Keine Einträge</h3>
            <p>{MONTH_NAMES[month - 1]} {year} – noch nichts erfasst</p>
          </div>
        </div>
      ) : (
        <div className="glass list-card">
          {entries.map((entry, idx) => {
            const prev = entries[idx + 1];
            let consumption: number | null = null;
            if (prev && prev.odometer_km != null && entry.odometer_km != null) {
              const km = entry.odometer_km - prev.odometer_km;
              if (km > 0) consumption = (entry.liters / km) * 100;
            }

            return (
              <div key={entry.id} className="list-item">
                <div className="list-item-icon-box fuel">{entry.fuel_type === 'electric' ? '🔋' : '⛽'}</div>
                <div className="list-item-body">
                  <div className="list-item-title">
                    {fmtDate(entry.date)}
                    {entry.fuel_type && entry.fuel_type !== 'super' && (
                      <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                        {FUEL_TYPE_LABELS[entry.fuel_type as FuelType] ?? entry.fuel_type}
                      </span>
                    )}
                  </div>
                  <div className="list-item-sub">
                    {entry.liters.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {entry.fuel_type === 'electric' ? 'kWh' : 'L'}
                    {' · '}
                    {entry.price_per_liter.toLocaleString('de-DE', { minimumFractionDigits: 3 })} €/L
                    {consumption != null && (
                      <> · <span className="text-accent">
                        {consumption.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} l/100km
                      </span></>
                    )}
                  </div>
                  {(entry.notes || entry.odometer_km != null || entry.vehicle_name) && (
                    <div className="list-item-tag">
                      {entry.vehicle_name && <span>🚗 {entry.vehicle_name}</span>}
                      {entry.vehicle_name && (entry.odometer_km != null || entry.notes) && ' · '}
                      {entry.odometer_km != null && `${entry.odometer_km.toLocaleString('de-DE')} km`}
                      {entry.odometer_km != null && entry.notes && ' · '}
                      {entry.notes}
                    </div>
                  )}
                </div>
                <div className="list-item-end">
                  <div className="list-item-value">{fmtEur(entry.total_cost)}</div>
                  <div className="list-item-actions">
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
      )}
    </div>
  );
}
