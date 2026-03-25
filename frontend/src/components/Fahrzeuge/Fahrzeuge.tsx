import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Vehicle, MaintenanceEntryRaw } from '../../types';

// ── helpers ──────────────────────────────────────────────────────────────────

const FUEL_LABELS: Record<string, string> = {
  gasoline: '⛽ Benzin', diesel: '🛢 Diesel', electric: '⚡ Elektro',
  hybrid: '🔋 Hybrid', lpg: '🔵 Autogas',
};

const MAINT_TYPES: { value: string; label: string }[] = [
  { value: 'oil_change', label: '🔧 Ölwechsel' },
  { value: 'tuev',       label: '🔍 TÜV/HU'    },
  { value: 'tires',      label: '🔄 Reifenwechsel' },
  { value: 'brakes',     label: '🛑 Bremsen'    },
  { value: 'service',    label: '⚙️ Inspektion'  },
  { value: 'other',      label: '📝 Sonstiges'  },
];

function toDateInput(ts: number | null | undefined): string {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}
function fromDateInput(v: string): number | null {
  if (!v) return null;
  return new Date(v).getTime();
}

function MaintBadge({ entry, now }: { entry: MaintenanceEntryRaw; now: number }) {
  if (!entry.next_date) return null;
  const overdue = entry.next_date < now;
  const soon    = entry.next_date < now + 30 * 24 * 60 * 60 * 1000;
  const color   = overdue ? 'var(--red)' : soon ? 'var(--orange)' : 'var(--text-secondary)';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {overdue ? '⚠️ überfällig' : soon ? '🔔 bald fällig' : '✓'}
    </span>
  );
}

// ── empty form factories ──────────────────────────────────────────────────────

function emptyVehicleForm() {
  return {
    name: '', make: '', model: '', year: '',
    color: '', license_plate: '', vin: '',
    fuel_type: 'gasoline', tank_capacity_liters: '',
    insurance_company: '', insurance_number: '',
    notes: '', odometer_km: '',
  };
}

function emptyMaintForm(vehicleId: number) {
  return {
    vehicleId,
    title: '', type: 'service',
    date: toDateInput(Date.now()),
    odometer_km: '', cost: '', workshop: '', notes: '',
    next_date: '', next_odometer_km: '',
  };
}

// ── MaintenanceList ───────────────────────────────────────────────────────────

