// Browser tests for the facilities view ("nearest to what?" + Walk there).
// Run: npm test
// Needs the `playwright` dev dependency and its Chromium.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const PUBLIC = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

let server; let base; let browser;

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
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

async function open(path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Problem reports need the database; these tests don't.
  await page.route('**/api/facility-reports**', (r) => r.fulfill({ json: { reports: [] } }));
  await page.goto(`${base}/${path}`);
  return { page, context, errors };
}

const hashOf = (page) => new URL(page.url()).hash;
const hashParams = (page) => new URLSearchParams(hashOf(page).split('?')[1] || '');

test('from search (no b): anchored at the first entrance, nearest bottle filler first', async () => {
  const { page, context, errors } = await open('#/facilities?type=bottle-filler');
  await page.getByRole('heading', { name: 'Nearest bottle filler' }).waitFor();
  assert.ok(await page.locator('.anchor').getByText('Entrance A').isVisible());
  const first = page.locator('.results li').first();
  assert.match(await first.textContent(), /Floor 1 \(your floor\).*1 min walk.*Nearest.*Main lobby/);
  assert.match(await page.locator('.results li').nth(1).textContent(), /Floor 10 · 9 floors up.*3 min walk/);
  assert.equal(await page.locator('svg.plan .plan-marker').count(), 1, 'you-are-here on the floor-1 mini map');
  // The nearest one is out of order, so point to the nearest working one.
  assert.ok(await page.getByText('The nearest one is out of order. The nearest working one is on floor 10, 3 min walk.').isVisible());
  assert.deepEqual(errors, []);
  await context.close();
});

test('change where you are to room 10-210: the floor-10 filler moves to the top', async () => {
  const { page, context, errors } = await open('#/facilities?b=OI&type=bottle-filler');
  await page.getByRole('link', { name: /Change where you are/ }).click();
  await page.getByRole('heading', { name: 'Where are you?' }).waitFor();
  assert.equal(await page.locator('[aria-current="true"]').textContent(), 'Entrance ABloor St W, by the bike racks · Step-free');
  await page.getByRole('link', { name: /Room 10-210/ }).click();
  await page.getByRole('heading', { name: 'Nearest bottle filler' }).waitFor();
  const p = hashParams(page);
  assert.equal(p.get('b'), 'OI');
  assert.equal(p.get('r'), '10-210');
  assert.equal(p.get('pick'), null);
  assert.match(await page.locator('.results li').first().textContent(), /Floor 10 \(your floor\).*1 min walk.*East of Elevators|washrooms/);
  assert.ok(await page.locator('.anchor').getByText('Room 10-210').isVisible());
  // The anchor sticks when opening a facility and coming back.
  await page.locator('.results li .result-main').first().click();
  await page.getByText('About 1 min walk from Room 10-210.').waitFor();
  assert.equal(hashParams(page).get('r'), '10-210');
  assert.deepEqual(errors, []);
  await context.close();
});

test('Walk there opens the preview map for that facility, keeping step-free', async () => {
  const { page, context } = await open('#/facilities?b=OI&type=bottle-filler&stepfree=1');
  const walk = page.locator('.results li').first().getByRole('link', { name: /Walk there/ });
  assert.equal(await walk.getAttribute('href'), '#/preview?b=OI&fac=f2&stepfree=1');
  await page.locator('.results li .result-main').first().click();
  await page.getByRole('heading', { name: 'Bottle filler', exact: true }).waitFor();
  const detailWalk = page.getByRole('link', { name: /Walk there/ });
  assert.equal(await detailWalk.getAttribute('href'), '#/preview?b=OI&fac=f2&stepfree=1');
  await detailWalk.click();
  await page.getByRole('heading', { name: 'Bottle filler', exact: true }).waitFor();
  await page.waitForURL(/#\/preview\?b=OI&fac=f2/);
  await context.close();
});

test('honours ?b=: a building without facility data says so instead of showing OISE', async () => {
  const { page, context, errors } = await open('#/facilities?b=SS&type=bottle-filler');
  await page.getByText(/No bottle fillers in Sidney Smith Hall in our data yet/).waitFor();
  assert.equal(await page.locator('.results').count(), 0);
  assert.equal(await page.getByText(/OISE/).count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('unknown building, room or floor: says so and offers the chooser', async () => {
  for (const [path, msg] of [
    ['#/facilities?b=ZZ&type=bottle-filler', "We couldn't find that building."],
    ['#/facilities?b=OI&r=99-999&type=bottle-filler', "We couldn't find room 99-999 in OISE."],
    ['#/facilities?b=OI&f=40', 'OISE has no floor "40".'],
  ]) {
    const { page, context, errors } = await open(path);
    await page.getByText(msg).waitFor();
    await page.getByRole('link', { name: 'Choose where you are' }).click();
    await page.waitForURL(/pick=1/);
    await page.getByRole('link', { name: /Entrance A/ }).waitFor();
    assert.deepEqual(errors, [], path);
    await context.close();
  }
});
