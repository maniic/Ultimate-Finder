import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITIES, FLOORS, ROOMS, getRoute } from './data.js';

test('an indoor route starts at the known room door and stays on the floor for a nearby facility', () => {
  const route = getRoute('BA', 'ba-microwave-2285', 'standard', 'r:2179');
  assert.equal(route.startLabel, 'BA 2179');
  assert.deepEqual(route.steps[0].at, [375 / 15, 635 / 15]);
  assert.ok(route.steps.every((step) => step.floor === 2));
  assert.ok(route.steps.every((step) => step.at[0] < 50), 'no detour to east elevators');
  assert.deepEqual(route.steps.at(-1).at, [572 / 15, 802 / 15]);
});

test('stairs and elevator use different connections for the same indoor origin and destination', () => {
  const elevator = getRoute('BA', 'ba-washroom-1108', 'standard', 'r:2179');
  const stairs = getRoute('BA', 'ba-washroom-1108', 'stairs', 'r:2179');
  assert.ok(elevator.steps.some((step) => step.text === 'Take the east elevator to floor 1.'));
  assert.ok(stairs.usesStairs);
  assert.deepEqual(stairs.stairStops, ['2290S', '1200S']);
  assert.ok(stairs.steps.some((step) => step.text === 'Exit the stairs at 1200S on floor 1.'));
  assert.ok(stairs.steps.every((step) => !step.text.startsWith('Take the east elevator')));
  assert.deepEqual(stairs.steps.at(-1).at, elevator.steps.at(-1).at);
});

test('stairs use the familiar main hall by default and the entrance-side stairs for the north corridor', () => {
  assert.deepEqual(getRoute('BA', '2179', 'stairs').stairStops, ['1200S', '2290S']);
  const route = getRoute('BA', '3200', 'stairs');
  assert.deepEqual(route.stairStops, ['1200S', '2290S', '2200S', '3200S']);
  assert.ok(route.steps.some((step) => step.floor === 2 && step.at[0] === 586 / 15 && step.at[1] === 716 / 15));
  assert.deepEqual(getRoute('BA', '3000', 'stairs').stairStops, ['1135S', '2130S', '3130S']);
});

test('both floor-two approaches to 2130S have their own map marker', () => {
  const stairs = FLOORS.BA[2].filter((item) => item.kind === 'stairs' && item.label === '2130S');
  assert.deepEqual(stairs.map(({ id, at }) => [id, at]), [
    ['stairs-2130S-to-1', [950 / 15, 652 / 15]],
    ['stairs-2130S-to-3', [1034 / 15, 652 / 15]],
  ]);
});

test('a floor anchor starts by that floor’s elevator landing, and unmapped anchors do not fall back', () => {
  assert.deepEqual(getRoute('BA', '3000', 'stairs', 'f:2').steps[0].at, [902 / 15, 535 / 15]);
  for (const from of ['f:4', 'r:9999', 'unknown']) {
    assert.equal(getRoute('BA', '3000', 'standard', from), undefined);
  }
  assert.equal(getRoute('BA', 'ba-water-2', 'standard', 'r:2179'), undefined);
  assert.equal(getRoute('OI', '10-210', 'standard', 'r:2179'), undefined);
});

test('every mapped Bahen destination remains reachable by both settings from each supported origin', () => {
  const destinations = [...ROOMS.BA.map(({ number }) => number),
    ...FACILITIES.filter(({ building, id }) => building === 'BA' && getRoute('BA', id)).map(({ id }) => id)];
  const origins = [undefined, 'f:1', 'f:2', 'f:3', ...ROOMS.BA.map(({ number }) => `r:${number}`)];
  for (const id of destinations) {
    const oldArrival = getRoute('BA', id).steps.at(-1);
    for (const from of origins) {
      for (const mode of ['standard', 'stairs']) {
        const route = getRoute('BA', id, mode, from);
        assert.ok(route, `${from || 'entrance'} to ${id} via ${mode}`);
        assert.deepEqual(route.steps.at(-1).at, oldArrival.at);
        assert.ok(route.steps.at(-1).arrival);
      }
    }
  }
});

test('each Bahen room ends at a door on its own floor, beside its highlighted outline', () => {
  assert.ok(ROOMS.BA.length >= 25);
  for (const { number, floor } of ROOMS.BA) {
    const box = FLOORS.BA[floor].find((item) => item.id === number);
    assert.ok(box, `BA ${number} is drawn on floor ${floor}`);
    const end = getRoute('BA', number).steps.at(-1);
    assert.equal(end.floor, floor, `BA ${number} ends on its floor`);
    const [x, y] = end.at;
    const near = 4; // map units: a door sits on, or just outside, the room's edge
    assert.ok(x >= box.x - near && x <= box.x + box.w + near && y >= box.y - near && y <= box.y + box.h + near,
      `BA ${number} door is beside its outline`);
  }
});
