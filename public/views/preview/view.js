// VIEW: Route preview. Best entrance, walk time and floor before you leave,
// plus the step-free switch. Prototype Fig. 2c.
// In:  #/preview?b=OI&r=10-210[&stepfree=1]
// Out: #/floorplan?b&f&r  ·  #/navigate?b&r&stepfree&step=1
//
// TODO (from the evaluation):
//  - HE1/HE4 + think-aloud finding 2: make the step-free option's meaning and
//    selected state obvious; say which entrance and route features it uses.
//  - Real outdoor map (the placeholder box below) from campus to the entrance.
//  - "Walk time from where?" No GPS, so pick an origin or state the assumption.

import { h, append, photo, backLink, minutes } from '/js/ui.js';
import { getBuilding, getRoom, getRoute, getEntrance, ENTRANCES } from '/js/data.js';

export const title = 'Route preview';

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  const room = building && getRoom(building.code, params.r);
  const stepFree = params.stepfree === '1';
  const route = room && getRoute(building.code, room.number, stepFree ? 'stepfree' : 'standard');

  if (!route) {
    append(root, backLink(nav.href('search')), h('p', null, 'No route found for that room. Go back and search again.'));
    return;
  }

  const entrance = getEntrance(building.code, route.entrance);
  const others = (ENTRANCES[building.code] || []).filter((e) => e.id !== entrance.id);
  const toggle = h('input', {
    type: 'checkbox', role: 'switch', id: 'stepfree', checked: stepFree,
    onchange: (e) => nav.go('preview', { b: building.code, r: room.number, stepfree: e.target.checked ? '1' : undefined }),
  });

  append(root, 
    backLink(nav.href('search', { b: building.code, r: room.number }), 'Change room'),
    h('div', null,
      h('h1', null, `${building.code} ${room.number}`),
      h('p', { class: 'muted' }, building.name)),
    photo(`Map: walking route to ${entrance.name} (${entrance.detail})`),
    h('div', { class: 'card summary' },
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'Walk'), h('dd', null, minutes(route.walkMin))),
        h('div', null, h('dt', null, 'Entrance'), h('dd', null, entrance.name)),
        h('div', null, h('dt', null, 'Floor'), h('dd', null, String(room.floor)))),
      h('p', { class: 'small' }, `${entrance.detail}. ${entrance.note}.`),
    ),
    h('label', { class: 'card switch-row', for: 'stepfree' },
      toggle,
      h('span', null,
        h('strong', null, 'Step-free route (accessibility)'),
        h('span', { class: 'muted small block' }, stepFree
          ? `On: avoids all stairs. Uses ${entrance.name} (${entrance.note.toLowerCase()}).`
          : 'Avoids stairs. Uses ramps and elevators only.'))),
    others.length ? h('p', { class: 'muted small' },
      'Also on the map: ', others.map((e) => `${e.name}, ${e.note.toLowerCase()}`).join('; '), '.') : null,
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn', href: nav.href('floorplan', { b: building.code, f: room.floor, r: room.number, stepfree: stepFree ? '1' : undefined }) }, 'Show floor plan'),
      h('a', { class: 'btn btn-primary', href: nav.href('navigate', { b: building.code, r: room.number, stepfree: stepFree ? '1' : undefined, step: 1 }) }, 'Start route')),
  );
}
