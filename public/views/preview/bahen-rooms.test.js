import assert from 'node:assert/strict';
import test from 'node:test';
import { FLOORS, ROOMS, getRoute } from '../../js/data.js';

test('each Bahen room ends at a door on its own floor, beside its highlighted outline', () => {
  assert.ok(ROOMS.BA.length >= 25);
  for (const { number, floor } of ROOMS.BA) {
    const box = FLOORS.BA[floor].find((item) => item.id === number);
    assert.ok(box, `BA ${number} is drawn on floor ${floor}`);
    const end = getRoute('BA', number).steps.at(-1);
    assert.equal(end.floor, floor, `BA ${number} ends on its floor`);
    const [x, y] = end.at;
    // Map units (15 plan pixels each). Some doors open off a short passage or
    // vestibule up to about 50 plan pixels from the room's outline.
    const near = 4;
    assert.ok(x >= box.x - near && x <= box.x + box.w + near && y >= box.y - near && y <= box.y + box.h + near,
      `BA ${number} door is beside its outline`);
  }
});
