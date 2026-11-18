// Owner: Abdullah
// VIEW: Route preview. Walking directions to the building entrance (live
// Google map), plus best entrance, walk time, floor and the step-free switch.
// Prototype Fig. 2c.
// In:  #/preview?b=OI&r=10-210[&stepfree=1]   a room
//      #/preview?b=OI&fac=f1                  a facility (same map)
//      #/preview?b=BA                         just the building
//      add &sim=1 for the facilitator location simulator (usability tests)
// Out: #/floorplan?b&f&r  ·  #/navigate?b&r&stepfree&step=1
//
// The outdoor part lives in map.js (UI), outdoor.js (tested logic) and
// places.js (entrance coordinates). Nothing is specific to one building:
// the destination comes from the b/r/fac params.
//
// TODO (from the evaluation):
//  - HE1/HE4 + think-aloud finding 2: make the step-free option's meaning and
//    selected state obvious; say which entrance and route features it uses.
//  - Verify entrance coordinates in places.js on site.

import { h, append, backLink, minutes } from '/js/ui.js';
import { getBuilding, getRoom, getRoute, getEntrance, ENTRANCES, FACILITIES, facilityTypeName } from '/js/data.js';
import { outdoorMap } from './map.js';
import { chooseDestination, entrancesFor, searchUrl } from './outdoor.js';
import { PLACES } from './places.js';

export const title = 'Route preview';

// Buildings not in data.js (no indoor data yet) still have a name in the DB.
let buildingsPromise;
function apiBuilding(code) {
  buildingsPromise ??= fetch('/api/buildings')
    .then((res) => (res.ok ? res.json() : { buildings: [] }))
    .then((d) => d.buildings || [])
    .catch(() => { buildingsPromise = undefined; return []; });
  return buildingsPromise.then((list) => list.find((b) => b.code === code));
}

export function render(root, params, nav) {
  const code = String(params.b || '').toUpperCase();
  const body = h('div', { class: 'preview-body' });
  append(root, body);

  const known = getBuilding(code);
  if (known) { fill(body, known, params, nav); return; }
  if (!code) { notFound(body, nav); return; }
  body.append(h('p', { class: 'muted' }, 'Loading…'));
  apiBuilding(code).then((b) => {
    if (!body.isConnected) return; // the person already moved on
    body.replaceChildren();
    if (b) fill(body, { code: b.code, name: b.name }, params, nav);
    else notFound(body, nav);
  });
}

function notFound(body, nav) {
  append(body, backLink(nav.href('search')),
    h('p', null, "We couldn't find that building. Go back and search again."));
}

function fill(body, building, params, nav) {
  const stepFree = params.stepfree === '1';
  const sim = params.sim === '1';
  const facility = params.fac ? FACILITIES.find((f) => f.id === params.fac && f.building === building.code) : null;
  const room = !facility && params.r ? getRoom(building.code, params.r) : null;
  const route = room && getRoute(building.code, room.number, stepFree ? 'stepfree' : 'standard');
  const routeEntrance = route && getEntrance(building.code, route.entrance);

  const entrances = entrancesFor(building.code, ENTRANCES, PLACES);
  const dest = chooseDestination(entrances, { routeEntranceId: route?.entrance, stepFree });
  const keep = (extra) => ({ b: building.code, r: params.r, fac: params.fac, sim: sim ? '1' : undefined, ...extra });

  // Heading
  let heading; let sub = building.name;
  if (facility) {
    heading = facilityTypeName(facility.type);
    sub = `${building.name} · floor ${facility.floor} · ${facility.near}`;
  } else if (params.r) heading = `${building.code} ${params.r}`;
  else { heading = building.name; sub = null; }

  // Where "You're here" leads once outside the door
  let arrival = null;
  if (route) arrival = { href: nav.href('navigate', { b: building.code, r: room.number, stepfree: stepFree ? '1' : undefined, step: 1 }), label: 'Continue inside' };
  else if (facility && building.hasPlans) arrival = { href: nav.href('floorplan', { b: building.code, f: facility.floor }), label: 'Continue inside' };

  const walkDd = h('dd', null, '–');
  const toggle = h('input', {
    type: 'checkbox', role: 'switch', id: 'stepfree', checked: stepFree,
    onchange: (e) => nav.go('preview', keep({ stepfree: e.target.checked ? '1' : undefined }), { keepFocus: 'stepfree' }),
  });

  append(body,
    backLink(nav.href('search', { b: building.code, r: room ? room.number : undefined }), room ? 'Change room' : 'Back'),
    h('div', null, h('h1', null, heading), sub ? h('p', { class: 'muted' }, sub) : null),
    dest
      ? outdoorMap({ entrances, routeEntranceId: route?.entrance, stepFree, sim, arrival,
        onRoute: (s) => { walkDd.textContent = s ? minutes(s.minutes) : '–'; } })
      : h('div', { class: 'card' },
        h('p', null, "We don't have this building's entrances on our map yet."),
        searchUrl(building.name) ? h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: searchUrl(building.name) }, 'Find it in Google Maps') : null),
    dest ? h('div', { class: 'card summary' },
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'Walk'), walkDd),
        h('div', null, h('dt', null, 'Entrance'), h('dd', null, (routeEntrance || dest).name)),
        h('div', null, h('dt', null, 'Floor'), h('dd', null, room ? String(room.floor) : facility ? String(facility.floor) : '–'))),
      (routeEntrance || dest).detail ? h('p', { class: 'small' }, [(routeEntrance || dest).detail, (routeEntrance || dest).note].filter(Boolean).join('. '), '.') : null,
    ) : null,
    dest && !route && !facility ? h('p', { class: 'notice small' },
      `Indoor directions for ${building.name} aren't ready yet, so this gets you to the entrance.`) : null,
    h('label', { class: 'card switch-row', for: 'stepfree' },
      toggle,
      h('span', null,
        h('strong', null, 'Step-free route (accessibility)'),
        h('span', { class: 'muted small block' }, stepFree && dest
          ? `On: avoids all stairs. Uses ${dest.name}${dest.note ? ` (${dest.note.toLowerCase()})` : ''}.`
          : 'Avoids stairs. Uses ramps and elevators only.'))),
    route ? h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: nav.href('floorplan', { b: building.code, f: room.floor, r: room.number, stepfree: stepFree ? '1' : undefined }) }, 'Show floor plan'),
      h('a', { class: 'btn btn-primary', href: nav.href('navigate', { b: building.code, r: room.number, stepfree: stepFree ? '1' : undefined, step: 1 }) }, 'Start route')) : null,
  );
}
