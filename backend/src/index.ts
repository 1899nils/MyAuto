import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import tripsRouter from './routes/trips';
import trackpointsRouter from './routes/trackpoints';
import settingsRouter from './routes/settings';
import fuelRouter from './routes/fuel';
import vehiclesRouter from './routes/vehicles';
import maintenanceRouter from './routes/maintenance';
import logbookRouter from './routes/logbook';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Serve uploaded photos
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/data/uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// API routes
app.use('/api/trips', tripsRouter);
app.use('/api/trips/:tripId/points', trackpointsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/fuel', fuelRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/logbook', logbookRouter);

// Serve frontend static files in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MyAuto running on http://0.0.0.0:${PORT}`);
});
