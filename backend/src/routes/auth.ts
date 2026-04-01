import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'myauto-secret-change-me';
const TOKEN_TTL  = '30d';
const COOKIE_NAME = 'myauto_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

function getPinHash(): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key='pin_hash'").get() as { value: string } | undefined;
  return row?.value ?? null;
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return String(h >>> 0);
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',   // works with bookmarks + local network IP
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    // omit 'secure' so it works on plain HTTP (local Unraid)
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// GET /api/auth/status → { pinSet: boolean }
router.get('/status', (_req: Request, res: Response) => {
  res.json({ pinSet: getPinHash() !== null });
});

// POST /api/auth/setup  { pin, currentPin? } → { token }
router.post('/setup', (req: Request, res: Response) => {
  const { pin, currentPin } = req.body as { pin?: string; currentPin?: string };
  if (!pin || String(pin).length < 4) {
    res.status(400).json({ error: 'PIN muss mind. 4 Stellen haben' });
    return;
  }

  const existing = getPinHash();
  if (existing !== null) {
    if (!currentPin || simpleHash(String(currentPin)) !== existing) {
      res.status(403).json({ error: 'Aktueller PIN falsch' });
      return;
    }
  }

  const hash = simpleHash(String(pin));
  db.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES('pin_hash', ?)").run(hash);

  const token = jwt.sign({ ok: true }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  setAuthCookie(res, token);
  res.json({ token });
});

// POST /api/auth/login  { pin } → { token }
router.post('/login', (req: Request, res: Response) => {
  const { pin } = req.body as { pin?: string };
  const hash = getPinHash();
  if (!hash) {
    const token = jwt.sign({ ok: true }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    setAuthCookie(res, token);
    res.json({ token });
    return;
  }
  if (!pin || simpleHash(String(pin)) !== hash) {
    res.status(401).json({ error: 'PIN falsch' });
    return;
  }
  const token = jwt.sign({ ok: true }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  setAuthCookie(res, token);
  res.json({ token });
});

// POST /api/auth/logout – clears the session cookie
router.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
