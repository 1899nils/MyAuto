import db from './database';

interface ColumnInfo { name: string }

function hasColumn(table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as ColumnInfo[];
  return cols.some(c => c.name === column);
}

export function runMigrations() {
  // v2: link trips and maintenance to a vehicle
  if (!hasColumn('trips', 'vehicle_id')) {
    db.exec('ALTER TABLE trips ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL');
  }
  if (!hasColumn('maintenance_entries', 'vehicle_id')) {
    db.exec('ALTER TABLE maintenance_entries ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL');
  }
  // v2: current odometer on vehicles
  if (!hasColumn('vehicles', 'odometer_km')) {
    db.exec('ALTER TABLE vehicles ADD COLUMN odometer_km REAL');
  }
  // v2: fuel entries linked to vehicle
  if (!hasColumn('fuel_entries', 'vehicle_id')) {
    db.exec('ALTER TABLE fuel_entries ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL');
  }

  // v3: fuel type per fill-up
  if (!hasColumn('fuel_entries', 'fuel_type')) {
    db.exec("ALTER TABLE fuel_entries ADD COLUMN fuel_type TEXT DEFAULT 'super'");
  }

  // Index for new columns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_entries(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_id ON fuel_entries(vehicle_id);
  `);
}
