import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/fuel
router.get('/', (req: Request, res: Response) => {
  const { year } = req.query;
  let query = 'SELECT * FROM fuel_entries WHERE 1=1';
  const params: unknown[] = [];

  if (year) {
    const start = new Date(`${year}-01-01`).getTime();
    const end = new Date(`${Number(year) + 1}-01-01`).getTime();
    query += ' AND date >= ? AND date < ?';
    params.push(start, end);
  }

  query += ' ORDER BY date DESC';
  const entries = db.prepare(query).all(...params);
  res.json({ entries });
});

// GET /api/fuel/stats
router.get('/stats', (_req: Request, res: Response) => {
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(`${currentYear}-01-01`).getTime();
  const yearEnd = new Date(`${currentYear + 1}-01-01`).getTime();

  // All entries for current year, ascending for consumption calc
  const entries = db.prepare(
    'SELECT * FROM fuel_entries WHERE date >= ? AND date < ? ORDER BY date ASC'
  ).all(yearStart, yearEnd) as {
    id: number; date: number; liters: number;
    price_per_liter: number; total_cost: number; odometer_km: number | null;
  }[];

  const totalLiters = entries.reduce((s, e) => s + e.liters, 0);
  const totalCost = entries.reduce((s, e) => s + e.total_cost, 0);
  const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

  // Consumption: calc per 100km between consecutive entries with odometer
  const withOdo = entries.filter(e => e.odometer_km != null);
  let avgConsumption: number | null = null;
  if (withOdo.length >= 2) {
    let totalKm = 0;
    let totalL = 0;
    for (let i = 1; i < withOdo.length; i++) {
      const km = withOdo[i].odometer_km! - withOdo[i - 1].odometer_km!;
      if (km > 0) {
        totalKm += km;
        totalL += withOdo[i].liters;
      }
    }
    if (totalKm > 0) avgConsumption = (totalL / totalKm) * 100;
  }

  // Cost per km
  const totalKmDriven =
    withOdo.length >= 2
      ? withOdo[withOdo.length - 1].odometer_km! - withOdo[0].odometer_km!
      : null;
  const costPerKm =
    totalKmDriven && totalKmDriven > 0 ? totalCost / totalKmDriven : null;

  res.json({
    totalLiters,
    totalCost,
    avgPrice,
    avgConsumption,
    costPerKm,
    fillCount: entries.length,
  });
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
