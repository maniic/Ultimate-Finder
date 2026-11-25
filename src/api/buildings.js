// Buildings API: the list behind the search view's autocomplete.
//
//   GET /api/buildings -> { buildings: [{ code, name, category, enabled }] }
//
// All buildings come back (about 50 rows), enabled ones first. Disabled ones
// have no room data yet, so the search view greys them out.
//
// On startup this file upserts src/api/_buildings-seed.json into the Building
// table. It's idempotent: it refreshes name and category, and turns a
// building on when the seed says `enabled: true` (so shipping a building's
// data is enough to make it searchable). It never turns one off, so flipping
// a building on in the DB survives redeploys. The
// deploy runs migrations first, so the table exists by the time this runs.
// A seeding failure is logged, not fatal: the app and health check stay up.

import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { prisma } from '../db.js';

const seed = JSON.parse(readFileSync(new URL('./_buildings-seed.json', import.meta.url), 'utf8'));

try {
  await prisma.$transaction(seed.map((b) => prisma.building.upsert({
    where: { code: b.code },
    create: { code: b.code, name: b.name, category: b.category, enabled: b.enabled },
    update: { name: b.name, category: b.category, ...(b.enabled ? { enabled: true } : {}) },
  })));
} catch (err) {
  console.error('buildings: seeding failed', err);
}

export const path = 'buildings';   // → /api/buildings
export const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const buildings = await prisma.building.findMany({
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
      select: { code: true, name: true, category: true, enabled: true },
    });
    res.json({ buildings });
  } catch (err) { next(err); }
});
