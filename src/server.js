import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { prisma, dbHealthy } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable('x-powered-by');

// Deploy contract: the auto-deploy health check calls this. It must return
// 200 once the app can serve requests, database included, or the deploy is
// rolled back. Keep it cheap.
app.get('/healthz', async (_req, res) => {
  const ok = await dbHealthy();
  res.status(ok ? 200 : 503).type('text/plain').send(ok ? 'ok' : 'database unreachable');
});

// JSON API. Every file in src/api/ exports `path` and `router`, and is mounted
// at /api/<path>, so features add endpoints without touching this file.
app.use('/api', express.json({ limit: '4kb' }));
const apiDir = path.join(__dirname, 'api');
for (const file of readdirSync(apiDir).filter((f) => f.endsWith('.js')).sort()) {
  const mod = await import(pathToFileURL(path.join(apiDir, file)).href);
  if (typeof mod.path !== 'string' || !/^[a-z0-9-]+$/.test(mod.path) || !mod.router) {
    throw new Error(`src/api/${file} must export \`path\` (lowercase-with-dashes) and \`router\``);
  }
  app.use(`/api/${mod.path}`, mod.router);
}
app.use('/api', (_req, res) => res.status(404).json({ error: 'not found' }));

// Every static file is served `no-cache`: browsers may keep a copy but must
// revalidate it (a cheap 304 via ETag) once per page load. Without an
// explicit header, Cloudflare stamps JS/CSS with a 4-hour browser cache, so
// after a merge people would keep running the old views for hours. A `?v=`
// hash scheme would need an import map or a build step to reach the
// ES-module imports. That's not worth it for a small prototype that changes
// often.
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res) => res.set('Cache-Control', 'no-cache'),
}));

// Last-resort error handler: log it, never leak stack traces to users.
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'bad request body' });
  }
  res.status(500).json({ error: 'something went wrong' });
});

const server = app.listen(PORT, () => {
  console.log(`ultimate-finder listening on :${PORT}`);
});

// Exit promptly on `docker stop` so deploys and rollbacks are quick.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => prisma.$disconnect().finally(() => process.exit(0))));
}
