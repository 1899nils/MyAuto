import { useState } from 'react';
import { api, setToken } from '../../api/client';

interface Props {
  pinSet: boolean;
  onLogin: () => void;
}

export function LoginScreen({ pinSet, onLogin }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = pinSet
        ? await api.authLogin(pin)
        : await api.authSetup(pin);
      setToken(token);
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-lg)',
      background: 'var(--bg)',
    }}>
      <div className="glass" style={{ width: '100%', maxWidth: 360, padding: 'var(--sp-xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-xl)' }}>
          <div style={{ fontSize: 56, marginBottom: 'var(--sp-sm)' }}>🚗</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>MyAuto</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
            {pinSet ? 'PIN eingeben' : 'PIN einrichten (mind. 4 Stellen)'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--sp-md)' }}>
            <input
              className="form-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
            />
          </div>
          {error && (
            <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginBottom: 'var(--sp-md)' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading || pin.length < 4}
          >
            {loading ? '…' : pinSet ? '🔓 Anmelden' : '✓ PIN speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
