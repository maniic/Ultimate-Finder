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
// rate-limited per visitor.

import { Router } from 'express';
import { prisma } from '../db.js';

export const PROBLEMS = ['not-working', 'dirty', 'missing', 'other'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Tiny in-memory rate limit: 5 reports per visitor per 10 minutes. Cloudflare
// sets CF-Connecting-IP to the real visitor's IP. Resets on each deploy.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();
function rateLimited(req) {
  const key = req.get('cf-connecting-ip') || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10000) hits.clear(); // crude memory cap
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
