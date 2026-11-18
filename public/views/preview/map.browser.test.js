// Browser tests for the outdoor map on Route preview. Run: npm test
//
// Serves public/ from a throwaway static server (no database needed), and
// replaces the Google Maps script with a small fake, so no key or network is
// used. Needs the `playwright` dev dependency and its Chromium
// (`npx playwright install chromium` once, if you don't have it).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PUBLIC = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const ROBARTS = { latitude: 43.66443, longitude: -79.39915 };
const ENTRANCE_B = '43.66823,-79.39905';
const ENTRANCE_A = '43.66846,-79.39848';

let server; let base; let browser;

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/buildings')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ buildings: [
        { code: 'OI', name: 'OISE · Ontario Institute for Studies in Education', enabled: true },
        { code: 'GB', name: 'Galbraith Building', enabled: false },
      ] }));
      return;
    }
    const file = normalize(join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((r) => server.close(r));
});

// A stand-in for google.maps with just what map.js uses. Records calls on
// window.__fake so tests can check them.
const FAKE_MAPS = `
  window.__fake = { routeRequests: [], markers: [], maps: 0 };
  class LatLngBounds { extend() { return this; } }
  // Same split as the real API: LatLngBounds is in 'core', not 'maps'.
  const libs = {
    core: { LatLngBounds },
    maps: {
      Map: class { constructor(el) { window.__fake.maps++; el.dataset.fakeMap = '1'; }
        fitBounds() {} panTo() {} setCenter() {} setZoom() {} },
    },
    marker: {
      AdvancedMarkerElement: class { constructor(o) { Object.assign(this, o); window.__fake.markers.push(this); } },
    },
    routes: {
      Route: { async computeRoutes(req) {
        window.__fake.routeRequests.push(JSON.parse(JSON.stringify(req)));
        return { routes: [{
          distanceMeters: 640, durationMillis: 8 * 60000, path: [],
          legs: [{ steps: [{ instructions: 'Head north on St. George St' }, { instructions: 'Turn left onto Bloor St W' }] }],
          createPolylines() { return [{ setMap() {} }]; },
        }] };
      } },
    },
  };
  window.google = { maps: { importLibrary: async (n) => libs[n] } };
  const cb = new URL(document.currentScript.src).searchParams.get('callback');
  if (cb && window[cb]) window[cb]();
`;

