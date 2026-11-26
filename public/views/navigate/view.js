// Owner: (your name here)
// VIEW: Step-by-step navigation. One instruction at a time, with a photo of
// what to look for, a mini map and progress. Prototype Fig. 3; concept 2.
// In:  #/navigate?b=OI&r=10-210&step=1[&stepfree=1][&alt=blockedElevator]
// Out: #/recover?... ("This isn't what I see")  ·  #/search (finish/exit)
//
// TODO (from the evaluation):
//  - HE1/HE2: visible Previous step + "Finish route" on arrival (done here;
//    test that people notice them).
//  - HE3: short hint on when to tap Next (shown above the buttons).
//  - HE1: audio guidance (read the step aloud, e.g. speechSynthesis).
//  - Real photos for each step (the placeholders say what to photograph).

import { h, append, photo, minutes } from '/js/ui.js';
import { getBuilding, getEntrance, getFacility, getRoom, getRoute, facilityTypeName, FLOORS } from '/js/data.js';
import { getBahenBackground } from '/js/bahen.js';
import { drawPlan } from '/js/floorplan.js';

export const title = 'Directions';

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  const facility = building && getFacility(building.code, params.fac);
  const room = building && !params.fac && getRoom(building.code, params.r);
  const destinationId = facility?.id || room?.number;
  const variant = params.alt || (params.stepfree === '1' ? 'stepfree' : params.via === 'stairs' ? 'stairs' : 'standard');
  const route = destinationId && getRoute(building.code, destinationId, variant, params.from);
  if (!route) {
    append(root, h('p', null, 'No route to show. '), h('a', { href: nav.href('search') }, 'Start a new search'));
    return;
  }

  const total = route.steps.length;
  const n = Math.min(Math.max(parseInt(params.step, 10) || 1, 1), total);
  const step = route.steps[n - 1];
  const arrived = step.arrival || n === total;
  const here = { ...params, step: undefined };
  const go = (i) => nav.href('navigate', { ...here, step: i });
  const switchMode = !arrived && building.code === 'BA' && !params.alt && variant !== 'stepfree'
    ? otherBahenMode(building.code, destinationId, variant, route, params.from)
    : undefined;
  const startLabel = route.startLabel || getEntrance(building.code, route.entrance)?.name;

  // Mini map: this floor, the route points on it, and where you are.
  const onFloor = route.steps.filter((s) => s.floor === step.floor).map((s) => s.at);
  const mini = drawPlan(FLOORS[building.code]?.[step.floor], {
    mini: true, highlight: destinationId, path: onFloor, marker: step.at,
    background: getBahenBackground(building.code, step.floor),
  });

  append(root, 
    h('div', { class: 'nav-head' },
      h('div', null,
        h('p', { class: 'small muted' }, `To ${facility ? facility.label || facilityTypeName(facility.type) : `${building.code} ${room.number}`} · Floor ${step.floor} now`),
        h('h1', null, `Step ${n} of ${total}`)),
      h('a', { class: 'btn exit', href: nav.href('search') }, 'Exit')),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Route progress', 'aria-valuemin': 1, 'aria-valuemax': total, 'aria-valuenow': n },
      h('span', { style: `width:${(n / total) * 100}%` })),
    params.alt ? h('p', { class: 'notice small' }, 'New route avoiding the blocked elevator.') : null,
    mini,
    building.code === 'BA' ? h('p', { class: 'small muted' }, `Look for: ${step.see}`) : photo(`Look for: ${step.see}`),
    h('p', { class: 'instruction', 'aria-live': 'polite' }, step.text),
    !arrived ? h('p', { class: 'muted small' }, 'Tap Next when you can see this.') : null,
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: n > 1 ? go(n - 1) : null, 'aria-disabled': n === 1 ? 'true' : null }, 'Previous step'),
      arrived
        ? h('a', { class: 'btn btn-primary', href: nav.href('search') }, 'Finish route')
        : h('a', { class: 'btn btn-primary', href: go(n + 1) }, 'Next step')),
    switchMode ? h('div', { class: 'nav-mode-switch' },
      h('a', { class: 'btn btn-small', href: nav.href('navigate', { ...here, via: switchMode, step: 1 }),
        'aria-describedby': 'nav-mode-restart' }, 'Switch to ' + switchMode),
      h('p', { id: 'nav-mode-restart', class: 'small muted' },
        startLabel ? 'Restarts from ' + startLabel + '.' : 'Restarts from your starting point.')) : null,
    !arrived && room ? h('a', { class: 'btn mismatch', href: nav.href('recover', { ...params, step: n }) }, "This isn't what I see") : null,
    !arrived && facility ? h('a', { class: 'btn mismatch', href: nav.href('floorplan', {
      b: building.code, fac: facility.id, f: step.floor, stepfree: params.stepfree,
      from: params.from, via: params.via, resume: n,
    }) }, 'Show floor plan') : null,
    route.walkMin ? h('p', { class: 'muted small' }, `About ${minutes(route.walkMin)} total.`) : null,
  );
}

function otherBahenMode(building, destinationId, variant, route, from) {
  if (variant === 'stairs') {
    return route.usesStairs && getRoute(building, destinationId, 'standard', from) ? 'elevator' : undefined;
  }
  return getRoute(building, destinationId, 'stairs', from)?.usesStairs ? 'stairs' : undefined;
}
