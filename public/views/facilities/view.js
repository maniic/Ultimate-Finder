// VIEW: Facilities. Pick an exact type (bottle filler, not just "water"), see
// Owner: (your name here)
// the nearest ones with walk time and whether they're working, then details.
// Prototype Fig. 5; screen-level storyboard 3.
// In:  #/facilities  ·  #/facilities?type=bottle-filler  ·  ...&id=f1
// Out: #/floorplan?b&f (show it on the plan)
//
// TODO (from the evaluation):
//  - Think-aloud finding 4: testers liked this most; consider surfacing it on
//    the search screen too.
//  - "Nearest to what?" Choose a building/floor you're in (mock: OISE).
//  - Report-a-problem flow, and routing to a facility via the navigate view.

import { h, append, photo, backLink, minutes } from '/js/ui.js';
import { FACILITY_TYPES, FACILITIES, FLOORS, facilityTypeName, getBuilding } from '/js/data.js';
import { drawPlan } from '/js/floorplan.js';

export const title = 'Facilities';

const STATUS = { working: 'Working', out: 'Out of order', unknown: 'Not confirmed' };

function statusLine(f) {
  return h('span', { class: `small status-${f.status}` }, `${STATUS[f.status]} · last checked ${f.lastConfirmed}`);
}

export function render(root, params, nav) {
  if (!params.type) {
    append(root, 
      h('h1', null, 'Find a facility'),
      h('p', { class: 'muted' }, 'What do you need? Showing places near you in OISE.'),
      h('div', { class: 'type-grid' }, FACILITY_TYPES.map((t) =>
        h('a', { class: 'card type', href: nav.href('facilities', { type: t.id }) }, t.name))),
    );
    return;
  }

  const list = FACILITIES.filter((f) => f.type === params.type).sort((a, b) => a.walkMin - b.walkMin);
  const typeName = facilityTypeName(params.type);

  if (params.id) {
    const f = list.find((x) => x.id === params.id);
    if (f) {
      const b = getBuilding(f.building);
      append(root, 
        backLink(nav.href('facilities', { type: params.type }), `All ${typeName.toLowerCase()}s`),
        h('h1', null, typeName),
        photo(`${typeName}: ${f.near}`),
        h('div', { class: 'card' },
          h('strong', null, `${b ? b.code : f.building} · Floor ${f.floor}`),
          h('p', null, f.near),
          statusLine(f),
          h('p', { class: 'muted small' }, `About ${minutes(f.walkMin)} away.`)),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', disabled: true, title: 'Not built yet' }, 'Report a problem'),
          FLOORS[f.building]?.[f.floor]
            ? h('a', { class: 'btn btn-primary', href: nav.href('floorplan', { b: f.building, f: f.floor }) }, 'Show on floor plan')
            : h('button', { class: 'btn', disabled: true }, 'No floor plan yet')),
      );
      return;
    }
  }

  const nearest = list[0];
  const floorsWith = [...new Set(list.map((f) => f.floor))].sort((a, b) => a - b);
  const planItems = nearest && FLOORS[nearest.building]?.[nearest.floor];

  append(root, 
    backLink(nav.href('facilities'), 'All facilities'),
    h('h1', null, `Nearest ${typeName.toLowerCase()}`),
    floorsWith.length ? h('p', { class: 'muted small' }, `On floors: ${floorsWith.join(', ')}`) : null,
    planItems
      ? drawPlan(planItems, { mini: true, label: `Floor ${nearest.floor} map with ${typeName.toLowerCase()} locations`, pins: list.filter((f) => f.floor === nearest.floor && f.building === nearest.building) })
      : null,
    list.length
      ? h('ul', { class: 'results' }, list.map((f) =>
          h('li', null, h('a', { class: 'card result', href: nav.href('facilities', { type: params.type, id: f.id }) },
            h('div', { class: 'row' }, h('strong', null, `Floor ${f.floor}`), h('span', null, minutes(f.walkMin))),
            h('span', null, f.near),
            statusLine(f)))))
      : h('p', null, `No ${typeName.toLowerCase()}s in our data yet.`),
  );
}
