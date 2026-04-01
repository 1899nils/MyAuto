import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import tripsRouter from './routes/trips';
import trackpointsRouter from './routes/trackpoints';
import settingsRouter from './routes/settings';
import fuelRouter from './routes/fuel';
import vehiclesRouter from './routes/vehicles';
import maintenanceRouter from './routes/maintenance';
import logbookRouter from './routes/logbook';
import statsRouter from './routes/stats';
import backupRouter from './routes/backup';
import authRouter from './routes/auth';
import { runMigrations } from './db/migrations';
import db from './db/database';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'myauto-secret-change-me';

runMigrations();

app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Serve uploaded photos
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/data/uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Auth routes (no JWT required)
app.use('/api/auth', authRouter);

// Parse a named cookie from the raw Cookie header (no external dep needed)
function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// JWT guard – only when a PIN is configured
function authGuard(req: Request, res: Response, next: NextFunction): void {
  const pinRow = db.prepare("SELECT value FROM settings WHERE key='pin_hash'").get() as { value: string } | undefined;
  if (!pinRow) { next(); return; } // no PIN set → open access

  // 1. Try Authorization header (JS clients)
  const header = req.headers.authorization ?? '';
  let token = header.startsWith('Bearer ') ? header.slice(7) : '';

  // 2. Fallback: httpOnly session cookie (browser navigations, mobile)
  if (!token) {
    token = parseCookie(req.headers.cookie ?? '', 'myauto_session') ?? '';
  }

  if (!token) { res.status(401).json({ error: 'Nicht angemeldet' }); return; }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

// API routes (protected)
app.use('/api/trips', authGuard, tripsRouter);
app.use('/api/trips/:tripId/points', authGuard, trackpointsRouter);
app.use('/api/settings', authGuard, settingsRouter);
app.use('/api/fuel', authGuard, fuelRouter);
app.use('/api/vehicles', authGuard, vehiclesRouter);
app.use('/api/maintenance', authGuard, maintenanceRouter);
app.use('/api/logbook', authGuard, logbookRouter);
app.use('/api/stats', authGuard, statsRouter);
app.use('/api/backup', authGuard, backupRouter);

// Serve frontend static files in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MyAuto running on http://0.0.0.0:${PORT}`);
});
