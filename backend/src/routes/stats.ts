import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

interface MonthRow { month: string; km: number; count: number; business_km: number; private_km: number; }
interface CategoryRow { category: string; km: number; count: number; }
interface WeekdayRow { dow: number; km: number; count: number; }

// GET /api/stats/year?year=2025
router.get('/year', (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd   = new Date(year + 1, 0, 1).getTime();

  // Monthly breakdown
  const months = db.prepare(`
    SELECT
      strftime('%m', datetime(start_time/1000, 'unixepoch', 'localtime')) AS month,
      SUM(distance_km) AS km,
      COUNT(*) AS count,
      SUM(CASE WHEN category='business' THEN distance_km ELSE 0 END) AS business_km,
      SUM(CASE WHEN category='private'  THEN distance_km ELSE 0 END) AS private_km
    FROM trips
    WHERE start_time >= ? AND start_time < ? AND end_time IS NOT NULL
    GROUP BY month
    ORDER BY month
  `).all(yearStart, yearEnd) as MonthRow[];

  // Category totals
  const byCategory = db.prepare(`
    SELECT category, SUM(distance_km) AS km, COUNT(*) AS count
    FROM trips
    WHERE start_time >= ? AND start_time < ? AND end_time IS NOT NULL
    GROUP BY category
  `).all(yearStart, yearEnd) as CategoryRow[];

  // Weekday distribution (0=Sun, 1=Mon, ...)
  const byWeekday = db.prepare(`
    SELECT
      CAST(strftime('%w', datetime(start_time/1000, 'unixepoch', 'localtime')) AS INTEGER) AS dow,
      SUM(distance_km) AS km,
      COUNT(*) AS count
    FROM trips
    WHERE start_time >= ? AND start_time < ? AND end_time IS NOT NULL
    GROUP BY dow
  `).all(yearStart, yearEnd) as WeekdayRow[];

  // Totals
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS trips,
      SUM(distance_km) AS km,
      SUM(duration_seconds) AS secs,
      AVG(distance_km) AS avg_km,
      MAX(distance_km) AS max_km
    FROM trips
    WHERE start_time >= ? AND start_time < ? AND end_time IS NOT NULL
  `).get(yearStart, yearEnd) as { trips: number; km: number; secs: number; avg_km: number; max_km: number };

  // Fuel cost this year
  const fuelCost = db.prepare(`
    SELECT SUM(total_cost) AS cost, SUM(liters) AS liters, SUM(km) AS km
    FROM fuel_entries
    WHERE date >= ? AND date < ?
  `).get(yearStart, yearEnd) as { cost: number | null; liters: number | null; km: number | null };

  // Maintenance cost this year
  const maintCost = db.prepare(`
    SELECT SUM(cost) AS cost, COUNT(*) AS count
    FROM maintenance_entries
    WHERE date >= ? AND date < ?
  `).get(yearStart, yearEnd) as { cost: number | null; count: number };

  // CO₂ estimate: join fuel_entries with vehicles for fuel_type
  // Emission factors kg CO₂ per liter: gasoline 2.31, diesel 2.64, lpg 1.63, electric 0, hybrid 2.0
  interface FuelCO2Row { liters: number; fuel_type: string | null }
  const fuelCO2Rows = db.prepare(`
    SELECT fe.liters, v.fuel_type
    FROM fuel_entries fe
    LEFT JOIN vehicles v ON fe.vehicle_id = v.id
    WHERE fe.date >= ? AND fe.date < ?
  `).all(yearStart, yearEnd) as FuelCO2Row[];

  const CO2_FACTORS: Record<string, number> = {
    gasoline: 2.31, diesel: 2.64, lpg: 1.63, electric: 0, hybrid: 2.0,
  };
  const co2_kg = fuelCO2Rows.reduce((sum, row) => {
    const factor = CO2_FACTORS[row.fuel_type ?? 'gasoline'] ?? 2.31;
    return sum + (row.liters ?? 0) * factor;
  }, 0);

  const MONTH_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const monthData = MONTH_LABELS.map((label, i) => {
    const m = String(i + 1).padStart(2, '0');
    const row = months.find(r => r.month === m);
    return {
      month: label,
      km:           row ? Math.round((row.km           ?? 0) * 10) / 10 : 0,
      count:        row ? row.count  : 0,
      business_km:  row ? Math.round((row.business_km  ?? 0) * 10) / 10 : 0,
      private_km:   row ? Math.round((row.private_km   ?? 0) * 10) / 10 : 0,
    };
  });

  const DOW_LABELS = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const weekdayData = DOW_LABELS.map((label, i) => {
    const row = byWeekday.find(r => r.dow === i);
    return { day: label, km: row ? Math.round((row.km ?? 0) * 10) / 10 : 0, count: row ? row.count : 0 };
  });

  const businessKm = byCategory.find(r => r.category === 'business')?.km ?? 0;
  const pauschale  = businessKm * 0.30;

  res.json({
    year,
    totals: {
      trips:  totals?.trips   ?? 0,
      km:     Math.round((totals?.km      ?? 0) * 10) / 10,
      hours:  Math.round((totals?.secs    ?? 0) / 3600 * 10) / 10,
      avg_km: Math.round((totals?.avg_km  ?? 0) * 10) / 10,
      max_km: Math.round((totals?.max_km  ?? 0) * 10) / 10,
    },
    costs: {
      fuel_eur:   Math.round((fuelCost?.cost ?? 0) * 100) / 100,
      fuel_liters: Math.round((fuelCost?.liters ?? 0) * 10) / 10,
      maintenance_eur: Math.round((maintCost?.cost ?? 0) * 100) / 100,
      maintenance_count: maintCost?.count ?? 0,
      total_eur: Math.round(((fuelCost?.cost ?? 0) + (maintCost?.cost ?? 0)) * 100) / 100,
      co2_kg: Math.round(co2_kg * 10) / 10,
    },
    tax: {
      business_km: Math.round(businessKm * 10) / 10,
      pauschale:   Math.round(pauschale  * 100) / 100,
    },
    monthData,
    weekdayData,
    byCategory,
  });
});

export default router;
