import { useEffect, useRef } from 'react';
import { useTripStore } from '../../store/tripStore';
import { loadGoogleMaps } from '../../utils/maps';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef   = useRef<google.maps.places.Autocomplete | null>(null);
  const settings = useTripStore(s => s.settings);

  useEffect(() => {
    if (!settings?.googleMapsApiKey || !inputRef.current) return;

    loadGoogleMaps(settings.googleMapsApiKey).then(() => {
      if (!inputRef.current || acRef.current) return;

      acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'geometry'],
        componentRestrictions: { country: 'de' },
      });

      acRef.current.addListener('place_changed', () => {
        const place = acRef.current!.getPlace();
        if (place.geometry?.location && place.formatted_address) {
          onPlace({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        }
      });
    });

    return () => {
      if (acRef.current) {
        google.maps.event.clearInstanceListeners(acRef.current);
        acRef.current = null;
      }
    };
  }, [settings?.googleMapsApiKey]);

  return (
    <input
      ref={inputRef}
      type="text"
      className="form-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete="off"
    />
  );
}
