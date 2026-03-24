CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  start_address TEXT,
  end_address TEXT,
  start_lat REAL,
  start_lng REAL,
  end_lat REAL,
  end_lng REAL,
  distance_km REAL,
  duration_seconds INTEGER,
  traffic_delay_seconds INTEGER DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'unclassified',
  notes TEXT,
  bluetooth_device TEXT,
  route_polyline TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS track_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  speed_kmh REAL,
  accuracy REAL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'time',
  start_hour INTEGER NOT NULL DEFAULT 7,
  end_hour INTEGER NOT NULL DEFAULT 19,
  days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  category TEXT NOT NULL DEFAULT 'business',
  priority INTEGER NOT NULL DEFAULT 0
);

-- Default rule: weekdays business hours
INSERT OR IGNORE INTO classification_rules (id, name, type, start_hour, end_hour, days, category, priority)
VALUES (1, 'Arbeitszeit Mo-Fr', 'time', 7, 19, '[1,2,3,4,5]', 'business', 0);

CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);
CREATE INDEX IF NOT EXISTS idx_track_points_trip_id ON track_points(trip_id);
