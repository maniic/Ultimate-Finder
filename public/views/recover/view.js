// Owner: (your name here)
// VIEW: Recovery ("This isn't what I see"). Go back a step, or report a
// blocked elevator/stairs, say where you are, and get a new route.
// Prototype Fig. 4.
// In:  #/recover?b=OI&r=10-210&step=3[&stepfree=1][&stage=where|unsure]
// Out: #/navigate?...&step=n-1  ·  #/navigate?...&alt=blockedElevator&step=1
//
// TODO (from the evaluation):
//  - HE1/HE3 (severity 3): lost users may not recognise any location choice.
//    Landmark photos + an "I'm not sure" path are stubbed here; flesh out.
//  - HE3: unbuilt options must look unavailable. They're disabled here.
//  - Reroute from the chosen spot (data only has one blocked-elevator route).

import { h, append, photo, backLink } from '/js/ui.js';
import { getBuilding, getRoom, LOCATION_CHOICES } from '/js/data.js';

export const title = "This isn't what I see";

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  const room = building && getRoom(building.code, params.r);
  if (!room) {
    append(root, backLink(nav.href('search')), h('p', null, 'Nothing to recover. Start a new search.'));
    return;
  }
  const n = Math.min(Math.max(parseInt(params.step, 10) || 1, 1), 50);
  const routeParams = { b: building.code, r: room.number, stepfree: params.stepfree, alt: params.alt };
  const here = (stage) => nav.href('recover', { ...routeParams, step: n, stage });

  append(root, backLink(nav.href('navigate', { ...routeParams, step: n }), 'Back to directions'));

  if (params.stage === 'where' || params.stage === 'unsure') {
    const choices = LOCATION_CHOICES[building.code] || [];
    append(root, 
      h('h1', null, 'Where are you now?'),
      h('p', { class: 'muted' }, 'Pick the place that looks most like your surroundings.'),
      params.stage === 'unsure'
        ? h('p', { class: 'notice' }, 'Look for a room-number sign or the nearest elevator. If you can, head to the main lobby; the front desk can help too.')
        : null,
      h('div', { class: 'choices' }, choices.map((c) =>
        h('a', { class: 'card choice', href: nav.href('navigate', { ...routeParams, alt: 'blockedElevator', step: 1, from: c.id }) },
          photo(c.see), h('strong', null, c.name), h('span', { class: 'muted small' }, `Floor ${c.floor}`)))),
      params.stage !== 'unsure' ? h('a', { class: 'btn', href: here('unsure') }, "I'm not sure") : null,
    );
    return;
  }

  append(root, 
    h('div', { class: 'sheet' },
      h('h1', null, "This isn't what I see"),
      h('p', { class: 'muted' }, `You were on step ${n}. What's wrong?`),
      n > 1 ? h('a', { class: 'btn', href: nav.href('navigate', { ...routeParams, step: n - 1 }) }, 'Go back one step') : null,
      h('a', { class: 'btn btn-primary', href: here('where') }, 'Elevator or stairs are blocked'),
      h('button', { class: 'btn', disabled: true, title: 'Not built yet' }, 'Show nearby landmarks (coming later)'),
      h('button', { class: 'btn', disabled: true, title: 'Not built yet' }, 'Report an outdated photo (coming later)'),
    ),
  );
}
