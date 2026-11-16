// Facilities API: the worked example of a database-backed endpoint.
// Any file in src/api/ is mounted automatically at /api/<path>, so a feature
// adds its server code here without editing src/server.js.
// Copy this shape for new features: validate everything, keep it small,
// return JSON.
//
//   GET  /api/facility-reports?facilityId=f1   -> latest 10 reports for f1
//   POST /api/facility-reports  { facilityId, problem, note? }
//
// It's public and unauthenticated, so inputs are validated and posts are
// rate-limited per visitor and overall.
//
// TODO (team decision): notes are free text from anonymous visitors, shown to
// everyone. Consider hiding them, or checking facilityId against real
// facility IDs once campus data is real.

import { Router } from 'express';
import { prisma } from '../db.js';

export const PROBLEMS = ['not-working', 'dirty', 'missing', 'other'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// In-memory rate limits (they reset on each deploy):
//   - per visitor: 5 reports per 10 minutes. IPv6 addresses are grouped by
//     /64, since one person usually controls a whole /64.
//   - overall: 200 reports per hour, so spread-out spam can't fill the
//     database.
// Cloudflare sets CF-Connecting-IP to the real visitor's IP, and the server
// is reachable only through Cloudflare.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX = 200;
const MAX_TRACKED = 10000;
const hits = new Map();   // visitor key -> timestamps (Map keeps insertion order)
let globalHits = [];

function visitorKey(req) {
  const ip = req.get('cf-connecting-ip') || req.socket.remoteAddress || 'unknown';
  return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') + '::/64' : ip;
}

function rateLimited(req) {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX) return true;
  const key = visitorKey(req);
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.delete(key);          // re-insert so it counts as most recently used
  hits.set(key, recent);
  while (hits.size > MAX_TRACKED) hits.delete(hits.keys().next().value); // evict oldest, never clear all
  globalHits.push(now);
  return false;
}

export const path = 'facility-reports';   // → /api/facility-reports
export const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { facilityId } = req.query;
    if (typeof facilityId !== 'string' || !ID_RE.test(facilityId)) {
      return res.status(400).json({ error: 'facilityId is required' });
    }
    const reports = await prisma.facilityReport.findMany({
      where: { facilityId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, problem: true, note: true, createdAt: true },
    });
    res.json({ reports });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { facilityId, problem, note } = req.body || {};
    if (typeof facilityId !== 'string' || !ID_RE.test(facilityId)) {
      return res.status(400).json({ error: 'invalid facilityId' });
    }
    if (!PROBLEMS.includes(problem)) {
      return res.status(400).json({ error: `problem must be one of: ${PROBLEMS.join(', ')}` });
    }
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) {
      return res.status(400).json({ error: 'note must be text, at most 500 characters' });
    }
    if (rateLimited(req)) {
      return res.status(429).json({ error: 'too many reports, try again in a few minutes' });
    }
    const report = await prisma.facilityReport.create({
      data: { facilityId, problem, note: note?.trim() || null },
      select: { id: true, problem: true, note: true, createdAt: true },
    });
    res.status(201).json({ report });
  } catch (err) { next(err); }
});
