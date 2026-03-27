import { useState, useEffect, useRef } from 'react';
import { useTripStore } from '../../store/tripStore';
import { ClassificationRule } from '../../types';
import { api, clearToken, setToken } from '../../api/client';
import { useTheme, type Theme } from '../../hooks/useTheme';

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function Settings() {
  const { settings, saveSettings, loadSettings } = useTripStore();
  const [mapsKey, setMapsKey] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<'private' | 'business' | 'ask'>('ask');
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pinState, setPinState] = useState<{ pinSet: boolean } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const { theme, setTheme } = useTheme();
  // Address aliases
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [aliasAddr, setAliasAddr] = useState('');
  const [aliasName, setAliasName] = useState('');

  useEffect(() => {
    if (settings) {
      setMapsKey(settings.googleMapsApiKey || '');
      setHomeAddress(settings.homeAddress || '');
      setWorkAddress(settings.workAddress || '');
      setDefaultCategory(settings.defaultCategory || 'ask');
      setRules(settings.classificationRules || []);
      setAliases(settings.addressAliases ?? {});
    }
  }, [settings]);

  useEffect(() => {
    api.getAuthStatus().then(setPinState).catch(() => {});
  }, []);

  async function handlePinSave() {
    setPinMsg('');
    try {
      const { token } = await api.authSetup(newPin, pinState?.pinSet ? currentPin : undefined);
      setToken(token);
      setPinState({ pinSet: true });
      setNewPin(''); setCurrentPin('');
      setPinMsg('✓ PIN gespeichert');
    } catch (e: unknown) {
      setPinMsg(e instanceof Error ? e.message : 'Fehler');
    }
  }

  function addAlias() {
    const addr = aliasAddr.trim();
    const name = aliasName.trim();
    if (!addr || !name) return;
    setAliases(a => ({ ...a, [addr]: name }));
    setAliasAddr('');
    setAliasName('');
  }

  function removeAlias(addr: string) {
    setAliases(a => { const n = { ...a }; delete n[addr]; return n; });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings({
        googleMapsApiKey: mapsKey,
        homeAddress,
        workAddress,
        defaultCategory,
        classificationRules: rules,
        addressAliases: aliases,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function addRule() {
    setRules(r => [...r, {
      name: 'Neue Regel',
      type: 'time',
      start_hour: 7,
      end_hour: 19,
      days: [1, 2, 3, 4, 5],
      category: 'business',
      priority: r.length,
    }]);
  }

  function removeRule(idx: number) {
    setRules(r => r.filter((_, i) => i !== idx));
  }

  function updateRule(idx: number, patch: Partial<ClassificationRule>) {
    setRules(r => r.map((rule, i) => i === idx ? { ...rule, ...patch } : rule));
  }

  function toggleDay(ruleIdx: number, day: number) {
    const rule = rules[ruleIdx];
    const days = rule.days.includes(day)
      ? rule.days.filter(d => d !== day)
      : [...rule.days, day].sort();
    updateRule(ruleIdx, { days });
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreMsg('');
    try {
      const fd = new FormData();
      fd.append('backup', file);
      const res = await fetch('/api/backup/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setRestoreMsg('✓ ' + data.message);
      } else {
        setRestoreMsg('⚠️ ' + (data.error || 'Fehler beim Einspielen'));
      }
    } catch {
      setRestoreMsg('⚠️ Netzwerkfehler');
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleUnpairBluetooth() {
    await saveSettings({ bluetoothDeviceId: undefined, bluetoothDeviceName: undefined });
    await loadSettings();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Einstellungen</h1>
          <p className="page-subtitle">MyAuto konfigurieren</p>
        </div>
      </div>

      {/* Maps API */}
      <div className="glass card mb-md">
        <div className="card-title">Google Maps</div>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            type="password"
            className="form-input"
            value={mapsKey}
            onChange={e => setMapsKey(e.target.value)}
            placeholder="AIzaSy…"
          />
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Benötigt: Maps JavaScript API, Directions API, Geocoding API.
            Kostenlos bis 200$/Monat Guthaben.
          </p>
        </div>
      </div>

      {/* Addresses */}
      <div className="glass card mb-md">
        <div className="card-title">Adressen</div>
        <div className="form-group">
          <label className="form-label">Heimadresse</label>
          <input className="form-input" value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder="Musterstraße 1, 12345 Stadt" />
        </div>
        <div className="form-group">
          <label className="form-label">Arbeitsadresse</label>
          <input className="form-input" value={workAddress} onChange={e => setWorkAddress(e.target.value)} placeholder="Firmenstraße 2, 12345 Stadt" />
        </div>
      </div>

      {/* Bluetooth */}
      <div className="glass card mb-md">
        <div className="card-title">Bluetooth Auto-Kopplung</div>
        {settings?.bluetoothDeviceId ? (
          <div>
            <div className="flex-between mb-md">
              <div>
                <div style={{ fontWeight: 600 }}>🔵 {settings.bluetoothDeviceName || 'Gekoppeltes Auto'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{settings.bluetoothDeviceId}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleUnpairBluetooth}>Entkoppeln</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Fahrten starten automatisch wenn dein Gerät mit diesem Bluetooth-Gerät verbunden ist.
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Koppel dein Auto, um Fahrten automatisch zu starten/stoppen wenn du dich verbindest.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Das Koppeln ist über den "Auto koppeln" Button auf dem Dashboard möglich.
              Web Bluetooth ist in Chrome/Edge verfügbar (nicht in Safari/Firefox).
            </p>
          </div>
        )}
      </div>

      {/* Default Category */}
      <div className="glass card mb-md">
        <div className="card-title">Standard-Klassifizierung</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Was passiert, wenn keine Zeitregel greift?
        </p>
        <div className="toggle-group">
          {[
            { value: 'ask', label: '❓ Fragen' },
            { value: 'business', label: '💼 Beruflich' },
            { value: 'private', label: '🏠 Privat' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`toggle-btn ${defaultCategory === opt.value ? 'active' : ''}`}
              onClick={() => setDefaultCategory(opt.value as typeof defaultCategory)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Classification Rules */}
      <div className="glass card mb-md">
        <div className="flex-between mb-md">
          <span className="card-title" style={{ marginBottom: 0 }}>Zeitbasierte Regeln</span>
          <button className="btn btn-ghost btn-sm" onClick={addRule}>+ Regel</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Fahrten werden automatisch klassifiziert wenn Uhrzeit und Wochentag übereinstimmen.
        </p>

        {rules.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
            Keine Regeln definiert
          </p>
        )}

        {rules.map((rule, idx) => (
          <div key={idx} className="glass-sm" style={{ padding: 'var(--sp-md)', marginBottom: 'var(--sp-sm)' }}>
            <div className="flex-between mb-sm">
              <input
                className="form-input"
                style={{ flex: 1, marginRight: 8, padding: '8px 12px', fontSize: 14 }}
                value={rule.name}
                onChange={e => updateRule(idx, { name: e.target.value })}
              />
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 18 }}
                onClick={() => removeRule(idx)}
              >
                ×
              </button>
            </div>

            {/* Days */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {DAYS.map((day, d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(idx, d)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--r-full)',
                    border: '1px solid',
                    borderColor: rule.days.includes(d) ? 'var(--accent)' : 'var(--glass-border)',
                    background: rule.days.includes(d) ? 'rgba(0,122,255,0.2)' : 'transparent',
                    color: rule.days.includes(d) ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Time range */}
            <div className="flex gap-sm" style={{ alignItems: 'center', marginBottom: 8 }}>
              <select
                className="form-select"
                value={rule.start_hour}
                onChange={e => updateRule(idx, { start_hour: Number(e.target.value) })}
                style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
              >
                {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
              <span className="text-secondary">–</span>
              <select
                className="form-select"
                value={rule.end_hour}
                onChange={e => updateRule(idx, { end_hour: Number(e.target.value) })}
                style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
              >
                {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>

              <div className="toggle-group" style={{ flex: 1 }}>
                {(['business', 'private'] as const).map(cat => (
                  <button
                    key={cat}
                    className={`toggle-btn ${rule.category === cat ? 'active' : ''}`}
                    onClick={() => updateRule(idx, { category: cat })}
                    style={{ fontSize: 13 }}
                  >
                    {cat === 'business' ? '💼' : '🏠'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Backup & Restore */}
      <div className="glass card mb-md">
        <div className="card-title">Backup & Wiederherstellung</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>
          Exportiert alle Fahrten, Einstellungen, Fahrzeugdaten und Fotos als ZIP-Datei.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          <a
            href="/api/backup/export"
            download
            className="btn btn-primary btn-sm"
            style={{ textAlign: 'center', textDecoration: 'none' }}
          >
            ⬇ Backup herunterladen
          </a>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
          >
            {restoring ? '⏳ Wird eingespielt…' : '⬆ Backup einspielen'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={handleRestore}
          />
          {restoreMsg && (
            <p style={{ fontSize: 13, color: restoreMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
              {restoreMsg}
            </p>
          )}
        </div>
      </div>

      {/* PIN & Sicherheit */}
      <div className="glass card mb-md">
        <div className="card-title">🔒 Zugangscode (PIN)</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>
          {pinState?.pinSet
            ? 'PIN ist aktiv. Hier kannst du ihn ändern.'
            : 'Kein PIN gesetzt – alle Benutzer haben Zugriff. Setze einen PIN, um die App zu schützen.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          {pinState?.pinSet && (
            <input className="form-input" type="password" inputMode="numeric" placeholder="Aktueller PIN"
              value={currentPin} onChange={e => setCurrentPin(e.target.value)} />
          )}
          <input className="form-input" type="password" inputMode="numeric" placeholder="Neuer PIN (mind. 4 Stellen)"
            value={newPin} onChange={e => setNewPin(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={handlePinSave} disabled={newPin.length < 4}>
            {pinState?.pinSet ? '🔑 PIN ändern' : '🔒 PIN einrichten'}
          </button>
          {pinState?.pinSet && (
            <button className="btn btn-ghost btn-sm" onClick={() => { clearToken(); window.location.reload(); }}>
              🚪 Abmelden
            </button>
          )}
          {pinMsg && <p style={{ fontSize: 13, color: pinMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{pinMsg}</p>}
        </div>
      </div>

      {/* Adress-Aliase */}
      <div className="glass card mb-md">
        <div className="card-title">📍 Adress-Aliase</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>
          Vergib kurze Namen für häufige Adressen – sie erscheinen statt der langen Adresse überall in der App.
        </p>
        {Object.keys(aliases).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 'var(--sp-md)' }}>
            {Object.entries(aliases).map(([addr, name]) => (
              <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--separator)' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{name}</span>
                <span style={{ flex: 2, fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, padding: 0 }} onClick={() => removeAlias(addr)}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
          <input className="form-input" placeholder="Volle Adresse (z.B. Hauptstraße 1, 12345 Berlin)" value={aliasAddr} onChange={e => setAliasAddr(e.target.value)} />
          <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Kurzname (z.B. 🏠 Zuhause)" value={aliasName} onChange={e => setAliasName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAlias()} />
            <button className="btn btn-ghost btn-sm" onClick={addAlias} disabled={!aliasAddr.trim() || !aliasName.trim()}>Hinzufügen</button>
          </div>
        </div>
      </div>

      {/* Design & Theme */}
      <div className="glass card mb-md">
        <div className="card-title">🎨 Design</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>Farbschema der App</p>
        <div className="toggle-group">
          {([['system', '🖥 System'], ['dark', '🌙 Dunkel'], ['light', '☀️ Hell']] as [Theme, string][]).map(([val, label]) => (
            <button key={val} className={`toggle-btn ${theme === val ? 'active' : ''}`} onClick={() => setTheme(val)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        className={`btn btn-full btn-lg ${saved ? 'btn-success' : 'btn-primary'}`}
        onClick={handleSave}
        disabled={saving}
        style={{ marginBottom: 'var(--sp-xl)' }}
      >
        {saving ? '⏳ Speichere…' : saved ? '✓ Gespeichert!' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}
