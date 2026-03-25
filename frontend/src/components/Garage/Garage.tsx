import { useEffect, useRef, useState } from 'react';
import { useGarageStore } from '../../store/garageStore';
import type { Vehicle } from '../../types';

type FuelType = Vehicle['fuelType'];

const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasoline: 'Benzin',
  diesel: 'Diesel',
  electric: 'Elektro',
  hybrid: 'Hybrid',
  lpg: 'LPG',
};

interface VehicleForm {
  name: string;
  make: string;
  model: string;
  year: string;
  color: string;
  licensePlate: string;
  vin: string;
  fuelType: FuelType;
  tankCapacityLiters: string;
  insuranceCompany: string;
  insuranceNumber: string;
  notes: string;
}

function emptyForm(): VehicleForm {
  return {
    name: '',
    make: '',
    model: '',
    year: '',
    color: '',
    licensePlate: '',
    vin: '',
    fuelType: 'gasoline',
    tankCapacityLiters: '',
    insuranceCompany: '',
    insuranceNumber: '',
    notes: '',
  };
}

function vehicleToForm(v: Vehicle): VehicleForm {
  return {
    name: v.name,
    make: v.make ?? '',
    model: v.model ?? '',
    year: v.year != null ? String(v.year) : '',
    color: v.color ?? '',
    licensePlate: v.licensePlate ?? '',
    vin: v.vin ?? '',
    fuelType: v.fuelType,
    tankCapacityLiters: v.tankCapacityLiters != null ? String(v.tankCapacityLiters) : '',
    insuranceCompany: v.insuranceCompany ?? '',
    insuranceNumber: v.insuranceNumber ?? '',
    notes: v.notes ?? '',
  };
}

