// VIEW: Floor plan. Browse a building floor by floor, see the destination
// Owner: (your name here)
// highlighted and the route from the elevator, and tap rooms/facilities.
// Prototype Fig. 2c ("Show floor plan"); design concept 3.
// In:  #/floorplan?b=OI&f=10[&r=10-210][&stepfree=1]
// Out: #/navigate?b&r&stepfree&step=1
//
// TODO (from the evaluation):
//  - HE3: the legend is here now; check its symbols make sense to testers.
//  - Real plans (see "St. George Campus Floor-Plan Atlas.pdf"), not the
//    abstract grid in data.js. Consider an image + clickable hotspots.
//  - Pinch/zoom and pan on phones.

import { h, append, backLink } from '/js/ui.js';
import { getBuilding, getRoom, FLOORS } from '/js/data.js';
import { drawPlan, legend } from '/js/floorplan.js';

export const title = 'Floor plan';

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  if (!building || !FLOORS[building.code]) {
    append(root, backLink(nav.href('search')), h('p', null, `No floor plans yet for ${building ? building.name : 'that building'}.`));
    return;
  }
  const floors = Object.keys(FLOORS[building.code]).map(Number).sort((a, b) => a - b);
  const room = getRoom(building.code, params.r);
  if (params.f && !floors.includes(Number(params.f))) {
    append(root, backLink(nav.href('search'), 'Search'),
      h('p', null, `No floor plan for ${building.code} floor ${params.f} yet. Plans so far: floors ${floors.join(', ')}.`));
    return;
  }
  const floor = params.f ? Number(params.f) : (room ? room.floor : floors[0]);
  const items = FLOORS[building.code][floor];

  // Route on the destination floor: from the elevator, along the corridor, to the door.
  let path;
  const target = room && room.floor === floor && items.find((i) => i.id === room.number);
  const elevator = items.find((i) => i.id === 'elev-ab');
  if (target && elevator) {
    const cy = 30; // corridor centre line in the mock grid
    path = [[elevator.x + elevator.w / 2, elevator.y + elevator.h], [elevator.x + elevator.w / 2, cy], [target.x + target.w / 2, cy], [target.x + target.w / 2, target.y]];
  }

  const info = h('p', { class: 'muted small', role: 'status' }, room && room.floor === floor ? `${room.number} is highlighted.` : room ? `${room.number} is on floor ${room.floor}.` : 'Tap a room or facility.');
  const plan = drawPlan(items, {
    highlight: room?.number, path,
    onSelect: (it) => { info.textContent = `${it.name || it.label || it.id}${it.kind !== 'room' ? ` (${it.kind})` : ''}`; },
  });

  const keep = { b: building.code, r: room?.number, stepfree: params.stepfree };
  append(root, 
    room ? backLink(nav.href('preview', keep), 'Route preview') : backLink(nav.href('search'), 'Search'),
    h('div', null, h('h1', null, `${building.code} · Floor ${floor}`), h('p', { class: 'muted' }, building.name)),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Floor' },
      floors.map((f) => h('a', { class: 'chip', href: nav.href('floorplan', { ...keep, f }), 'aria-current': f === floor ? 'page' : null }, `Floor ${f}`))),
    building.numberingNote ? h('p', { class: 'notice small' }, building.numberingNote) : null,
    plan,
    info,
    h('details', { class: 'card' }, h('summary', null, 'Map legend'), legend()),
    room ? h('a', { class: 'btn btn-primary', href: nav.href('navigate', { ...keep, step: 1 }) }, 'Start route') : null,
  );
}
