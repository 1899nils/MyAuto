import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1).getTime();
  const end   = new Date(year, month, 1).getTime();
  return { start, end };
}

function yearBounds(year: number) {
  const start = new Date(year, 0, 1).getTime();
  const end   = new Date(year + 1, 0, 1).getTime();
  return { start, end };
}

// GET /api/fuel?year=2026&month=3   (month optional, 1-based)
router.get('/', (req: Request, res: Response) => {
  const year  = req.query.year  ? Number(req.query.year)  : null;
  const month = req.query.month ? Number(req.query.month) : null;

  let query = 'SELECT * FROM fuel_entries WHERE 1=1';
  const params: unknown[] = [];

  if (year && month) {
    const { start, end } = monthBounds(year, month);
    query += ' AND date >= ? AND date < ?';
    params.push(start, end);
  } else if (year) {
    const { start, end } = yearBounds(year);
    query += ' AND date >= ? AND date < ?';
    params.push(start, end);
  }

  query += ' ORDER BY date DESC';
  const entries = db.prepare(query).all(...params);
  res.json({ entries });
});

// GET /api/fuel/stats?year=2026   (always yearly for meaningful averages)
router.get('/stats', (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const { start, end } = yearBounds(year);

  const entries = db.prepare(
    'SELECT * FROM fuel_entries WHERE date >= ? AND date < ? ORDER BY date ASC'
  ).all(start, end) as {
    id: number; date: number; liters: number;
    price_per_liter: number; total_cost: number; odometer_km: number | null;
  }[];

  const totalLiters = entries.reduce((s, e) => s + e.liters, 0);
  const totalCost   = entries.reduce((s, e) => s + e.total_cost, 0);
  const avgPrice    = totalLiters > 0 ? totalCost / totalLiters : 0;

  const withOdo = entries.filter(e => e.odometer_km != null);
  let avgConsumption: number | null = null;
  if (withOdo.length >= 2) {
    let totalKm = 0, totalL = 0;
    for (let i = 1; i < withOdo.length; i++) {
      const km = withOdo[i].odometer_km! - withOdo[i - 1].odometer_km!;
      if (km > 0) { totalKm += km; totalL += withOdo[i].liters; }
    }
    if (totalKm > 0) avgConsumption = (totalL / totalKm) * 100;
  }

  const totalKmDriven =
    withOdo.length >= 2
      ? withOdo[withOdo.length - 1].odometer_km! - withOdo[0].odometer_km!
      : null;
  const costPerKm =
    totalKmDriven && totalKmDriven > 0 ? totalCost / totalKmDriven : null;

  res.json({ totalLiters, totalCost, avgPrice, avgConsumption, costPerKm, fillCount: entries.length, year });
});

// POST /api/fuel
router.post('/', (req: Request, res: Response) => {
  const { date, liters, price_per_liter, total_cost, odometer_km, notes } = req.body;
  if (!date || !liters || !price_per_liter || !total_cost) {
    return res.status(400).json({ error: 'date, liters, price_per_liter, total_cost required' });
  }
  const result = db.prepare(
    `INSERT INTO fuel_entries (date, liters, price_per_liter, total_cost, odometer_km, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(date, liters, price_per_liter, total_cost, odometer_km ?? null, notes ?? null);
  const entry = db.prepare('SELECT * FROM fuel_entries WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// PUT /api/fuel/:id
router.put('/:id', (req: Request, res: Response) => {
  const { date, liters, price_per_liter, total_cost, odometer_km, notes } = req.body;
  db.prepare(
    `UPDATE fuel_entries SET date=?, liters=?, price_per_liter=?, total_cost=?, odometer_km=?, notes=?
     WHERE id=?`
  ).run(date, liters, price_per_liter, total_cost, odometer_km ?? null, notes ?? null, req.params.id);
  const entry = db.prepare('SELECT * FROM fuel_entries WHERE id = ?').get(req.params.id);
  res.json(entry);
});

// DELETE /api/fuel/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM fuel_entries WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
