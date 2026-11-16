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
import { getBuilding, getRoom, getRoute, FLOORS } from '/js/data.js';
import { drawPlan } from '/js/floorplan.js';

export const title = 'Directions';

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  const room = building && getRoom(building.code, params.r);
  const variant = params.alt || (params.stepfree === '1' ? 'stepfree' : 'standard');
  const route = room && getRoute(building.code, room.number, variant);
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

  // Mini map: this floor, the route points on it, and where you are.
  const onFloor = route.steps.filter((s) => s.floor === step.floor).map((s) => s.at);
  const mini = drawPlan(FLOORS[building.code]?.[step.floor], { mini: true, highlight: room.number, path: onFloor, marker: step.at });

  append(root, 
    h('div', { class: 'nav-head' },
      h('div', null,
        h('p', { class: 'small muted' }, `To ${building.code} ${room.number} · Floor ${step.floor} now`),
        h('h1', null, `Step ${n} of ${total}`)),
      h('a', { class: 'btn exit', href: nav.href('search') }, 'Exit')),
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Route progress', 'aria-valuemin': 1, 'aria-valuemax': total, 'aria-valuenow': n },
      h('span', { style: `width:${(n / total) * 100}%` })),
    params.alt ? h('p', { class: 'notice small' }, 'New route avoiding the blocked elevator.') : null,
    mini,
    photo(`Look for: ${step.see}`),
    h('p', { class: 'instruction', 'aria-live': 'polite' }, step.text),
    !arrived ? h('p', { class: 'muted small' }, 'Tap Next when you can see this.') : null,
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: n > 1 ? go(n - 1) : null, 'aria-disabled': n === 1 ? 'true' : null }, 'Previous step'),
      arrived
        ? h('a', { class: 'btn btn-primary', href: nav.href('search') }, 'Finish route')
        : h('a', { class: 'btn btn-primary', href: go(n + 1) }, 'Next step')),
    !arrived ? h('a', { class: 'btn mismatch', href: nav.href('recover', { ...params, step: n }) }, "This isn't what I see") : null,
    route.walkMin ? h('p', { class: 'muted small' }, `About ${minutes(route.walkMin)} total.`) : null,
  );
}
