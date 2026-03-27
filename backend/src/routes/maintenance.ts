import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/maintenance?vehicle_id=1
router.get('/', (req: Request, res: Response) => {
  const { vehicle_id } = req.query;
  let query = 'SELECT * FROM maintenance_entries';
  const params: unknown[] = [];
  if (vehicle_id) {
    query += ' WHERE vehicle_id = ?';
    params.push(Number(vehicle_id));
  }
  query += ' ORDER BY date DESC, created_at DESC';
  const entries = db.prepare(query).all(...params);
  res.json({ entries });
});

// GET /api/maintenance/due – date-based AND km-based fälligkeiten
router.get('/due', (_req: Request, res: Response) => {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  // Date-based: next_date within 30 days or overdue
  const byDate = db.prepare(
    `SELECT me.*, v.name AS vehicle_name, v.odometer_km AS vehicle_odometer
     FROM maintenance_entries me
     LEFT JOIN vehicles v ON me.vehicle_id = v.id
     WHERE me.next_date IS NOT NULL AND me.next_date <= ?
     ORDER BY me.next_date ASC`
  ).all(in30Days) as Record<string, unknown>[];

  // km-based: next_odometer_km within 500km of vehicle's current odometer or overdue
  const byKm = db.prepare(
    `SELECT me.*, v.name AS vehicle_name, v.odometer_km AS vehicle_odometer
     FROM maintenance_entries me
     JOIN vehicles v ON me.vehicle_id = v.id
     WHERE me.next_odometer_km IS NOT NULL
       AND v.odometer_km IS NOT NULL
       AND me.next_odometer_km <= (v.odometer_km + 500)
       AND (me.next_date IS NULL OR me.next_date > ?)
     ORDER BY (me.next_odometer_km - v.odometer_km) ASC`
  ).all(in30Days) as Record<string, unknown>[];

  // Merge, deduplicate by id
  const seen = new Set<number>();
  const entries: Record<string, unknown>[] = [];
  for (const e of [...byDate, ...byKm]) {
    if (!seen.has(e.id as number)) {
      seen.add(e.id as number);
      entries.push(e);
    }
  }

  res.json({ entries, now });
});

// POST /api/maintenance
router.post('/', (req: Request, res: Response) => {
  const { title, type, date, odometer_km, cost, workshop, notes, next_date, next_odometer_km, vehicle_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const result = db.prepare(
    `INSERT INTO maintenance_entries
       (title, type, date, odometer_km, cost, workshop, notes, next_date, next_odometer_km, vehicle_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title, type ?? 'service', date ?? null, odometer_km ?? null, cost ?? null,
    workshop ?? null, notes ?? null, next_date ?? null, next_odometer_km ?? null,
    vehicle_id ?? null,
  );
  const entry = db.prepare('SELECT * FROM maintenance_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// PUT /api/maintenance/:id
router.put('/:id', (req: Request, res: Response) => {
  const { title, type, date, odometer_km, cost, workshop, notes, next_date, next_odometer_km, vehicle_id } = req.body;
  db.prepare(
    `UPDATE maintenance_entries
     SET title=?, type=?, date=?, odometer_km=?, cost=?, workshop=?, notes=?, next_date=?, next_odometer_km=?, vehicle_id=?
     WHERE id=?`
  ).run(
    title, type ?? 'service', date ?? null, odometer_km ?? null, cost ?? null,
    workshop ?? null, notes ?? null, next_date ?? null, next_odometer_km ?? null,
    vehicle_id ?? null, req.params.id,
  );
  const entry = db.prepare('SELECT * FROM maintenance_entries WHERE id = ?').get(req.params.id);
  res.json(entry);
});

// DELETE /api/maintenance/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM maintenance_entries WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