export function Garage() {
  const { vehicles, loading, loadVehicles, createVehicle, updateVehicle, deleteVehicle } =
    useGarageStore();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVehicles();
  }, []);

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setForm(vehicleToForm(v));
    setEditId(v.id);
    setPhotoFile(null);
    setPhotoPreview(v.photoPath ? v.photoPath : null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.append('name', form.name.trim());
    if (form.make.trim()) fd.append('make', form.make.trim());
    if (form.model.trim()) fd.append('model', form.model.trim());
    if (form.year.trim()) fd.append('year', form.year.trim());
    if (form.color.trim()) fd.append('color', form.color.trim());
    if (form.licensePlate.trim()) fd.append('license_plate', form.licensePlate.trim());
    if (form.vin.trim()) fd.append('vin', form.vin.trim());
    fd.append('fuel_type', form.fuelType);
    if (form.tankCapacityLiters.trim()) fd.append('tank_capacity_liters', form.tankCapacityLiters.trim());
    if (form.insuranceCompany.trim()) fd.append('insurance_company', form.insuranceCompany.trim());
    if (form.insuranceNumber.trim()) fd.append('insurance_number', form.insuranceNumber.trim());
    if (form.notes.trim()) fd.append('notes', form.notes.trim());
    if (photoFile) fd.append('photo', photoFile);
    return fd;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const fd = buildFormData();
      if (editId != null) {
        await updateVehicle(editId, fd);
      } else {
        await createVehicle(fd);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteVehicle(id);
    setDeleteConfirm(null);
    if (editId === id) closeForm();
  }

  function setField<K extends keyof VehicleForm>(key: K, value: VehicleForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="garage-view">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🚘 Meine Garage</h1>
          <p className="page-subtitle">Fahrzeugprofile verwalten</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            + Fahrzeug hinzufügen
          </button>
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="glass inline-form">
          <h3 className="inline-form-title">
            {editId != null ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
          </h3>
          <form onSubmit={handleSave}>
            {/* Photo upload area */}
            <div className="vehicle-photo-upload">
              <div
                className="vehicle-photo-avatar vehicle-photo-avatar--large"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Vorschau" className="vehicle-photo-img" />
                ) : (
                  <span className="vehicle-photo-placeholder">🚗</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? 'Foto ändern' : 'Foto hochladen'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
              />
            </div>

            {/* Required: Name */}
            <div className="form-group">
              <label className="form-label">Bezeichnung *</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. Mein Auto"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>

            {/* Make / Model / Year row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Hersteller</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. Volkswagen"
                  value={form.make}
                  onChange={(e) => setField('make', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Modell</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. Golf"
                  value={form.model}
                  onChange={(e) => setField('model', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Baujahr</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="2020"
                  min="1900"
                  max="2099"
                  value={form.year}
                  onChange={(e) => setField('year', e.target.value)}
                />
              </div>
            </div>

            {/* Color / License Plate row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Farbe</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. Schwarz"
                  value={form.color}
                  onChange={(e) => setField('color', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kennzeichen</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. M-AB 1234"
                  value={form.licensePlate}
                  onChange={(e) => setField('licensePlate', e.target.value)}
                />
              </div>
            </div>

            {/* Fuel type / Tank capacity row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kraftstoffart</label>
                <select
                  className="form-input"
                  value={form.fuelType}
                  onChange={(e) => setField('fuelType', e.target.value as FuelType)}
                >
                  {(Object.entries(FUEL_TYPE_LABELS) as [FuelType, string][]).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Tankvolumen (L)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="z.B. 50"
                  step="0.5"
                  min="0"
                  value={form.tankCapacityLiters}
                  onChange={(e) => setField('tankCapacityLiters', e.target.value)}
                />
              </div>
            </div>

            {/* VIN */}
            <div className="form-group">
              <label className="form-label">Fahrgestellnummer (VIN)</label>
              <input
                type="text"
                className="form-input"
                placeholder="z.B. WVW12345678901234"
                value={form.vin}
                onChange={(e) => setField('vin', e.target.value)}
              />
            </div>

            {/* Insurance row */}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Versicherung</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. ADAC"
                  value={form.insuranceCompany}
                  onChange={(e) => setField('insuranceCompany', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Versicherungsnummer</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="z.B. 123456789"
                  value={form.insuranceNumber}
                  onChange={(e) => setField('insuranceNumber', e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notizen</label>
              <textarea
                className="form-input"
                placeholder="Weitere Informationen…"
                rows={3}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '…' : editId != null ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vehicle list */}
      {loading && vehicles.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Wird geladen…</h3>
          </div>
        </div>
      ) : vehicles.length === 0 && !showForm ? (
        <div className="glass">
          <div className="empty-state">
            <div className="empty-icon">🚗</div>
            <h3>Keine Fahrzeuge</h3>
            <p>Füge dein erstes Fahrzeug hinzu</p>
          </div>
        </div>
      ) : (
        <div className="garage-grid">
          {vehicles.map((v) => (
            <div key={v.id} className="vehicle-card glass">
              {/* Photo avatar */}
              <div className="vehicle-card-photo">
                <div className="vehicle-photo-avatar">
                  {v.photoPath ? (
                    <img src={v.photoPath} alt={v.name} className="vehicle-photo-img" />
                  ) : (
                    <span className="vehicle-photo-placeholder">🚗</span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="vehicle-card-body">
                <div className="vehicle-card-name">{v.name}</div>
                {(v.make || v.model) && (
                  <div className="vehicle-card-sub">
                    {[v.make, v.model].filter(Boolean).join(' ')}
                    {v.year && ` (${v.year})`}
                  </div>
                )}
                <div className="vehicle-card-tags">
                  {v.licensePlate && (
                    <span className="vehicle-tag vehicle-tag--plate">{v.licensePlate}</span>
                  )}
                  <span className="vehicle-tag">{FUEL_TYPE_LABELS[v.fuelType]}</span>
                  {v.color && <span className="vehicle-tag">{v.color}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="vehicle-card-actions">
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => openEdit(v)}
                  title="Bearbeiten"
                >
                  ✏️
                </button>
                {deleteConfirm === v.id ? (
                  <>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(v.id)}
                    >
                      Löschen
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setDeleteConfirm(v.id)}
                    title="Löschen"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
