// Owner: Abdullah
// VIEW: Route preview. Indoor actions and route type first, then walking
// directions to the entrance (live Google map) for people outside.
// Prototype Fig. 2c.
// In:  #/preview?b=OI&r=10-210[&stepfree=1]   a room
//      #/preview?b=OI&fac=f1                  a facility (same map)
//      #/preview?b=BA                         just the building
//      add &from=r:2179 or &from=f:2 for an indoor Bahen start,
//      &via=stairs for the stair route, or &sim=1 for the location simulator
// Out: #/floorplan?b&f&r  ·  #/navigate?b&r&stepfree&step=1 (keeps from/via)
//
// The outdoor part lives in map.js (UI), outdoor.js (tested logic) and
// places.js (entrance coordinates). Nothing is specific to one building:
// the destination comes from the b/r/fac params.
//
// TODO (from the evaluation):
//  - Verify entrance coordinates in places.js on site.

import { h, append, backLink, minutes } from '/js/ui.js';
import { getBuilding, getRoom, getRoute, getEntrance, getFacility, FLOORS, ENTRANCES, ROOMS, facilityTypeName } from '/js/data.js';
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
  const isBahen = building.code === 'BA';
  const stepFree = params.stepfree === '1';
  const sim = params.sim === '1';
  const from = isBahen && params.from ? params.from : undefined;
  const originRoom = from?.startsWith('r:') ? getRoom(building.code, from.slice(2)) : undefined;
  const originFloor = /^f:[1-3]$/.test(from) ? from.slice(2) : undefined;
  const facility = getFacility(building.code, params.fac);
  const room = !params.fac && params.r ? getRoom(building.code, params.r) : null;
  const destination = facility || room;
  const destinationId = facility?.id || room?.number;
  const stairsRoute = isBahen && destinationId && getRoute(building.code, destinationId, 'stairs', from);
  const offersStairs = Boolean(stairsRoute?.usesStairs);
  const usingStairs = offersStairs && !stepFree && params.via === 'stairs';
  const via = usingStairs ? 'stairs' : undefined;
  const route = usingStairs ? stairsRoute
    : destinationId && getRoute(building.code, destinationId, stepFree ? 'stepfree' : 'standard', from);
  const stairSigns = usingStairs && route.stairStops?.join(' → ');
  const stairAccess = 'Check stairwell access and floor re-entry on site.';
  const stairNote = stairSigns ? `Stair signs ${stairSigns}. ${stairAccess}` : stairAccess;
  const hasPlan = destination && Object.hasOwn(FLOORS[building.code] || {}, destination.floor);
  const indoorParams = { b: building.code, r: room?.number, fac: facility?.id, from, via, stepfree: stepFree ? '1' : undefined };
  const routeEntrance = route && getEntrance(building.code, route.entrance);
  const hasIndoorData = (ROOMS[building.code] || []).length > 0;

  // A room or facility we don't know: say so rather than guess.
  if ((!params.fac && params.r && !room && hasIndoorData) || (params.fac && !facility)) {
    append(body, backLink(nav.href('search', { b: building.code })),
      h('p', null, params.fac
        ? `We couldn't find that facility in ${building.name}. Go back and search again.`
        : `We couldn't find room ${params.r} in ${building.name}. Check the number and search again.`));
    return;
  }

  const entrances = entrancesFor(building.code, ENTRANCES, PLACES);
  const dest = chooseDestination(entrances, { routeEntranceId: route?.entrance, stepFree });
  const keep = (extra) => ({ b: building.code, r: params.r, fac: params.fac, from, sim: sim ? '1' : undefined, ...extra });

  // Heading
  let heading; let sub = building.name;
  if (facility) {
    heading = facility.label || facilityTypeName(facility.type);
    sub = `${building.name} · floor ${facility.floor} · ${facility.near}`;
  } else if (params.r) heading = `${building.code} ${params.r}`;
  else { heading = building.name; sub = null; }

  const stepFreeBox = h('div', { class: `card stepfree-info${stepFree ? ' is-on' : ''}`, 'aria-live': 'polite' });
  const icon = () => h('span', { 'aria-hidden': 'true' }, '♿ ');
  const go = (preferences, keepFocus) => nav.go('preview', keep(preferences), { keepFocus });
  const routeType = offersStairs
    ? h('div', { class: 'route-type', role: 'group', 'aria-label': 'Route type' },
      h('button', { type: 'button', id: 'route-elevator', class: 'chip', 'aria-pressed': String(!usingStairs),
        onclick: () => usingStairs && go({}, 'route-elevator') }, 'Elevator'),
      h('button', { type: 'button', id: 'route-stairs', class: 'chip', 'aria-pressed': String(usingStairs),
        onclick: () => !usingStairs && go({ via: 'stairs' }, 'route-stairs') }, 'Stairs'))
    : !from ? h('div', { class: 'route-type', role: 'group', 'aria-label': 'Route type' },
      h('button', { type: 'button', id: 'route-standard', class: 'chip', 'aria-pressed': String(!stepFree),
        onclick: () => stepFree && go({}, 'route-standard') }, 'Standard'),
      h('button', { type: 'button', id: 'stepfree', class: 'chip', 'aria-pressed': String(stepFree),
        onclick: () => !stepFree && go({ stepfree: '1' }, 'stepfree') }, icon(), 'Step-free')) : null;
  const showFloor = from ? route?.steps[0]?.floor ?? destination?.floor : destination?.floor;
  const startHref = route && nav.href('navigate', { ...indoorParams, step: 1 });
  const planHref = hasPlan && nav.href('floorplan', { ...indoorParams, f: showFloor });
  // Without an indoor start the actions sit at the end of the page, docked to
  // the bottom of the screen so they're visible without scrolling.
  const indoorActions = (startHref || planHref) ? h('div', { class: `btn-row indoor-actions${from ? '' : ' is-docked'}` },
    startHref ? h('a', { class: 'btn btn-primary', href: startHref }, 'Start indoor directions') : null,
    planHref ? h('a', { class: 'btn', href: planHref }, 'Show floor plan') : null) : null;
  const facilityNote = facility?.approximate ? h('p', { class: 'muted small' }, 'The pin shows the general area. Check nearby signs for the exact location.') : null;

  append(body,
    facility
      ? backLink(nav.href('facilities', { type: facility.type, b: building.code, id: facility.id, r: originRoom?.number,
        f: originFloor, via, stepfree: stepFree ? '1' : undefined }), 'Back to facilities')
      : backLink(nav.href('search', { b: building.code, r: room?.number }), room ? 'Change room' : 'Back'),
    h('div', null, h('h1', null, heading), sub ? h('p', { class: 'muted' }, sub) : null),
    from && route?.startLabel ? h('p', { class: 'muted' }, `Starting from ${route.startLabel}`) : null,
    routeType);

  if (from) {
    // An indoor start has no outdoor map, so the actions go right here.
    append(body,
      indoorActions,
      route ? h('p', { class: 'muted small' }, usingStairs
        ? stairNote
        : 'These directions follow the floor plans. Check doors and elevator access on site.')
        : h('p', { class: 'notice small' }, "Indoor directions from this starting point aren't available."),
      facilityNote);
    return;
  }

  // Where "You're here" leads once outside the door.
  const arrivalHref = startHref || (facility && planHref);
  const arrival = arrivalHref ? { href: arrivalHref, label: 'Continue inside' } : null;
  const walkDd = h('dd', null, '–');
  const shown = routeEntrance || dest;
  const entranceDd = h('dd', null, shown ? shown.name : '–');
  const entranceNote = h('p', { class: 'small' });
  // Rebuild the route explanation only when the mapped entrance changes.
  let explainedFor; // entrance id the box was last built for
  function showEntrance(e) {
    if (!e) return;
    entranceDd.textContent = e.name;
    // The map already names the entrance and its address, so only the note here.
    const note = e.note ? e.note.replace(/\.+$/, '') : '';
    entranceNote.textContent = note ? `${note}.` : '';
    entranceNote.hidden = !note;
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
    if (isBahen) {
      stepFreeBox.replaceChildren();
      append(stepFreeBox,
        h('strong', null, usingStairs ? 'Stairs route' : offersStairs ? 'Elevator route' : stepFree ? 'Step-free access unverified' : 'Standard route'),
        h('p', { class: 'small' }, usingStairs
          ? stairNote
          : 'Check entrance, door and elevator access on site.'));
      return;
    }
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

  append(body,
    stepFreeBox,
    dest
      ? outdoorMap({ entrances, routeEntranceId: route?.entrance, stepFree, sim, arrival,
        onRoute: (s, e) => { walkDd.textContent = s ? minutes(s.minutes) : '–'; showEntrance(e); } })
      : h('div', { class: 'card' },
        h('p', null, "We don't have this building's entrances on our map yet."),
        searchUrl(building.name) ? h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: searchUrl(building.name) }, 'Find it in Google Maps') : null),
    dest ? h('div', { class: 'card summary' },
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'Walk'), walkDd, stepFree ? h('dd', null, h('span', { class: 'badge-stepfree' },
          building.code === 'BA' ? 'Access unverified' : [icon(), 'Step-free'])) : null),
        h('div', null, h('dt', null, 'Entrance'), entranceDd),
        h('div', null, h('dt', null, 'Floor'), h('dd', null, room ? String(room.floor) : facility ? String(facility.floor) : '–'))),
      entranceNote,
    ) : null,
    dest && (!hasIndoorData || (room && !route)) ? h('p', { class: 'notice small' }, room
      ? `Indoor directions to ${building.code} ${room.number} aren't ready yet, so this gets you to the entrance.`
      : `Indoor directions for ${building.name} aren't ready yet, so this gets you to the entrance.`) : null,
    // Under the map and summary, as before: get there first, then go inside.
    indoorActions,
    facilityNote,
  );
}