function MaintenanceList({ vehicle, now }: { vehicle: Vehicle; now: number }) {
  const [entries, setEntries] = useState<MaintenanceEntryRaw[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MaintenanceEntryRaw | null>(null);
  const [form, setForm] = useState(emptyMaintForm(vehicle.id));
  const [delConfirm, setDelConfirm] = useState<number | null>(null);

  useEffect(() => {
    api.getMaintenanceByVehicle(vehicle.id).then(r => setEntries(r.entries));
  }, [vehicle.id]);

  function openAdd() {
    setEditing(null);
    setForm(emptyMaintForm(vehicle.id));
    setShowForm(true);
  }
  function openEdit(e: MaintenanceEntryRaw) {
    setEditing(e);
    setForm({
      vehicleId: vehicle.id,
      title: e.title, type: e.type,
      date: toDateInput(e.date),
      odometer_km: e.odometer_km != null ? String(e.odometer_km) : '',
      cost: e.cost != null ? String(e.cost) : '',
      workshop: e.workshop ?? '',
      notes: e.notes ?? '',
      next_date: toDateInput(e.next_date),
      next_odometer_km: e.next_odometer_km != null ? String(e.next_odometer_km) : '',
    });
    setShowForm(true);
  }

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault();
    const payload = {
      title: form.title, type: form.type,
      date: fromDateInput(form.date),
      odometer_km: form.odometer_km ? parseFloat(form.odometer_km) : null,
      cost: form.cost ? parseFloat(form.cost) : null,
      workshop: form.workshop || null,
      notes: form.notes || null,
      next_date: fromDateInput(form.next_date),
      next_odometer_km: form.next_odometer_km ? parseFloat(form.next_odometer_km) : null,
      vehicle_id: vehicle.id,
    };
    if (editing) {
      await api.updateMaintenanceEntry(editing.id, payload);
    } else {
      await api.createMaintenanceEntry(payload);
    }
    setShowForm(false);
    api.getMaintenanceByVehicle(vehicle.id).then(r => setEntries(r.entries));
  }

  async function handleDelete(id: number) {
    await api.deleteMaintenanceEntry(id);
    setDelConfirm(null);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div style={{ marginTop: 'var(--sp-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          🔧 Wartungshistorie ({entries.length})
        </span>
        <button className="btn btn-ghost btn-sm" onClick={openAdd}>+ Eintrag</button>
      </div>

      {showForm && (
        <form className="glass" style={{ padding: 'var(--sp-md)', marginBottom: 'var(--sp-sm)' }} onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Bezeichnung *</label>
              <input className="form-input" required value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Ölwechsel bei ADAC" />
            </div>
            <div className="form-group">
              <label className="form-label">Typ</label>
              <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {MAINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Datum</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Kilometerstand</label>
              <input type="number" className="form-input" placeholder="km" value={form.odometer_km}
                onChange={e => setForm(f => ({ ...f, odometer_km: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Kosten (€)</label>
              <input type="number" className="form-input" placeholder="0.00" step="0.01" value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nächster Termin</label>
              <input type="date" className="form-input" value={form.next_date}
                onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nächster km-Stand</label>
              <input type="number" className="form-input" placeholder="km" value={form.next_odometer_km}
                onChange={e => setForm(f => ({ ...f, next_odometer_km: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Werkstatt</label>
              <input className="form-input" placeholder="Optional" value={form.workshop}
                onChange={e => setForm(f => ({ ...f, workshop: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notiz</label>
              <input className="form-input" placeholder="Optional" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button type="submit" className="btn btn-primary">✓ Speichern</button>
          </div>
        </form>
      )}

      {entries.length === 0 && !showForm && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-md)' }}>
          Noch keine Wartungseinträge
        </p>
      )}

      {entries.map(e => {
        const typeLabel = MAINT_TYPES.find(t => t.value === e.type)?.label ?? e.type;
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {typeLabel}
                {e.date && ` · ${new Date(e.date).toLocaleDateString('de-DE')}`}
                {e.odometer_km && ` · ${e.odometer_km.toLocaleString('de-DE')} km`}
                {e.cost && ` · ${e.cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
              </div>
              <MaintBadge entry={e} now={now} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)}>✏️</button>
              {delConfirm === e.id ? (
                <>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>Löschen</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDelConfirm(null)}>✕</button>
                </>
              ) : (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDelConfirm(e.id)}>🗑️</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── VehicleCard ───────────────────────────────────────────────────────────────

function VehicleCard({ vehicle, now, onEdit, onDelete }: {
  vehicle: Vehicle; now: number;
  onEdit: (v: Vehicle) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const subtitle = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');

  return (
    <div className="glass" style={{ marginBottom: 'var(--sp-md)', overflow: 'hidden' }}>
      {/* Vehicle header row */}
      <div style={{ display: 'flex', gap: 'var(--sp-md)', alignItems: 'flex-start', padding: 'var(--sp-md)', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        {/* Photo */}
        <div style={{
          width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
          background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {vehicle.photoPath
            ? <img src={vehicle.photoPath} alt={vehicle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 32 }}>🚗</span>}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{vehicle.name as string}</span>
            {(vehicle.dueMaintCount ?? 0) > 0 && (
              <span style={{ fontSize: 11, background: 'var(--orange)', color: '#fff', borderRadius: 99, padding: '2px 7px', fontWeight: 700 }}>
                {vehicle.dueMaintCount} fällig
              </span>
            )}
          </div>
          {subtitle && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 'var(--sp-md)', flexWrap: 'wrap' }}>
            {vehicle.licensePlate && <span>🪪 {vehicle.licensePlate as string}</span>}
            {vehicle.fuelType && <span>{FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType}</span>}
            {vehicle.odometerKm != null && <span>📏 {(vehicle.odometerKm as number).toLocaleString('de-DE')} km</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 'var(--sp-md)' }}>
            <span>🚗 {vehicle.tripCount ?? 0} Fahrten</span>
            <span>📍 {((vehicle.totalKm ?? 0) as number).toLocaleString('de-DE', { maximumFractionDigits: 0 })} km</span>
            <span>🔧 {vehicle.maintCount ?? 0} Wartungen</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(vehicle)}>✏️</button>
          {delConfirm ? (
            <>
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(vehicle.id)}>Löschen</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDelConfirm(false)}>✕</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setDelConfirm(true)}>🗑️</button>
          )}
        </div>

        <span style={{ color: 'var(--text-secondary)', fontSize: 18, alignSelf: 'center' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded: maintenance list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0 var(--sp-md) var(--sp-md)' }}>
          <MaintenanceList vehicle={vehicle} now={now} />
        </div>
      )}
    </div>
  );
}

// ── Fahrzeuge (main view) ─────────────────────────────────────────────────────

const FUEL_TYPES = ['gasoline', 'diesel', 'electric', 'hybrid', 'lpg'];

export function Fahrzeuge() {
  const now = Date.now();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyVehicleForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await api.getVehicles();
      setVehicles(r.vehicles);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyVehicleForm());
    setPhotoFile(null); setPhotoPreview(null);
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setEditingId(v.id);
    setForm({
      name: v.name as string, make: (v.make as string) ?? '', model: (v.model as string) ?? '',
      year: v.year != null ? String(v.year) : '',
      color: (v.color as string) ?? '', license_plate: (v.licensePlate as string) ?? '',
      vin: (v.vin as string) ?? '',
      fuel_type: v.fuelType ?? 'gasoline',
      tank_capacity_liters: v.tankCapacityLiters != null ? String(v.tankCapacityLiters) : '',
      insurance_company: (v.insuranceCompany as string) ?? '',
      insurance_number: (v.insuranceNumber as string) ?? '',
      notes: (v.notes as string) ?? '',
      odometer_km: v.odometerKm != null ? String(v.odometerKm) : '',
    });
    setPhotoFile(null);
    setPhotoPreview(v.photoPath ?? null);
    setShowForm(true);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
      if (photoFile) fd.append('photo', photoFile);

      if (editingId) {
        await api.updateVehicle(editingId, fd);
      } else {
        await api.createVehicle(fd);
      }
      setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteVehicle(id);
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🚘 Fahrzeuge</h1>
          <p className="page-subtitle">{vehicles.length} {vehicles.length === 1 ? 'Fahrzeug' : 'Fahrzeuge'}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => showForm ? setShowForm(false) : openAdd()}>
            {showForm ? '✕' : '+ Fahrzeug'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="glass inline-form" style={{ marginBottom: 'var(--sp-md)' }}>
          <h3 className="inline-form-title">{editingId ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}</h3>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>

              {/* Photo */}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 'var(--sp-md)', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
                <div style={{ width: 80, height: 80, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => fileRef.current?.click()}>
                  {photoPreview
                    ? <img src={photoPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 32 }}>📷</span>}
                </div>
                <div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Foto wählen</button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                  <p className="form-hint">JPG, PNG bis 10 MB</p>
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Name *</label>
                <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. Mein Golf" />
              </div>
              <div className="form-group">
                <label className="form-label">Marke</label>
                <input className="form-input" value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="VW" />
              </div>
              <div className="form-group">
                <label className="form-label">Modell</label>
                <input className="form-input" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Golf 8" />
              </div>
              <div className="form-group">
                <label className="form-label">Baujahr</label>
                <input type="number" className="form-input" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2022" min="1900" max="2099" />
              </div>
              <div className="form-group">
                <label className="form-label">Farbe</label>
                <input className="form-input" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="Schwarz" />
              </div>
              <div className="form-group">
                <label className="form-label">Kennzeichen</label>
                <input className="form-input" value={form.license_plate} onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))} placeholder="B-AB 1234" />
              </div>
              <div className="form-group">
                <label className="form-label">Kraftstoff</label>
                <select className="form-input" value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
                  {FUEL_TYPES.map(t => <option key={t} value={t}>{FUEL_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Kilometerstand (km)</label>
                <input type="number" className="form-input" value={form.odometer_km} onChange={e => setForm(f => ({ ...f, odometer_km: e.target.value }))} placeholder="z.B. 45000" />
              </div>
              <div className="form-group">
                <label className="form-label">Tankvolumen (L)</label>
                <input type="number" className="form-input" value={form.tank_capacity_liters} onChange={e => setForm(f => ({ ...f, tank_capacity_liters: e.target.value }))} placeholder="55" />
              </div>
              <div className="form-group">
                <label className="form-label">VIN / FIN</label>
                <input className="form-input" value={form.vin} onChange={e => setForm(f => ({ ...f, vin: e.target.value }))} placeholder="WVW..." />
              </div>
              <div className="form-group">
                <label className="form-label">Versicherung</label>
                <input className="form-input" value={form.insurance_company} onChange={e => setForm(f => ({ ...f, insurance_company: e.target.value }))} placeholder="Allianz" />
              </div>
              <div className="form-group">
                <label className="form-label">Versicherungs-Nr.</label>
                <input className="form-input" value={form.insurance_number} onChange={e => setForm(f => ({ ...f, insurance_number: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Notizen</label>
                <input className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Abbrechen</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : '✓ Speichern'}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="glass" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Lädt…</div>}

      {!loading && vehicles.length === 0 && (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">🚘</div>
            <h3>Noch kein Fahrzeug</h3>
            <p>Füge dein erstes Fahrzeug hinzu.</p>
            <button className="btn btn-primary" onClick={openAdd}>+ Fahrzeug hinzufügen</button>
          </div>
        </div>
      )}

      {vehicles.map(v => (
        <VehicleCard key={v.id} vehicle={v} now={now} onEdit={openEdit} onDelete={handleDelete} />
      ))}
    </div>
  );
}
