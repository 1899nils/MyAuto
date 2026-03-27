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
  vehicle_id?: number | null;
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

export type FuelType = 'super' | 'super_plus' | 'diesel' | 'lpg' | 'electric' | 'adblue' | 'other';

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  super:      'Super E10',
  super_plus: 'Super Plus',
  diesel:     'Diesel',
  lpg:        'Autogas (LPG)',
  electric:   'Strom (kWh)',
  adblue:     'AdBlue',
  other:      'Sonstiges',
};

export interface FuelEntry {
  id: number;
  date: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  odometer_km: number | null;
  notes: string | null;
  fuel_type?: FuelType | null;
  vehicle_id?: number | null;
  vehicle_name?: string | null;
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
  // Joined fields from /due endpoint
  vehicle_name?: string;
  vehicle_odometer?: number | null;
}

export interface MonthDataPoint {
  month: string;
  km: number;
  count: number;
  business_km: number;
  private_km: number;
}

export interface WeekdayDataPoint {
  day: string;
  km: number;
  count: number;
}

export interface YearStats {
  year: number;
  totals: { trips: number; km: number; hours: number; avg_km: number; max_km: number };
  costs: { fuel_eur: number; fuel_liters: number; maintenance_eur: number; maintenance_count: number; total_eur: number; co2_kg: number };
  tax: { business_km: number; pauschale: number };
  monthData: MonthDataPoint[];
  weekdayData: WeekdayDataPoint[];
  byCategory: { category: string; km: number; count: number }[];
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
  odometerKm?: number | null;
  createdAt: number;
  // computed by API
  tripCount?: number;
  totalKm?: number;
  maintCount?: number;
  dueMaintCount?: number;
}
