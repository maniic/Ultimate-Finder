// Browser tests for "I don't know where I am" recovery. Run: npm test
// Serves public/ from a throwaway static server (no database needed).
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
  await page.goto(`${base}/${path}`);
  return { page, context, errors };
}

const hashParams = (page) => new URLSearchParams(new URL(page.url()).hash.split('?')[1] || '');

test('lost on step 3: pick the main lobby, see it on the plan, continue at step 2', async () => {
  const { page, context, errors } = await open('#/navigate?b=OI&r=10-210&step=3');
  await page.getByRole('link', { name: "This isn't what I see" }).click();
  await page.getByRole('link', { name: "I don't know where I am" }).click();
  await page.getByRole('heading', { name: 'Where are you now?' }).waitFor();
  assert.ok(await page.getByRole('link', { name: "I'm not sure where I am" }).isVisible());
  await page.getByRole('link', { name: /Main lobby/ }).click();
  await page.getByRole('heading', { name: "You're at Main lobby" }).waitFor();
  assert.equal(await page.locator('svg.plan .plan-marker').count(), 1);
  assert.equal(await page.locator('svg.plan .plan-path').count(), 1);
  assert.ok(await page.getByText(/lobby desk with the elevators/i).isVisible());
  await page.getByRole('link', { name: 'Start directions from here' }).click();
  await page.getByRole('heading', { name: 'Step 2 of 5' }).waitFor();
  assert.equal(hashParams(page).get('alt'), null);
  assert.deepEqual(errors, []);
  await context.close();
});

test("I'm not sure: type the door plate you can see and rejoin from there", async () => {
  const { page, context, errors } = await open('#/recover?b=OI&r=10-210&step=2&stage=unsure');
  await page.getByRole('heading', { name: 'What floor number is on the nearest sign?' }).waitFor();
  await page.getByLabel(/number on the nearest door plate/i).fill('10 212');
  await page.getByRole('button', { name: 'Find it' }).click();
  await page.getByRole('heading', { name: "You're at Room 10-212" }).waitFor();
  // The room is right here: guide them to it instead of a premature "You've arrived".
  await page.getByText(/10-210 is close by on this floor/).waitFor();
  assert.equal(await page.getByText(/on your right/).count(), 0);
  assert.equal(await page.getByRole('link', { name: 'Start directions from here' }).count(), 0);
  await page.getByRole('link', { name: 'I found 10-210: finish route' }).click();
  await page.waitForURL(/#\/search/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("I'm not sure: an unknown door plate explains itself and stays put", async () => {
  const { page, context, errors } = await open('#/recover?b=OI&r=10-210&step=2&stage=unsure');
  await page.getByLabel(/number on the nearest door plate/i).fill('<b>9-999</b>');
  await page.getByRole('button', { name: 'Find it' }).click();
  await page.getByRole('alert').getByText(/couldn't find "<b>9-999<\/b>"/).waitFor();
  assert.equal(hashParams(page).get('stage'), 'unsure');
  assert.equal(await page.locator('.notice b').count(), 0, 'typed text is never HTML');
  assert.deepEqual(errors, []);
  await context.close();
});

test("I'm not sure: answering the floor question narrows the photos to that floor", async () => {
  const { page, context } = await open('#/recover?b=OI&r=10-210&step=2&stage=unsure');
  await page.locator('.floor-pick').getByRole('link', { name: 'Floor 10' }).click();
  await page.getByRole('heading', { name: 'Where are you now?' }).waitFor();
  const floors = await page.locator('.choice .muted').allTextContents();
  assert.ok(floors.length > 0);
  assert.ok(floors.every((f) => f === 'Floor 10'), floors.join());
  await context.close();
});

test('a floor we have no plan for gets a way back, not a dead end', async () => {
  const { page, context } = await open('#/recover?b=OI&r=10-210&step=2&stage=unsure');
  await page.getByRole('link', { name: 'Another floor' }).click();
  await page.getByText(/take the elevator to floor 1/i).waitFor();
  await context.close();
});

test("can't see any sign: gives a way to find one", async () => {
  const { page, context } = await open('#/recover?b=OI&r=10-210&step=2&stage=unsure');
  await page.getByRole('link', { name: "I can't see any sign" }).click();
  await page.getByText(/every floor number is posted there/i).waitFor();
  await context.close();
});

test('elevator blocked: rejoin goes around it via Elevator C', async () => {
  const { page, context, errors } = await open('#/recover?b=OI&r=10-210&step=3');
  await page.getByRole('link', { name: 'Elevator or stairs are blocked' }).click();
  await page.getByRole('link', { name: /Main lobby/ }).click();
  await page.getByText('This route avoids the blocked elevator.').waitFor();
  await page.getByRole('link', { name: 'Start directions from here' }).click();
  await page.getByRole('heading', { name: 'Step 1 of 4' }).waitFor();
  assert.equal(hashParams(page).get('alt'), 'blockedElevator');
  assert.ok(await page.getByText(/Elevator C/).first().isVisible());
  assert.deepEqual(errors, []);
  await context.close();
});

test('step-free stays on after recovery', async () => {
  const { page, context } = await open('#/recover?b=OI&r=10-210&step=3&stepfree=1&stage=here&spot=1:lobby');
  await page.getByRole('link', { name: 'Start directions from here' }).click();
  await page.getByRole('heading', { name: 'Step 2 of 5' }).waitFor();
  assert.equal(hashParams(page).get('stepfree'), '1');
  await context.close();
});

test('standing at the destination room says you are there', async () => {
  const { page, context } = await open('#/recover?b=OI&r=10-210&step=2&stage=here&spot=10:10-210');
  await page.getByRole('heading', { name: "You're already there" }).waitFor();
  assert.ok(await page.getByRole('link', { name: 'Finish route' }).isVisible());
  await context.close();
});

test('junk params: unknown spot, unknown room, bad floor', async () => {
  const a = await open('#/recover?b=OI&r=10-210&stage=here&spot=constructor');
  await a.page.getByText("We don't know that place").waitFor();
  await a.page.goto(`${base}/#/recover?b=OI&r=10-200&step=1&stage=here&spot=1:lobby`);
  await a.page.getByText(/no indoor directions to 10-200 yet/i).waitFor();
  assert.ok(await a.page.getByRole('link', { name: /back/i }).first().isVisible());
  assert.deepEqual(a.errors, []);
  await a.context.close();
  const b = await open('#/recover?b=OI&r=99-999&stage=where');
  await b.page.getByText('Nothing to recover').waitFor();
  await b.context.close();
  const c = await open('#/recover?b=OI&r=10-210&stage=where&floor=__proto__');
  await c.page.getByRole('heading', { name: 'Where are you now?' }).waitFor();
  assert.ok(await c.page.locator('.choice').count() > 8, 'bad floor shows every floor');
  assert.deepEqual(c.errors, []);
  await c.context.close();
});
