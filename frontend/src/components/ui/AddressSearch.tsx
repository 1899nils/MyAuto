import { useCallback, useRef, useState } from 'react';
import { useTripStore } from '../../store/tripStore';

export interface PlaceResult {
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
  const [geocoding, setGeocoding] = useState(false);
  const [resolved, setResolved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geocode = useCallback(async (address: string) => {
    if (!settings?.googleMapsApiKey || !address.trim() || address.trim().length < 5) return;
    setGeocoding(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${settings.googleMapsApiKey}&language=de&region=de`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        onPlace({
          address: r.formatted_address,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
        });
        setResolved(true);
      }
    } catch {
      // ignore network errors
    } finally {
      setGeocoding(false);
    }
  }, [settings?.googleMapsApiKey, onPlace]);

  function handleChange(v: string) {
    onChange(v);
    setResolved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length >= 5) {
      debounceRef.current = setTimeout(() => geocode(v), 900);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={{ paddingRight: 36 }}
      />
      <span style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        fontSize: 14, opacity: 0.7, pointerEvents: 'none', lineHeight: 1,
      }}>
        {geocoding ? '⏳' : resolved ? '📍' : ''}
      </span>
    </div>
  );
}
