import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import db from '../db/database';

const router = Router();
const DATA_DIR   = process.env.DATA_DIR   || path.join(__dirname, '../../../data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/data/uploads';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// GET /api/backup/export – download ZIP with DB + uploads
router.get('/export', (_req: Request, res: Response) => {
  const ts   = new Date().toISOString().slice(0, 10);
  const name = `myauto-backup-${ts}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => { throw err; });
  archive.pipe(res);

  // Include SQLite DB
  const dbPath = path.join(DATA_DIR, 'myauto.db');
  if (fs.existsSync(dbPath)) {
    archive.file(dbPath, { name: 'myauto.db' });
  }

  // Include uploads folder (vehicle photos, etc.)
  if (fs.existsSync(UPLOADS_DIR)) {
    archive.directory(UPLOADS_DIR, 'uploads');
  }

  // Metadata
  archive.append(JSON.stringify({ version: 2, exportedAt: Date.now() }, null, 2), { name: 'backup-info.json' });

  archive.finalize();
});

// POST /api/backup/import – restore from ZIP
router.post('/import', upload.single('backup'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    // Validate: must contain myauto.db
    const dbEntry = entries.find(e => e.entryName === 'myauto.db');
    if (!dbEntry) return res.status(400).json({ error: 'Invalid backup: myauto.db not found' });

    // Close current DB connection by checkpointing WAL
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ }

    // Restore DB
    const dbPath = path.join(DATA_DIR, 'myauto.db');
    fs.writeFileSync(dbPath, dbEntry.getData());

    // Restore uploads
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    for (const entry of entries) {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        const dest = path.join(UPLOADS_DIR, path.basename(entry.entryName));
        fs.writeFileSync(dest, entry.getData());
      }
    }

    res.json({ ok: true, message: 'Backup erfolgreich eingespielt. Bitte App neu laden.' });
  } catch (err) {
    res.status(500).json({ error: 'Restore fehlgeschlagen', detail: String(err) });
  }
});

export default router;
