import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import tripsRouter from './routes/trips';
import trackpointsRouter from './routes/trackpoints';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/trips', tripsRouter);
app.use('/api/trips/:tripId/points', trackpointsRouter);
app.use('/api/settings', settingsRouter);

// Serve frontend static files in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MyAuto running on http://0.0.0.0:${PORT}`);
});
