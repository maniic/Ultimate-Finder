// Owner: Abdullah
// VIEW: Route preview. Walking directions to the building entrance (live
// Google map), plus best entrance, walk time, floor and the route type
// (Standard / Step-free), with a box saying what each choice uses and avoids.
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
//  - Verify entrance coordinates in places.js on site.

import { h, append, backLink, minutes } from '/js/ui.js';
import { getBuilding, getRoom, getRoute, getEntrance, ENTRANCES, FACILITIES, ROOMS, facilityTypeName } from '/js/data.js';
import { outdoorMap } from './map.js';
import { chooseDestination, entrancesFor, searchUrl, stepFreeInfo } from './outdoor.js';
import { PLACES } from './places.js';

export const title = 'Route preview';

// Buildings not in data.js (no indoor data yet) still have a name in the DB.
let buildingsPromise;
function apiBuilding(code) {
  buildingsPromise ??= fetch('/api/buildings')
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
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
  const hasIndoorData = (ROOMS[building.code] || []).length > 0;

  // A room or facility we don't know: say so rather than guess.
  if ((params.r && !room && hasIndoorData) || (params.fac && !facility)) {
    append(body, backLink(nav.href('search', { b: building.code })),
      h('p', null, params.fac
        ? `We couldn't find that facility in ${building.name}. Go back and search again.`
        : `We couldn't find room ${params.r} in ${building.name}. Check the number and search again.`));
    return;
  }

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
  // The entrance can change once a start point is known (nearest one), so
  // these are updated from the map's onRoute.
  const shown = routeEntrance || dest;
  const entranceDd = h('dd', null, shown ? shown.name : '–');
  const entranceNote = h('p', { class: 'small' });
  // Step-free explanation (A2 finding: people couldn't tell what it does or
  // whether it was on). Rebuilt whenever the chosen entrance changes.
  const stepFreeBox = h('div', { class: `card stepfree-info${stepFree ? ' is-on' : ''}`, 'aria-live': 'polite' });
  const icon = () => h('span', { 'aria-hidden': 'true' }, '♿ ');
  let explainedFor; // entrance id the box was last built for
  function showEntrance(e) {
    if (!e) return;
    entranceDd.textContent = e.name;
    const bits = [e.detail, e.note].filter(Boolean);
    entranceNote.textContent = bits.length ? `${bits.join('. ')}.` : '';
    entranceNote.hidden = !bits.length;
    explainStepFree(e);
  }
  function explainStepFree(e) {
    // onRoute fires more than once per origin; only rebuild (and so only
    // re-announce the live region) when the entrance actually changes.
    const id = e ? e.id : null;
    if (explainedFor !== undefined && explainedFor === id) return;
    explainedFor = id;
    const info = stepFreeInfo(entrances, e);
    const named = (x) => `${x.name}${x.note ? `, ${x.note.toLowerCase()}` : ''}`;
    if (stepFree) {
      stepFreeBox.replaceChildren();
      append(stepFreeBox,
        h('strong', null, icon(), 'Step-free route is on'),
        info.unavailable
          ? h('p', { class: 'small warn' }, `We have no step-free entrance on record for ${building.name}. Check with the building before you go.`)
          : null,
        h('ul', { class: 'small' },
          info.uses ? h('li', null, `Uses ${named(info.uses)}.`) : null,
          info.avoids.map((a) => h('li', null, `Avoids ${named(a)}.`)),
          route ? h('li', null, 'Inside: elevators and ramps only, no stairs.') : null));
    } else {
      // Only blame the entrance we're actually going to; others are context.
      const here = info.uses && !info.uses.stepFree ? info.uses : null;
      const others = info.avoids.filter((a) => a !== here);
      let text;
      if (here) text = `It may use stairs: ${named(here)}. Choose Step-free to avoid all stairs.`;
      else if (others.length) text = `${info.uses ? `${info.uses.name} is step-free, but stairs inside are possible. ` : ''}Other entrances have stairs: ${others.map(named).join('; ')}. Choose Step-free to use elevators and ramps only.`;
      else text = 'It may use stairs inside. Choose Step-free to use elevators and ramps only.';
      stepFreeBox.replaceChildren();
      append(stepFreeBox,
        h('strong', null, 'Standard route'),
        h('p', { class: 'small' }, text));
    }
  }
  if (shown) showEntrance(shown); else explainStepFree(null);

  const go = (on) => nav.go('preview', keep({ stepfree: on ? '1' : undefined }), { keepFocus: on ? 'stepfree' : 'route-standard' });
  const routeType = h('div', { class: 'route-type', role: 'group', 'aria-label': 'Route type' },
    h('button', { type: 'button', id: 'route-standard', class: 'chip', 'aria-pressed': stepFree ? 'false' : 'true', onclick: () => stepFree && go(false) }, 'Standard'),
    h('button', { type: 'button', id: 'stepfree', class: 'chip', 'aria-pressed': stepFree ? 'true' : 'false', onclick: () => !stepFree && go(true) }, icon(), 'Step-free'));

  append(body,
    facility
      ? backLink(nav.href('facilities', { type: facility.type, b: building.code, id: facility.id, stepfree: stepFree ? '1' : undefined }), 'Back to facilities')
      : backLink(nav.href('search', { b: building.code, r: room ? room.number : undefined }), room ? 'Change room' : 'Back'),
    h('div', null, h('h1', null, heading), sub ? h('p', { class: 'muted' }, sub) : null),
    routeType,
    stepFreeBox,
    dest
      ? outdoorMap({ entrances, routeEntranceId: route?.entrance, stepFree, sim, arrival,
        onRoute: (s, e) => { walkDd.textContent = s ? minutes(s.minutes) : '–'; showEntrance(e); } })
      : h('div', { class: 'card' },
        h('p', null, "We don't have this building's entrances on our map yet."),
        searchUrl(building.name) ? h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: searchUrl(building.name) }, 'Find it in Google Maps') : null),
    dest ? h('div', { class: 'card summary' },
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'Walk'), walkDd, stepFree ? h('dd', null, h('span', { class: 'badge-stepfree' }, icon(), 'Step-free')) : null),
        h('div', null, h('dt', null, 'Entrance'), entranceDd),
        h('div', null, h('dt', null, 'Floor'), h('dd', null, room ? String(room.floor) : facility ? String(facility.floor) : '–'))),
      entranceNote,
    ) : null,
    dest && (!hasIndoorData || (room && !route)) ? h('p', { class: 'notice small' }, room
      ? `Indoor directions to ${building.code} ${room.number} aren't ready yet, so this gets you to the entrance.`
      : `Indoor directions for ${building.name} aren't ready yet, so this gets you to the entrance.`) : null,
    route ? h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: nav.href('floorplan', { b: building.code, f: room.floor, r: room.number, stepfree: stepFree ? '1' : undefined }) }, 'Show floor plan'),
      h('a', { class: 'btn btn-primary', href: nav.href('navigate', { b: building.code, r: room.number, stepfree: stepFree ? '1' : undefined, step: 1 }) }, 'Start route')) : null,
  );
}
