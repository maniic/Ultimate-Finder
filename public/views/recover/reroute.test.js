// Tests for reroute.js (where a lost user rejoins their route).
// Run: node --test public/views/recover/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, ROUTES } from '../../js/data.js';
import { pickVariant, spotsFor, findSpot, findRoomSign, rejoin } from './reroute.js';

const OI = 'OI';
const spot = (key) => findSpot(OI, key);

test('pickVariant: blocked or already-blocked routes use blockedElevator, else step-free or standard', () => {
  assert.equal(pickVariant({}), 'standard');
  assert.equal(pickVariant({ stepfree: '1' }), 'stepfree');
  assert.equal(pickVariant({ why: 'blocked' }), 'blockedElevator');
  assert.equal(pickVariant({ alt: 'blockedElevator', stepfree: '1' }), 'blockedElevator');
  assert.equal(pickVariant({ alt: 'constructor' }), 'standard', 'unknown alt is ignored');
});

test('spotsFor lists recognisable places on every floor with a plan, each with a photo caption', () => {
  const spots = spotsFor(OI);
  assert.ok(spots.length >= 8);
  for (const s of spots) {
    assert.ok(FLOORS.OI[s.floor], `floor ${s.floor} has a plan`);
    assert.ok(s.name && s.see, `${s.key} has a name and a caption`);
    assert.equal(s.at.length, 2);
  }
  assert.deepEqual([...new Set(spots.map((s) => s.floor))].sort((a, b) => a - b), [1, 10]);
  assert.ok(spots.every((s) => s.id !== 'corridor'));
  assert.equal(new Set(spots.map((s) => s.key)).size, spots.length, 'keys are unique');
  assert.deepEqual(spotsFor('ZZ'), []);
});

test('findSpot rejects junk keys', () => {
  assert.equal(findSpot(OI, undefined), undefined);
  assert.equal(findSpot(OI, '10:nope'), undefined);
  assert.equal(findSpot(OI, '10:corridor'), undefined);
  assert.equal(findSpot(OI, 'constructor'), undefined);
  assert.equal(findSpot('ZZ', '1:lobby'), undefined);
  assert.equal(spot('1:lobby').name, 'Main lobby');
});

test('findRoomSign matches what is printed on a door plate, loosely', () => {
  assert.equal(findRoomSign(OI, '10-212')?.key, '10:10-212');
  assert.equal(findRoomSign(OI, ' 10 212 ')?.key, '10:10-212');
  assert.equal(findRoomSign(OI, '10212')?.key, '10:10-212');
  assert.equal(findRoomSign(OI, '9-999'), undefined);
  assert.equal(findRoomSign(OI, ''), undefined);
  assert.equal(findRoomSign(OI, 'Stairs'), undefined, 'only rooms, not other labels');
});

test('rejoin: from the main lobby, the standard route picks up at "walk to the elevators"', () => {
  const r = rejoin(OI, '10-210', spot('1:lobby'), 'standard');
  assert.equal(r.variant, 'standard');
  assert.equal(r.step, 2);
  assert.match(r.toward, /lobby desk/i);
});

test('rejoin: never sends someone who is inside back to the entrance step', () => {
  const r = rejoin(OI, '10-210', spot('1:lobby'), 'stepfree');
  assert.equal(r.step, 2);
  const west = rejoin(OI, '10-210', spot('1:stairs-w'), 'standard');
  assert.equal(west.step, 2);
});

test('rejoin: standing at the entrance the route uses starts at step 1', () => {
  assert.equal(rejoin(OI, '10-210', spot('1:ent-b'), 'standard').step, 1);
});

test('rejoin: by the elevators on floor 10, continue with "exit and turn right"', () => {
  const r = rejoin(OI, '10-210', spot('10:elev-ab'), 'standard');
  assert.equal(r.step, 4);
  assert.equal(r.floor, 10);
});

test('rejoin: past the turn (by the washroom), go straight to the arrival step', () => {
  const r = rejoin(OI, '10-210', spot('10:wr'), 'standard');
  assert.equal(r.step, 5);
});

test('rejoin: elevator blocked and lost in the lobby, head to Elevator C first', () => {
  const r = rejoin(OI, '10-210', spot('1:lobby'), 'blockedElevator');
  assert.equal(r.variant, 'blockedElevator');
  assert.equal(r.step, 1);
  const atC = rejoin(OI, '10-210', spot('1:elev-c'), 'blockedElevator');
  assert.equal(atC.step, 2);
});

test('rejoin: the path on the plan runs from you to the rest of the route on this floor', () => {
  const s = spot('1:lobby');
  const r = rejoin(OI, '10-210', s, 'standard');
  const steps = ROUTES['OI:10-210'].standard.steps;
  assert.deepEqual(r.path, [s.at, steps[1].at, steps[2].at]);
});

test('rejoin: standing at the destination says so instead of routing', () => {
  const r = rejoin(OI, '10-210', spot('10:10-210'), 'standard');
  assert.equal(r.arrived, true);
});

test('rejoin: no route or no steps on that floor returns undefined', () => {
  assert.equal(rejoin(OI, '10-999', spot('1:lobby'), 'standard'), undefined);
  assert.equal(rejoin(OI, '10-210', undefined, 'standard'), undefined);
  assert.equal(rejoin(OI, '10-210', { key: '5:x', floor: 5, at: [1, 1] }, 'standard'), undefined);
});
