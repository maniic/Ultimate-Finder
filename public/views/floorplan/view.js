// Owner: (your name here)
// VIEW: Floor plan. Browse a building floor by floor, see the destination
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
import { getBuilding, getFacility, getRoom, getRoute, facilityTypeName, FLOORS } from '/js/data.js';
import { getBahenBackground } from '/js/bahen.js';
import { drawPlan, legend } from '/js/floorplan.js';

export const title = 'Floor plan';

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  if (!building || !FLOORS[building.code]) {
    append(root, backLink(nav.href('search')), h('p', null, `No floor plans yet for ${building ? building.name : 'that building'}.`));
    return;
  }
  const floors = Object.keys(FLOORS[building.code]).map(Number).sort((a, b) => a - b);
  const facility = getFacility(building.code, params.fac);
  const room = !params.fac && getRoom(building.code, params.r);
  const destination = facility || room;
  const destinationId = facility?.id || room?.number;
  if (params.f && !floors.includes(Number(params.f))) {
    append(root, backLink(nav.href('search'), 'Search'),
      h('p', null, `No floor plan for ${building.code} floor ${params.f} yet. Plans so far: floors ${floors.join(', ')}.`));
    return;
  }
  const floor = params.f ? Number(params.f) : (destination?.floor ?? floors[0]);
  const items = FLOORS[building.code][floor];

  const background = getBahenBackground(building.code, floor);
  const variant = params.stepfree === '1' ? 'stepfree' : 'standard';
  const route = destinationId && getRoute(building.code, destinationId, variant);
  const resume = Number(params.resume);
  const routeStep = facility && route && Number.isInteger(resume) && resume > 1 && resume <= route.steps.length ? resume : 1;
  let path;
  const target = room && room.floor === floor && items.find((i) => i.id === room.number);
  const elevator = items.find((i) => i.id === 'elev-ab');
  if (background && route) {
    path = route?.steps.filter((step) => step.floor === floor).map((step) => step.at);
  } else if (target && elevator) {
    const cy = 30; // corridor centre line in the mock grid
    path = [[elevator.x + elevator.w / 2, elevator.y + elevator.h], [elevator.x + elevator.w / 2, cy], [target.x + target.w / 2, cy], [target.x + target.w / 2, target.y]];
  }

  const keep = { b: building.code, r: room?.number, fac: facility?.id, stepfree: params.stepfree };
  const infoText = facility
    ? (facility.floor === floor ? facility.near : `${facility.label || facilityTypeName(facility.type)} is on floor ${facility.floor}.`)
    : room ? (room.floor === floor ? `${room.number} is highlighted.` : `${room.number} is on floor ${room.floor}.`) : 'Tap a room or facility.';
  const info = h('p', { class: 'muted small', role: 'status' }, infoText);
  const facilityLinks = items.filter((item) => item.facility).map((item) => h('a', {
    class: 'chip', 'aria-current': item.id === destinationId ? 'true' : undefined,
    href: nav.href('floorplan', { b: building.code, fac: item.id, f: floor, stepfree: params.stepfree,
      resume: item.id === destinationId && routeStep > 1 ? routeStep : undefined }),
  }, item.name));
  const plan = drawPlan(items, {
    highlight: destinationId, path, background,
    onSelect: (it) => {
      if (it.facility) nav.go('floorplan', { b: building.code, fac: it.id, f: floor, stepfree: params.stepfree,
        resume: it.id === destinationId && routeStep > 1 ? routeStep : undefined });
      else info.textContent = `${it.name || it.label || it.id}${it.kind !== 'room' ? ` (${it.kind})` : ''}`;
    },
  });

  append(root, 
    destination ? backLink(nav.href('preview', keep), 'Route preview') : backLink(nav.href('search'), 'Search'),
    h('div', null, h('h1', null, `${building.code} · Floor ${floor}`),
      h('p', { class: 'muted' }, facility ? facility.label || facilityTypeName(facility.type) : building.name)),
    h('div', { class: 'chips floor-tabs', role: 'group', 'aria-label': 'Floor' },
      floors.map((f) => h('a', { class: 'chip', href: nav.href('floorplan', { ...keep, f, resume: routeStep > 1 ? routeStep : undefined }), 'aria-current': f === floor ? 'page' : null }, `Floor ${f}`))),
    building.numberingNote ? h('p', { class: 'notice small' }, building.numberingNote) : null,
    plan,
    info,
    facility?.floor === floor && facility.approximate ? h('p', { class: 'muted small' }, 'Approximate location. Check nearby signs.') : null,
    route || room ? h('a', { class: 'btn btn-primary', href: nav.href('navigate', { ...keep, step: routeStep }) },
      routeStep > 1 ? 'Continue route' : 'Start route') : null,
    facilityLinks.length ? h('div', { class: 'chips map-facilities', role: 'group', 'aria-label': 'Facilities on this floor' }, facilityLinks) : null,
    h('details', { class: 'card' }, h('summary', null, 'Map legend'), legend({ reference: Boolean(background) })),
  );
}
