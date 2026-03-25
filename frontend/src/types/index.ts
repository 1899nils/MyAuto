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

export interface FuelEntry {
  id: number;
  date: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  odometer_km: number | null;
  notes: string | null;
  created_at: number;
}

export interface FuelStats {
  totalLiters: number;
  totalCost: number;
  avgPrice: number;
  avgConsumption: number | null;
  costPerKm: number | null;
  fillCount: number;
}

export interface MaintenanceEntry {
  id: number;
  title: string;
  type: 'oil_change' | 'tuev' | 'tires' | 'brakes' | 'service' | 'other';
  date?: number;
  odometerKm?: number;
  cost?: number;
  workshop?: string;
  notes?: string;
  nextDate?: number;
  nextOdometerKm?: number;
  createdAt: number;
}

// Raw shape returned by the API (snake_case from SQLite)
export interface MaintenanceEntryRaw {
  id: number;
  title: string;
  type: 'oil_change' | 'tuev' | 'tires' | 'brakes' | 'service' | 'other';
  date: number | null;
  odometer_km: number | null;
  cost: number | null;
  workshop: string | null;
  notes: string | null;
  next_date: number | null;
  next_odometer_km: number | null;
  created_at: number;
}

export interface Vehicle {
  id: number;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  vin?: string;
  fuelType: 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'lpg';
  tankCapacityLiters?: number;
  insuranceCompany?: string;
  insuranceNumber?: string;
  notes?: string;
  photoPath?: string;
  isActive: boolean;
  createdAt: number;
}