async function open(path, { key = 'test-key', geo = 'none', mapsScript = 'fake', viewport } = {}) {
  const context = await browser.newContext({
    viewport: viewport || { width: 390, height: 844 },
    ...(geo === 'granted' ? { permissions: ['geolocation'], geolocation: ROBARTS } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let mapsRequests = 0;
  await page.route('https://maps.googleapis.com/**', (route) => {
    mapsRequests++;
    if (mapsScript === 'fail') return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: FAKE_MAPS });
  });
  // "No key" means no committed key either.
  if (!key) {
    await page.route('**/js/config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: "export const GOOGLE_MAPS_API_KEY = '';" }));
  }
  await page.addInitScript(([k, g]) => {
    if (k) localStorage.setItem('uf.mapsKey', k);
    if (g === 'denied') {
      navigator.geolocation.getCurrentPosition = (_ok, err) => setTimeout(() => err({ code: 1, message: 'denied' }), 10);
      navigator.geolocation.watchPosition = (_ok, err) => { setTimeout(() => err({ code: 1, message: 'denied' }), 10); return 1; };
    }
    if (g === 'fix-then-timeout') {
      navigator.geolocation.watchPosition = (ok, err) => {
        setTimeout(() => ok({ coords: { latitude: 43.66443, longitude: -79.39915, accuracy: 10 } }), 10);
        setTimeout(() => err({ code: 3, message: 'timeout' }), 300);
        return 1;
      };
      navigator.geolocation.clearWatch = () => { window.__cleared = (window.__cleared || 0) + 1; };
    }
  }, [key, geo]);
  await page.goto(`${base}/${path}`);
  return { page, context, errors, mapsRequests: () => mapsRequests };
}

test('no key: shows a fallback card with an Open in Google Maps link, and loads no script', async () => {
  const { page, context, errors, mapsRequests } = await open('#/preview?b=OI&r=10-210', { key: '' });
  const link = page.getByRole('link', { name: /open in google maps/i });
  await link.waitFor();
  const href = new URL(await link.getAttribute('href'));
  assert.equal(href.searchParams.get('destination'), ENTRANCE_B);
  assert.equal(href.searchParams.get('travelmode'), 'walking');
  assert.equal(mapsRequests(), 0);
  assert.equal(await page.locator('[data-fake-map]').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('with a key: draws the map with the entrance the indoor route starts from', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&r=10-210');
  await page.locator('[data-fake-map]').waitFor();
  await page.getByText('Entrance B', { exact: false }).first().waitFor();
  assert.ok(await page.evaluate(() => window.__fake.markers.length) >= 1);
  assert.equal(await page.locator('.photo-placeholder').count(), 0, 'placeholder replaced');
  assert.deepEqual(errors, []);
  await context.close();
});

test('asks for location only on tap, then shows live walking directions', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&r=10-210', { geo: 'granted' });
  await page.locator('[data-fake-map]').waitFor();
  assert.equal(await page.evaluate(() => window.__fake.routeRequests.length), 0);
  await page.getByRole('button', { name: /directions from my location/i }).click();
  await page.getByText('640 m').waitFor();
  const req = (await page.evaluate(() => window.__fake.routeRequests))[0];
  assert.equal(req.travelMode, 'WALKING');
  assert.deepEqual(req.origin, { lat: ROBARTS.latitude, lng: ROBARTS.longitude });
  assert.equal(`${req.destination.lat},${req.destination.lng}`, ENTRANCE_B);
  assert.ok(await page.getByText('8 min').first().isVisible());
  await page.getByText(/show steps/i).click();
  assert.ok(await page.getByText('Turn left onto Bloor St W').isVisible());
  const gm = new URL(await page.getByRole('link', { name: /open in google maps/i }).getAttribute('href'));
  assert.equal(gm.searchParams.get('origin'), `${ROBARTS.latitude},${ROBARTS.longitude}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('location denied: explains it and offers start points instead', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&r=10-210', { geo: 'denied' });
  await page.locator('[data-fake-map]').waitFor();
  await page.getByRole('button', { name: /directions from my location/i }).click();
  await page.getByText(/location is off/i).waitFor();
  await page.getByLabel(/starting from/i).selectOption({ label: 'Robarts Library' });
  await page.getByText('640 m').waitFor();
  const req = (await page.evaluate(() => window.__fake.routeRequests))[0];
  assert.deepEqual(req.origin, { lat: 43.66443, lng: -79.39915 });
  assert.deepEqual(errors, []);
  await context.close();
});

test('step-free on: routes to the step-free entrance', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-210&stepfree=1', { geo: 'granted' });
  await page.getByRole('button', { name: /directions from my location/i }).click();
  await page.getByText('640 m').waitFor();
  const req = (await page.evaluate(() => window.__fake.routeRequests))[0];
  assert.equal(`${req.destination.lat},${req.destination.lng}`, ENTRANCE_A);
  await context.close();
});

test('a building with no indoor data (Bahen) still gets directions to its entrance', async () => {
  const { page, context, errors } = await open('#/preview?b=BA&r=1170', { geo: 'granted' });
  await page.getByRole('heading', { name: 'BA 1170' }).waitFor();
  await page.getByText(/indoor directions .* aren.t ready/i).waitFor();
  assert.equal(await page.getByRole('link', { name: /start route/i }).count(), 0);
  await page.getByRole('button', { name: /directions from my location/i }).click();
  await page.getByText('640 m').waitFor();
  const req = (await page.evaluate(() => window.__fake.routeRequests))[0];
  assert.equal(`${req.destination.lat},${req.destination.lng}`, '43.65957,-79.39744');
  assert.deepEqual(errors, []);
  await context.close();
});

test('a facility opens the same map, routed to its building', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&fac=f1');
  await page.getByRole('heading', { name: /bottle filler/i }).waitFor();
  await page.locator('[data-fake-map]').waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('a building with no coordinates links to a Google Maps search by name', async () => {
  const { page, context, errors } = await open('#/preview?b=GB');
  const link = page.getByRole('link', { name: /find it in google maps/i });
  await link.waitFor();
  assert.match(await link.getAttribute('href'), /maps\/search\/.*Galbraith/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an unknown building shows a clear message', async () => {
  const { page, context, errors } = await open('#/preview?b=ZZ&r=1');
  await page.getByText(/couldn.t find that building/i).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test('the maps script failing to load falls back to the link', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-210', { mapsScript: 'fail' });
  await page.getByText(/map couldn.t load/i).waitFor();
  assert.ok(await page.getByRole('link', { name: /open in google maps/i }).isVisible());
  await context.close();
});

test('facilitator simulator: walking closer ends in an arrival prompt that continues inside', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&r=10-210&sim=1');
  await page.locator('[data-fake-map]').waitFor();
  await page.getByLabel(/pretend i.m at/i).selectOption({ label: 'Robarts Library' });
  await page.getByText('640 m').waitFor();
  const walk = page.getByRole('button', { name: /walk 50 m closer/i });
  for (let i = 0; i < 20 && !(await page.getByText(/you.re at entrance b/i).isVisible()); i++) await walk.click();
  await page.getByText(/you.re at entrance b/i).waitFor();
  const cont = page.getByRole('link', { name: /continue inside/i });
  assert.match(await cont.getAttribute('href'), /#\/navigate\?b=OI&r=10-210.*step=1/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('the simulator is hidden unless ?sim=1', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-210');
  await page.locator('[data-fake-map]').waitFor();
  assert.equal(await page.getByLabel(/pretend i.m at/i).count(), 0);
  await context.close();
});

test('full-screen map opens and closes', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-210');
  await page.locator('[data-fake-map]').waitFor();
  await page.getByRole('button', { name: /full screen/i }).click();
  assert.ok(await page.locator('.map-expanded').isVisible());
  await page.getByRole('button', { name: /close map/i }).click();
  assert.equal(await page.locator('.map-expanded').count(), 0);
  await context.close();
});

test('fits a phone screen with no sideways scroll', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-210', { viewport: { width: 360, height: 740 } });
  await page.locator('[data-fake-map]').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `overflows by ${overflow}px`);
  await context.close();
});

test('an unknown room in a building with indoor data says so', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&r=99-999');
  await page.getByText(/couldn.t find room 99-999/i).waitFor();
  assert.equal(await page.getByText(/aren.t ready yet/i).count(), 0);
  assert.equal(await page.locator('[data-fake-map]').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('an unknown facility says so instead of silently showing the building', async () => {
  const { page, context } = await open('#/preview?b=BA&fac=f1');
  await page.getByText(/couldn.t find that facility/i).waitFor();
  await context.close();
});

test('leaving the page while the map is full screen does not lock scrolling elsewhere', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-210');
  await page.locator('[data-fake-map]').waitFor();
  await page.getByRole('button', { name: /full screen/i }).click();
  assert.equal(await page.evaluate(() => document.body.classList.contains('map-open')), true);
  await page.evaluate(() => { location.hash = '#/search'; });
  await page.waitForFunction(() => !document.querySelector('.view-preview'));
  assert.equal(await page.evaluate(() => document.body.classList.contains('map-open')), false);
  await context.close();
});

test('a location timeout after the first fix keeps live tracking and the route', async () => {
  const { page, context, errors } = await open('#/preview?b=OI&r=10-210', { geo: 'fix-then-timeout' });
  await page.locator('[data-fake-map]').waitFor();
  await page.getByRole('button', { name: /directions from my location/i }).click();
  await page.getByText('640 m').waitFor();
  await page.waitForTimeout(500);
  assert.ok(await page.getByText('640 m').isVisible());
  assert.equal(await page.getByText(/took too long/i).count(), 0);
  assert.equal(await page.evaluate(() => window.__cleared || 0), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('without an indoor route, the summary names the same entrance the map routes to', async () => {
  const { page, context } = await open('#/preview?b=OI&sim=1');
  await page.locator('[data-fake-map]').waitFor();
  await page.getByLabel(/pretend i.m at/i).selectOption({ label: 'St. George subway station' });
  await page.getByText('640 m').waitFor();
  const status = await page.locator('.map-status').innerText();
  const entrance = await page.locator('.facts div:nth-child(2) dd').innerText();
  assert.ok(status.includes(entrance), `status "${status}" vs summary "${entrance}"`);
  assert.equal(entrance, 'Entrance B'); // St. George station is next to the Bedford Rd side
  await context.close();
});

test('a known room without indoor steps says indoor directions are not ready', async () => {
  const { page, context } = await open('#/preview?b=OI&r=10-200');
  await page.locator('[data-fake-map]').waitFor();
  await page.getByText(/indoor directions .* aren.t ready/i).waitFor();
  assert.equal(await page.getByRole('link', { name: /start route/i }).count(), 0);
  await context.close();
});
