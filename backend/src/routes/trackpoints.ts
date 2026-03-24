import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router({ mergeParams: true });

// POST /api/trips/:tripId/points - batch insert
router.post('/', (req: Request, res: Response) => {
  const { tripId } = req.params;
  const points: { lat: number; lng: number; timestamp: number; speedKmh?: number; accuracy?: number }[] = req.body;

  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: 'points must be a non-empty array' });
  }

  const insert = db.prepare(`
    INSERT INTO track_points (trip_id, lat, lng, timestamp, speed_kmh, accuracy)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((pts: typeof points) => {
    for (const p of pts) {
      insert.run(tripId, p.lat, p.lng, p.timestamp, p.speedKmh ?? null, p.accuracy ?? null);
    }
  });

  insertMany(points);
  res.status(201).json({ inserted: points.length });
});

// GET /api/trips/:tripId/points
router.get('/', (req: Request, res: Response) => {
  const points = db.prepare('SELECT * FROM track_points WHERE trip_id = ? ORDER BY timestamp ASC').all(req.params.tripId);
  res.json(points);
});

export default router;
