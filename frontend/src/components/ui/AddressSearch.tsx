import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import { loadGoogleMaps } from '../../utils/maps';

export interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

interface Suggestion {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPlace: (place: PlaceResult) => void;
  placeholder?: string;
  required?: boolean;
}

export function AddressSearch({ value, onChange, onPlace, placeholder, required }: Props) {
  const settings = useTripStore(s => s.settings);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [geoError, setGeoError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function runGeocode(text: string) {
    const apiKey = settings?.googleMapsApiKey;
    if (!apiKey) return;

    setLoading(true);
    setGeoError('');
    try {
      await loadGoogleMaps(apiKey);
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode({ address: text, region: 'de' }, (results, status) => {
        setLoading(false);
        if (status === google.maps.GeocoderStatus.OK && results?.length) {
          const sugs = results.slice(0, 4).map(r => ({
            address: r.formatted_address,
            lat: r.geometry.location.lat(),
            lng: r.geometry.location.lng(),
          }));
          setSuggestions(sugs);
          setOpen(true);
          setGeoError('');
        } else if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
          setSuggestions([]);
          setOpen(false);
          setGeoError('Keine Ergebnisse gefunden');
        } else {
          setSuggestions([]);
          setOpen(false);
          setGeoError('Suche fehlgeschlagen – API-Key oder Abrechnung prüfen');
        }
      });
    } catch {
      setLoading(false);
      setGeoError('Google Maps konnte nicht geladen werden');
    }
  }

  function handleChange(v: string) {
    onChange(v);
    setConfirmed(false);
    setSuggestions([]);
    setGeoError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim() || v.trim().length < 3) { setOpen(false); return; }
    debounceRef.current = setTimeout(() => runGeocode(v), 600);
  }

  function handleSelect(s: Suggestion) {
    onChange(s.address);
    onPlace(s);
    setConfirmed(true);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          style={{ paddingRight: 36 }}
        />
        <span style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, opacity: 0.7, pointerEvents: 'none',
        }}>
          {loading ? '⏳' : confirmed ? '📍' : ''}
        </span>
      </div>

      {geoError && (
        <p style={{ fontSize: 12, color: 'var(--red, #ff3b30)', marginTop: 4, marginBottom: 0 }}>
          {geoError}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface, #1c1c1e)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 'var(--r-md, 10px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 100, overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'none', border: 'none',
                color: 'var(--text, #fff)', fontSize: 13, cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              📍 {s.address}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
