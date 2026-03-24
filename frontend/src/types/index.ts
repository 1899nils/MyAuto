export type TripCategory = 'private' | 'business' | 'unclassified';

export interface Trip {
  id: number;
  start_time: number;
  end_time?: number;
  start_address?: string;
  end_address?: string;
  start_lat?: number;
  start_lng?: number;
  end_lat?: number;
  end_lng?: number;
  distance_km?: number;
  duration_seconds?: number;
  traffic_delay_seconds?: number;
  category: TripCategory;
  notes?: string;
  bluetooth_device?: string;
  route_polyline?: string;
  created_at: number;
}

export interface TrackPoint {
  id: number;
  trip_id: number;
  lat: number;
  lng: number;
  timestamp: number;
  speed_kmh?: number;
  accuracy?: number;
}

export interface ClassificationRule {
  id?: number;
  name: string;
  type: 'time';
  start_hour: number;
  end_hour: number;
  days: number[];
  category: TripCategory;
  priority: number;
}

export interface AppSettings {
  bluetoothDeviceName?: string;
  bluetoothDeviceId?: string;
  googleMapsApiKey: string;
  homeAddress?: string;
  workAddress?: string;
  defaultCategory: 'private' | 'business' | 'ask';
  classificationRules: ClassificationRule[];
}

export interface TripStats {
  today: { count: number; km: number | null; secs: number | null };
  week: { count: number; km: number | null; secs: number | null };
  month: { count: number; km: number | null; secs: number | null };
  byCategory: { category: TripCategory; count: number; km: number | null }[];
  activeTrip: Trip | null;
}
