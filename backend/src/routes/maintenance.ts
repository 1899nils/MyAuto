import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/maintenance – list all entries ordered by date DESC
router.get('/', (_req: Request, res: Response) => {
  const entries = db.prepare(
    'SELECT * FROM maintenance_entries ORDER BY date DESC, created_at DESC'
  ).all();
  res.json({ entries });
});

// GET /api/maintenance/due – entries where next_date is within 30 days or overdue
router.get('/due', (_req: Request, res: Response) => {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  const entries = db.prepare(
    `SELECT * FROM maintenance_entries
     WHERE next_date IS NOT NULL AND next_date <= ?
     ORDER BY next_date ASC`
  ).all(in30Days) as { id: number; next_date: number | null }[];

  res.json({ entries, now });
});

// POST /api/maintenance – create entry
router.post('/', (req: Request, res: Response) => {
  const { title, type, date, odometer_km, cost, workshop, notes, next_date, next_odometer_km } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const result = db.prepare(
    `INSERT INTO maintenance_entries
       (title, type, date, odometer_km, cost, workshop, notes, next_date, next_odometer_km)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    title,
    type ?? 'service',
    date ?? null,
    odometer_km ?? null,
    cost ?? null,
    workshop ?? null,
    notes ?? null,
    next_date ?? null,
    next_odometer_km ?? null,
  );
  const entry = db.prepare('SELECT * FROM maintenance_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// PUT /api/maintenance/:id – update entry
router.put('/:id', (req: Request, res: Response) => {
  const { title, type, date, odometer_km, cost, workshop, notes, next_date, next_odometer_km } = req.body;
  db.prepare(
    `UPDATE maintenance_entries
     SET title=?, type=?, date=?, odometer_km=?, cost=?, workshop=?, notes=?, next_date=?, next_odometer_km=?
     WHERE id=?`
  ).run(
    title,
    type ?? 'service',
    date ?? null,
    odometer_km ?? null,
    cost ?? null,
    workshop ?? null,
    notes ?? null,
    next_date ?? null,
    next_odometer_km ?? null,
    req.params.id,
  );
  const entry = db.prepare('SELECT * FROM maintenance_entries WHERE id = ?').get(req.params.id);
  res.json(entry);
});

// DELETE /api/maintenance/:id – delete entry
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM maintenance_entries WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
