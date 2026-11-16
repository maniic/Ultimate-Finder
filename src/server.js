'use strict';

const path = require('path');
const express = require('express');

const PORT = Number(process.env.PORT) || 3000;
const app = express();

app.disable('x-powered-by');

// Deploy contract: the auto-deploy health check calls this. It must return
// 200 once the app is ready to serve, or the deploy is rolled back.
// Keep it cheap and dependency-free.
app.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

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

const server = app.listen(PORT, () => {
  console.log(`ultimate-finder listening on :${PORT}`);
});

// Exit promptly on `docker stop` so deploys and rollbacks are quick.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
