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

app.use(express.static(path.join(__dirname, '..', 'public')));

const server = app.listen(PORT, () => {
  console.log(`ultimate-finder listening on :${PORT}`);
});

// Exit promptly on `docker stop` so deploys and rollbacks are quick.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
