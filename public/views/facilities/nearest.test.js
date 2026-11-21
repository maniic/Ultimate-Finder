// Tests for nearest.js ("nearest to what?" and walk-time ranking).
// Run: node --test public/views/facilities/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACILITIES } from '../../js/data.js';
import { resolveAnchor, anchorParams, walkMinutes, rankFacilities, anchorChoices, anchorBuildings, facilityBuildings } from './nearest.js';

const fac = (id) => FACILITIES.find((f) => f.id === id);
const ids = (list) => list.map((f) => f.id);

test('no b: anchors at the first building with facility data, not a hard-coded one', () => {
  const a = resolveAnchor({});
  assert.equal(a.b, facilityBuildings()[0]);
  assert.equal(a.kind, 'entrance');
  assert.equal(a.isDefault, true);
});

test('b only: starts at the first entrance, or the first step-free one when step-free is on', () => {
  assert.equal(resolveAnchor({ b: 'oi' }).e, 'A');
  assert.equal(resolveAnchor({ b: 'OI', stepfree: '1' }).e, 'A');
  const a = resolveAnchor({ b: 'OI' });
  assert.equal(a.floor, 1);
  assert.deepEqual(a.at, [46, 57.5]);
  assert.deepEqual(anchorParams(a), { b: 'OI' }, 'a default anchor adds nothing to the URL');
});

test('room, entrance and floor anchors resolve to a floor and a spot on the plan', () => {
  const room = resolveAnchor({ b: 'OI', r: '10-210' });
  assert.equal(room.kind, 'room');
  assert.equal(room.floor, 10);
  assert.deepEqual(room.at, [70, 44]);
  assert.equal(room.label, 'Room 10-210');
  assert.deepEqual(anchorParams(room), { b: 'OI', r: '10-210' });

  const ent = resolveAnchor({ b: 'OI', e: 'b' });
  assert.equal(ent.label, 'Entrance B');
  assert.deepEqual(ent.at, [2.5, 30]);
  assert.deepEqual(anchorParams(ent), { b: 'OI', e: 'B' });

  const floor = resolveAnchor({ b: 'OI', f: '5' });
  assert.equal(floor.floor, 5);
  assert.deepEqual(floor.at, [50, 17], 'a floor without a plan uses the elevator position from the others');
  assert.deepEqual(anchorParams(floor), { b: 'OI', f: '5' });
});

test('a room on the URL wins over an entrance or floor', () => {
  assert.equal(resolveAnchor({ b: 'OI', r: '10-210', e: 'B', f: '1' }).kind, 'room');
});

test('bad params give an error instead of a guess', () => {
  assert.equal(resolveAnchor({ b: 'ZZ' }).error, 'building');
  assert.equal(resolveAnchor({ b: 'constructor' }).error, 'building');
  assert.equal(resolveAnchor({ b: 'OI', r: '99-999' }).error, 'room');
  assert.equal(resolveAnchor({ b: 'OI', r: 'constructor' }).error, 'room');
  assert.equal(resolveAnchor({ b: 'OI', e: 'Z' }).error, 'entrance');
  for (const f of ['0', '13', '2.5', 'x', '-1']) assert.equal(resolveAnchor({ b: 'OI', f }).error, 'floor', f);
  assert.deepEqual(rankFacilities('bottle-filler', resolveAnchor({ b: 'ZZ' })), []);
  assert.deepEqual(anchorParams(resolveAnchor({ b: 'ZZ' })), {});
});

test('a known building without facility data anchors fine but ranks nothing', () => {
  const a = resolveAnchor({ b: 'SS' });
  assert.equal(a.error, undefined);
  assert.equal(a.kind, 'building');
  assert.deepEqual(rankFacilities('bottle-filler', a), []);
});

test('walkMinutes: same floor is a short walk, other floors add the elevator, other buildings are unknown', () => {
  const lobby = resolveAnchor({ b: 'OI' });
  assert.equal(walkMinutes(lobby, fac('f2')), 1, 'lobby bottle filler, same floor');
  assert.equal(walkMinutes(lobby, fac('f1')), 3, 'floor 10, via Elevators A/B');
  const room = resolveAnchor({ b: 'OI', r: '10-210' });
  assert.equal(walkMinutes(room, fac('f1')), 1);
  assert.equal(walkMinutes(room, fac('f2')), 4);
  assert.equal(walkMinutes(room, { ...fac('f1'), building: 'BA' }), null);
  assert.equal(walkMinutes(room, { ...fac('f1'), at: undefined }), null);
  for (const f of FACILITIES) assert.ok(walkMinutes(lobby, f) >= 1, f.id);
});

test('rankFacilities: nearest first from the anchor, so the order changes with where you are', () => {
  assert.deepEqual(ids(rankFacilities('bottle-filler', resolveAnchor({ b: 'OI' }))), ['f2', 'f1', 'f3'],
    'from the entrance: lobby first; f1 and f3 tie at 3 min and the working one wins');
  assert.deepEqual(ids(rankFacilities('bottle-filler', resolveAnchor({ b: 'OI', r: '10-210' }))), ['f1', 'f3', 'f2'],
    'from 10-210: the floor-10 filler first');
  const ranked = rankFacilities('bottle-filler', resolveAnchor({ b: 'OI' }));
  assert.ok(ranked.every((f) => Number.isInteger(f.walkMin)));
  assert.equal(fac('f2').walkMin, 3, 'the shared data is not changed');
  assert.deepEqual(rankFacilities('nope', resolveAnchor({ b: 'OI' })), []);
});

test('anchorChoices lists entrances, floors (with a plan or a facility) and rooms', () => {
  const c = anchorChoices('oi');
  assert.deepEqual(c.entrances.map((x) => x.e), ['A', 'B']);
  assert.deepEqual(c.floors.map((x) => x.f), ['1', '5', '7', '10']);
  assert.ok(c.rooms.some((x) => x.r === '10-210'));
  for (const f of c.floors) assert.equal(resolveAnchor({ b: 'OI', f: f.f }).error, undefined);
  for (const r of c.rooms) assert.equal(resolveAnchor({ b: 'OI', r: r.r }).error, undefined);
  assert.deepEqual(anchorChoices('ZZ'), { entrances: [], floors: [], rooms: [] });
});

test('anchorBuildings puts buildings with facility data first', () => {
  const list = anchorBuildings();
  assert.equal(list[0].code, 'OI');
  assert.equal(list[0].hasFacilities, true);
  assert.ok(list.slice(1).every((b) => !b.hasFacilities));
});
