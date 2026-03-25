import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db/database';

const router = Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/data/uploads';

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `vehicle_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

function rowToVehicle(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    name: row.name,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    licensePlate: row.license_plate,
    vin: row.vin,
    fuelType: row.fuel_type,
    tankCapacityLiters: row.tank_capacity_liters,
    insuranceCompany: row.insurance_company,
    insuranceNumber: row.insurance_number,
    notes: row.notes,
    photoPath: row.photo_path,
    isActive: row.is_active === 1,
    odometerKm: row.odometer_km ?? null,
    createdAt: row.created_at,
  };
}

// GET /api/vehicles
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all() as Record<string, unknown>[];
  const vehicles = rows.map(row => {
    const v = rowToVehicle(row);
    const tripStats = db.prepare(
      `SELECT COUNT(*) as count, SUM(distance_km) as km FROM trips WHERE vehicle_id = ? AND end_time IS NOT NULL`
    ).get(v.id) as { count: number; km: number | null };
    const maintCount = db.prepare(
      `SELECT COUNT(*) as count FROM maintenance_entries WHERE vehicle_id = ?`
    ).get(v.id) as { count: number };
    const dueMaint = db.prepare(
      `SELECT COUNT(*) as count FROM maintenance_entries WHERE vehicle_id = ? AND next_date IS NOT NULL AND next_date <= ?`
    ).get(v.id, Date.now() + 30 * 24 * 60 * 60 * 1000) as { count: number };
    return { ...v, tripCount: tripStats.count, totalKm: tripStats.km ?? 0, maintCount: maintCount.count, dueMaintCount: dueMaint.count };
  });
  res.json({ vehicles });
});

// GET /api/vehicles/:id
router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(rowToVehicle(row));
});

// POST /api/vehicles
router.post('/', upload.single('photo'), (req: Request, res: Response) => {
  const { name, make, model, year, color, license_plate, vin, fuel_type, tank_capacity_liters,
          insurance_company, insurance_number, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO vehicles (name, make, model, year, color, license_plate, vin, fuel_type,
      tank_capacity_liters, insurance_company, insurance_number, notes, photo_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    make ?? null, model ?? null, year ? Number(year) : null,
    color ?? null, license_plate ?? null, vin ?? null,
    fuel_type ?? 'gasoline',
    tank_capacity_liters ? Number(tank_capacity_liters) : null,
    insurance_company ?? null, insurance_number ?? null,
    notes ?? null, photoPath
  );

  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json(rowToVehicle(row));
});

// PUT /api/vehicles/:id
router.put('/:id', upload.single('photo'), (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

  const { name, make, model, year, color, license_plate, vin, fuel_type, tank_capacity_liters,
          insurance_company, insurance_number, notes, is_active, odometer_km } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  let photoPath = existing.photo_path as string | null;
  if (req.file) {
    if (photoPath) {
      const oldFile = path.join(UPLOADS_DIR, path.basename(photoPath));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }
    photoPath = `/uploads/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE vehicles SET name=?, make=?, model=?, year=?, color=?, license_plate=?, vin=?,
      fuel_type=?, tank_capacity_liters=?, insurance_company=?, insurance_number=?,
      notes=?, photo_path=?, is_active=?, odometer_km=?
    WHERE id=?
  `).run(
    name,
    make ?? null, model ?? null, year ? Number(year) : null,
    color ?? null, license_plate ?? null, vin ?? null,
    fuel_type ?? 'gasoline',
    tank_capacity_liters ? Number(tank_capacity_liters) : null,
    insurance_company ?? null, insurance_number ?? null,
    notes ?? null, photoPath,
    is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ?? 1),
    odometer_km ? Number(odometer_km) : (existing.odometer_km ?? null),
    req.params.id
  );

  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(rowToVehicle(row));
});

// DELETE /api/vehicles/:id
router.delete('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Vehicle not found' });

  if (row.photo_path) {
    const filePath = path.join(UPLOADS_DIR, path.basename(row.photo_path as string));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// POST /api/vehicles/:id/photo – upload photo separately
router.post('/:id/photo', upload.single('photo'), (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Vehicle not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Delete old photo if exists
  if (row.photo_path) {
    const oldFile = path.join(UPLOADS_DIR, path.basename(row.photo_path as string));
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
  }

  const photoPath = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE vehicles SET photo_path = ? WHERE id = ?').run(photoPath, req.params.id);

  const updated = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(rowToVehicle(updated));
});

export default router;
