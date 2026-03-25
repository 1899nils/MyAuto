import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/trips - list with optional filters
router.get('/', (req: Request, res: Response) => {
  const { category, from, to, vehicle_id, limit = '50', offset = '0' } = req.query;

  let where = '1=1';
  const params: unknown[] = [];
  const countParams: unknown[] = [];

  function addFilter(clause: string, value: unknown) {
    where += ` AND ${clause}`;
    params.push(value);
    countParams.push(value);
  }

  if (category)   addFilter('category = ?',   category);
  if (from)       addFilter('start_time >= ?', Number(from));
  if (to)         addFilter('start_time <= ?', Number(to));
  if (vehicle_id) addFilter('vehicle_id = ?',  Number(vehicle_id));

  const trips = db.prepare(`SELECT * FROM trips WHERE ${where} ORDER BY start_time DESC LIMIT ? OFFSET ?`)
    .all(...params, Number(limit), Number(offset));
  const total = (db.prepare(`SELECT COUNT(*) as count FROM trips WHERE ${where}`).get(...countParams) as { count: number }).count;

  res.json({ trips, total });
});

// GET /api/trips/export/csv - CSV export
router.get('/export/csv', (_req: Request, res: Response) => {
  const trips = db.prepare('SELECT * FROM trips ORDER BY start_time DESC').all() as Record<string, unknown>[];

  const headers = [
    'Datum', 'Startzeit', 'Endzeit', 'Dauer (min)', 'Strecke (km)',
    'Von', 'Nach', 'Kategorie', 'Verkehrsverzögerung (min)', 'Notizen'
  ];

  const rows = trips.map((t) => {
    const start = new Date(t.start_time as number);
    const end = t.end_time ? new Date(t.end_time as number) : null;
    const dur = t.duration_seconds ? Math.round((t.duration_seconds as number) / 60) : '';
    const delay = t.traffic_delay_seconds ? Math.round((t.traffic_delay_seconds as number) / 60) : 0;
    return [
      start.toLocaleDateString('de-DE'),
      start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      end ? end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
      dur,
      t.distance_km ? (t.distance_km as number).toFixed(1) : '',
      t.start_address || '',
      t.end_address || '',
      t.category === 'business' ? 'Beruflich' : t.category === 'private' ? 'Privat' : 'Unklassifiziert',
      delay,
      t.notes || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fahrtenbuch.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel
});

// GET /api/trips/stats - summary stats
router.get('/stats', (_req: Request, res: Response) => {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const stats = {
    today: db.prepare(`SELECT COUNT(*) as count, SUM(distance_km) as km, SUM(duration_seconds) as secs FROM trips WHERE start_time >= ? AND end_time IS NOT NULL`).get(todayStart.getTime()),
    week: db.prepare(`SELECT COUNT(*) as count, SUM(distance_km) as km, SUM(duration_seconds) as secs FROM trips WHERE start_time >= ? AND end_time IS NOT NULL`).get(weekStart.getTime()),
    month: db.prepare(`SELECT COUNT(*) as count, SUM(distance_km) as km, SUM(duration_seconds) as secs FROM trips WHERE start_time >= ? AND end_time IS NOT NULL`).get(monthStart.getTime()),
    byCategory: db.prepare(`SELECT category, COUNT(*) as count, SUM(distance_km) as km FROM trips WHERE start_time >= ? AND end_time IS NOT NULL GROUP BY category`).all(monthStart.getTime()),
    activeTrip: db.prepare(`SELECT * FROM trips WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`).get() || null,
  };

  res.json(stats);
});

// GET /api/trips/:id
router.get('/:id', (req: Request, res: Response) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip) return res.status(404).json({ error: 'Not found' });
  res.json(trip);
});

// POST /api/trips - start new trip or create complete manual trip
router.post('/', (req: Request, res: Response) => {
  const {
    startLat, startLng, bluetoothDevice,
    // Manual trip fields (all optional – if endTime is provided, trip is saved as complete)
    startTime, endTime, startAddress, endAddress,
    endLat, endLng, distanceKm, durationSeconds, category: manualCategory, notes,
    vehicleId,
  } = req.body;

  const now = Date.now();
  const tripStartTime = startTime ? Number(startTime) : now;

  // Use provided category or auto-classify
  const category = manualCategory || autoClassify(tripStartTime);

  // Calculate duration if not provided but start+end times are given
  const calcDuration = endTime && !durationSeconds
    ? Math.round((Number(endTime) - tripStartTime) / 1000)
    : durationSeconds || null;

  const result = db.prepare(`
    INSERT INTO trips (
      start_time, start_lat, start_lng, bluetooth_device, category, created_at,
      end_time, end_lat, end_lng, start_address, end_address,
      distance_km, duration_seconds, notes, vehicle_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripStartTime,
    startLat || null,
    startLng || null,
    bluetoothDevice || null,
    category,
    now,
    endTime ? Number(endTime) : null,
    endLat || null,
    endLng || null,
    startAddress || null,
    endAddress || null,
    distanceKm || null,
    calcDuration,
    notes || null,
    vehicleId || null,
  );

  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(trip);
});

// PUT /api/trips/:id - update trip
router.put('/:id', (req: Request, res: Response) => {
  const {
    endTime, endLat, endLng, endAddress, startAddress,
    distanceKm, durationSeconds, trafficDelaySeconds,
    category, notes, routePolyline, vehicleId
  } = req.body;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (endTime !== undefined) { fields.push('end_time = ?'); params.push(endTime); }
  if (endLat !== undefined) { fields.push('end_lat = ?'); params.push(endLat); }
  if (endLng !== undefined) { fields.push('end_lng = ?'); params.push(endLng); }
  if (endAddress !== undefined) { fields.push('end_address = ?'); params.push(endAddress); }
  if (startAddress !== undefined) { fields.push('start_address = ?'); params.push(startAddress); }
  if (distanceKm !== undefined) { fields.push('distance_km = ?'); params.push(distanceKm); }
  if (durationSeconds !== undefined) { fields.push('duration_seconds = ?'); params.push(durationSeconds); }
  if (trafficDelaySeconds !== undefined) { fields.push('traffic_delay_seconds = ?'); params.push(trafficDelaySeconds); }
  if (category !== undefined) { fields.push('category = ?'); params.push(category); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (routePolyline !== undefined) { fields.push('route_polyline = ?'); params.push(routePolyline); }
  if (vehicleId !== undefined)     { fields.push('vehicle_id = ?');    params.push(vehicleId || null); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  db.prepare(`UPDATE trips SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  res.json(trip);
});

// DELETE /api/trips/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

function autoClassify(timestamp: number): string {
  const rules = db.prepare('SELECT * FROM classification_rules ORDER BY priority DESC').all() as {
    start_hour: number; end_hour: number; days: string; category: string;
  }[];

  const date = new Date(timestamp);
  const hour = date.getHours();
  const day = date.getDay(); // 0=Sun, 1=Mon, ...

  for (const rule of rules) {
    const days: number[] = JSON.parse(rule.days);
    if (days.includes(day) && hour >= rule.start_hour && hour < rule.end_hour) {
      return rule.category;
    }
  }

  // Read default from settings
  const defaultCat = db.prepare("SELECT value FROM settings WHERE key = 'defaultCategory'").get() as { value: string } | undefined;
  const def = defaultCat?.value || 'unclassified';
  return def === 'ask' ? 'unclassified' : def;
}

export default router;
