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
  const anchor = page.locator('.anchor');
  assert.match(await anchor.innerText(), /Starting from: Entrance A/);
  assert.ok(await anchor.getByRole('link', { name: 'Choose starting point', exact: true }).isVisible());
  assert.ok(await anchor.evaluate((card) => {
    const map = card.parentElement.querySelector('svg.plan');
    return map && card.getBoundingClientRect().bottom <= map.getBoundingClientRect().top;
  }), 'the starting point control is above the map');
  const first = page.locator('.results li').first();
  assert.match(await first.textContent(), /Floor 1 \(your floor\).*1 min walk.*Nearest.*Main lobby/);
  assert.match(await page.locator('.results li').nth(1).textContent(), /Floor 5 · 4 floors up.*8 min walk/);
  assert.equal(await page.locator('svg.plan .plan-marker').count(), 1, 'you-are-here on the floor-1 mini map');
  // The nearest one is out of order, so point to the nearest working one.
  assert.ok(await page.getByText('The nearest one is out of order. The nearest working one is on floor 10, 9 min walk.').isVisible());
  assert.deepEqual(errors, []);
  await context.close();
});

test('change where you are to room 10-210: the floor-10 filler moves to the top', async () => {
  const { page, context, errors } = await open('#/facilities?b=OI&type=bottle-filler');
  await page.getByRole('link', { name: 'Choose starting point', exact: true }).click();
  await page.getByRole('heading', { name: 'Where are you?' }).waitFor();
  assert.equal(await page.locator('[aria-current="true"]').textContent(), 'Entrance ABloor St W, by the bike racks · Step-free');
  await page.getByRole('link', { name: /Room 10-210/ }).click();
  await page.getByRole('heading', { name: 'Nearest bottle filler' }).waitFor();
  const p = hashParams(page);
  assert.equal(p.get('b'), 'OI');
  assert.equal(p.get('r'), '10-210');
  assert.equal(p.get('pick'), null);
  assert.match(await page.locator('.results li').first().textContent(), /Floor 10 \(your floor\).*1 min walk.*East of Elevators|washrooms/);
  assert.match(await page.locator('.anchor').innerText(), /Starting from: Room 10-210/);
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
    await page.getByRole('link', { name: 'Choose starting point', exact: true }).click();
    await page.waitForURL(/pick=1/);
    await page.getByRole('link', { name: /Entrance A/ }).waitFor();
    assert.deepEqual(errors, [], path);
    await context.close();
  }
});

test('already inside (a room): no outdoor map, the buttons go to the floor plan', async () => {
  const { page, context, errors } = await open('#/facilities?b=OI&r=10-210&type=bottle-filler');
  await page.getByRole('heading', { name: 'Nearest bottle filler' }).waitFor();
  const items = page.locator('.results li');
  assert.equal(await items.first().getByRole('link', { name: /Floor plan/ }).getAttribute('href'), '#/floorplan?b=OI&f=10');
  assert.equal(await page.getByRole('link', { name: /Walk there/ }).count(), 0);
  assert.equal(await items.nth(1).getByRole('link', { name: /Floor plan/ }).count(), 0, 'floor 5 has no plan yet');
  // The starting-point chooser returns to the same facility after changing the origin.
  await items.first().locator('.result-main').click();
  await page.getByRole('heading', { name: 'Bottle filler', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Show on floor plan' }).getAttribute('href'), '#/floorplan?b=OI&f=10');
  await page.getByRole('link', { name: 'Choose starting point', exact: true }).click();
  await page.waitForURL(/pick=1/);
  await page.getByRole('link', { name: /Entrance B/ }).click();
  await page.getByRole('heading', { name: 'Bottle filler', exact: true }).waitFor();
  const p = hashParams(page);
  assert.equal(p.get('id'), 'f1');
  assert.equal(p.get('e'), 'B');
  assert.equal(p.get('r'), null);
  assert.ok(await page.getByText('About 9 min walk from Entrance B.').isVisible());
  assert.equal(await page.getByRole('link', { name: /Walk there/ }).getAttribute('href'), '#/preview?b=OI&fac=f1');
  assert.deepEqual(errors, []);
  await context.close();
});

test('Bahen Walk there retains the selected room on both the list and the detail', async () => {
  const { page, context } = await open('#/facilities?b=BA&type=washroom&via=stairs');
  await page.getByRole('link', { name: 'Choose starting point', exact: true }).click();
  await page.getByRole('link', { name: /Room 2179/ }).click();
  const name = 'Washrooms by the east elevators · Floor 2';
  const result = page.locator('.results li').filter({ hasText: name });
  const walk = result.getByRole('link', { name: `Walk there: from Room 2179 to ${name}`, exact: true });
  await walk.waitFor();
  const href = await walk.getAttribute('href');
  const params = new URLSearchParams(href.split('?')[1]);
  assert.ok(href.startsWith('#/preview?'));
  assert.equal(params.get('from'), 'r:2179');
  assert.equal(params.get('fac'), 'ba-washrooms-east-2');
  assert.equal(params.get('via'), 'stairs');
  await result.locator('.result-main').click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
  const detailWalk = page.locator('.btn-row').getByRole('link', { name: `Walk there: from Room 2179 to ${name}`, exact: true });
  assert.equal(await detailWalk.getAttribute('href'), href);
  await context.close();
});

test('Bahen map-only facilities retain the selected floor separately from the map floor', async () => {
  const { page, context } = await open('#/facilities?b=BA&f=2&type=water-fountain&via=elevator');
  const result = page.locator('.results li').filter({ hasText: 'Water fountain near BA3285' });
  const map = result.getByRole('link', { name: /Floor plan/ });
  await map.waitFor();
  const href = await map.getAttribute('href');
  const params = new URLSearchParams(href.split('?')[1]);
  assert.ok(href.startsWith('#/floorplan?'));
  assert.equal(params.get('f'), '3');
  assert.equal(params.get('from'), 'f:2');
  assert.equal(params.get('fac'), 'ba-water-3');
  assert.equal(params.get('via'), 'elevator');
  assert.equal(await result.getByRole('link', { name: /Walk there/ }).count(), 0);
  await context.close();
});
