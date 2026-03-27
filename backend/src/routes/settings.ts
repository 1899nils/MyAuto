import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

interface ClassificationRule {
  id?: number;
  name: string;
  type: string;
  start_hour: number;
  end_hour: number;
  days: number[];
  category: string;
  priority: number;
}

// GET /api/settings
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settingsMap: Record<string, string> = {};
  for (const row of rows) settingsMap[row.key] = row.value;

  const rules = db.prepare('SELECT * FROM classification_rules ORDER BY priority DESC').all() as (ClassificationRule & { id: number; days: string })[];
  const parsedRules = rules.map(r => ({ ...r, days: JSON.parse(r.days) }));

  let addressAliases: Record<string, string> = {};
  try { addressAliases = JSON.parse(settingsMap.address_aliases || '{}'); } catch { /* ignore */ }

  res.json({
    bluetoothDeviceName: settingsMap.bluetoothDeviceName || null,
    bluetoothDeviceId: settingsMap.bluetoothDeviceId || null,
    googleMapsApiKey: settingsMap.googleMapsApiKey || '',
    homeAddress: settingsMap.homeAddress || '',
    workAddress: settingsMap.workAddress || '',
    defaultCategory: settingsMap.defaultCategory || 'ask',
    classificationRules: parsedRules,
    addressAliases,
  });
});

// PUT /api/settings
router.put('/', (req: Request, res: Response) => {
  const {
    bluetoothDeviceName, bluetoothDeviceId, googleMapsApiKey,
    homeAddress, workAddress, defaultCategory, classificationRules,
    addressAliases,
  } = req.body;

  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateSettings = db.transaction(() => {
    if (bluetoothDeviceName !== undefined) upsert.run('bluetoothDeviceName', bluetoothDeviceName);
    if (bluetoothDeviceId !== undefined) upsert.run('bluetoothDeviceId', bluetoothDeviceId);
    if (googleMapsApiKey !== undefined) upsert.run('googleMapsApiKey', googleMapsApiKey);
    if (homeAddress !== undefined) upsert.run('homeAddress', homeAddress);
    if (workAddress !== undefined) upsert.run('workAddress', workAddress);
    if (defaultCategory !== undefined) upsert.run('defaultCategory', defaultCategory);
    if (addressAliases !== undefined) upsert.run('address_aliases', JSON.stringify(addressAliases));

    if (Array.isArray(classificationRules)) {
      db.prepare('DELETE FROM classification_rules').run();
      const insertRule = db.prepare(`
        INSERT INTO classification_rules (name, type, start_hour, end_hour, days, category, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const rule of classificationRules as ClassificationRule[]) {
        insertRule.run(
          rule.name, rule.type || 'time',
          rule.start_hour, rule.end_hour,
          JSON.stringify(rule.days),
          rule.category, rule.priority
        );
      }
    }
  });

  updateSettings();
  res.json({ ok: true });
});

export default router;
