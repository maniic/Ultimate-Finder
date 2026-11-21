// Owner: Abdullah
// VIEW: Facilities. Pick an exact type (bottle filler, not just "water"), see
// the nearest ones with walk time and whether they're working, then details.
// Prototype Fig. 5; screen-level storyboard 3.
// In:  #/facilities[?b=OI]  ·  ...&type=bottle-filler  ·  ...&id=f1
//      "Nearest to what?": b plus one of r=<room>, e=<entrance>, f=<floor>
//      (see nearest.js). &pick=1 opens the "Where are you?" chooser.
// Out: #/floorplan?b&f (show it on the plan)
//      #/preview?b&fac[&stepfree] ("Walk there": walking map to the building)
//
// TODO (from the evaluation):
//  - Think-aloud finding 4: testers liked this most; consider surfacing it on
//    the search screen too.
//  - Reports are stored (reports.js → /api/facility-reports) but don't yet
//    change the facility's status. Decide how they should (e.g. 2+ recent
//    'not-working' reports → show as out of order).

import { h, append, photo, backLink, minutes } from '/js/ui.js';
import { FACILITY_TYPES, FLOORS, facilityTypeName } from '/js/data.js';
import { drawPlan } from '/js/floorplan.js';
import { reportSection } from './reports.js';
import { isInside, resolveAnchor, anchorParams, rankFacilities, anchorChoices, anchorBuildings } from './nearest.js';

export const title = 'Facilities';

const STATUS = { working: 'Working', out: 'Out of order', unknown: 'Not confirmed' };

function statusLine(f) {
  return h('span', { class: `small status-${f.status}` }, `${STATUS[f.status]} · last checked ${f.lastConfirmed}`);
}

const walkText = (f) => (f.walkMin == null ? 'Walk time unknown' : `${minutes(f.walkMin)} walk`);

function floorText(f, anchor) {
  if (f.floor === anchor.floor) return `Floor ${f.floor} (your floor)`;
  const n = Math.abs(f.floor - anchor.floor);
  return `Floor ${f.floor} · ${n} floor${n === 1 ? '' : 's'} ${f.floor > anchor.floor ? 'up' : 'down'}`;
}

function shortName(name) {
  return String(name || '').split(' · ')[0];
}

export function render(root, params, nav) {
  const anchor = resolveAnchor(params);
  const stepfree = params.stepfree === '1' ? '1' : undefined;
  const here = { ...anchorParams(anchor), stepfree };
  const link = (extra) => nav.href('facilities', { ...here, type: params.type, ...extra });

  if (anchor.error) { anchorError(root, anchor, params, nav, stepfree); return; }
  if (params.pick === '1') { picker(root, anchor, params, nav, stepfree); return; }

  // "Nearest to what?" card, shown on every screen below.
  const where = h('div', { class: 'card anchor' },
    h('div', { class: 'grow' },
      h('span', { class: 'muted small' }, 'Near'),
      h('strong', { class: 'block' }, anchor.label),
      anchor.kind === 'building' ? null
        : h('span', { class: 'muted small block' }, [shortName(anchor.buildingName), anchor.kind === 'entrance' ? anchor.detail : null].filter(Boolean).join(' · '))),
    h('a', { class: 'btn btn-small', href: link({ pick: '1', id: params.id }), 'aria-label': `Change where you are (now ${anchor.label})` }, 'Change'));

  if (!params.type) {
    append(root,
      h('h1', null, 'Find a facility'),
      where,
      h('p', { class: 'muted' }, 'What do you need?'),
      h('div', { class: 'type-grid' }, FACILITY_TYPES.map((t) =>
        h('a', { class: 'card type', href: link({ type: t.id }) }, t.name))),
    );
    return;
  }

  const list = rankFacilities(params.type, anchor);
  const typeName = facilityTypeName(params.type);
  const lower = typeName.toLowerCase();
  const inside = isInside(anchor);
  const hasPlan = (f) => own(FLOORS, f.building) && own(FLOORS[f.building], f.floor);
  const planHref = (f) => nav.href('floorplan', { b: f.building, f: f.floor });
  // Outside (an entrance): the walking map to the building, which then goes
  // on to the floor plan. Already inside (a room or floor): straight to the
  // floor plan, since an outdoor map is no use there.
  const walkThere = (f, cls = 'btn') => {
    if (!inside) {
      return h('a', { class: cls, href: nav.href('preview', { b: f.building, fac: f.id, stepfree }),
        'aria-label': `Walk there: map to ${lower}, floor ${f.floor}` }, 'Walk there');
    }
    return hasPlan(f)
      ? h('a', { class: cls, href: planHref(f), 'aria-label': `Floor plan: ${lower}, floor ${f.floor}` }, 'Floor plan')
      : null;
  };

  if (params.id) {
    const f = list.find((x) => x.id === params.id);
    if (f) {
      append(root,
        backLink(link({ id: undefined }), `All ${lower}s`),
        h('h1', null, typeName),
        photo(`${typeName}: ${f.near}`),
        where,
        h('div', { class: 'card' },
          h('strong', null, `${shortName(anchor.buildingName)} · ${floorText(f, anchor)}`),
          h('p', null, f.near),
          statusLine(f),
          h('p', { class: 'muted small' }, f.walkMin == null
            ? `We can't estimate the walk from ${anchor.label} yet.`
            : `About ${minutes(f.walkMin)} walk from ${anchor.label}.`)),
        h('div', { class: 'btn-row' },
          inside ? null : walkThere(f, 'btn btn-primary'),
          hasPlan(f)
            ? h('a', { class: inside ? 'btn btn-primary' : 'btn', href: planHref(f) }, 'Show on floor plan')
            : h('button', { class: 'btn', disabled: true }, 'No floor plan yet')),
        inside ? null : h('p', { class: 'muted small' }, 'Walk there opens the walking map to the building, then the floor plan inside.'),
        reportSection(f.id),
      );
      return;
    }
  }

  const nearest = list[0];
  const planItems = nearest && own(FLOORS, nearest.building) && own(FLOORS[nearest.building], nearest.floor) ? FLOORS[nearest.building][nearest.floor] : null;
  const onPlanFloor = (f) => f.floor === nearest.floor && f.building === nearest.building;
  const working = list.find((f) => f.status === 'working');
  const nearestNotWorking = nearest && nearest.status !== 'working';

  append(root,
    backLink(nav.href('facilities', here), 'All facilities'),
    h('h1', null, `Nearest ${lower}`),
    where,
    nearestNotWorking ? h('p', { class: 'notice small' }, working
      ? `The nearest one is ${STATUS[nearest.status].toLowerCase()}. The nearest working one is on floor ${working.floor}${working.walkMin == null ? '' : `, ${minutes(working.walkMin)} walk`}.`
      : list.length === 1 ? "It isn't confirmed working right now." : 'None of these is confirmed working right now.') : null,
    planItems
      ? drawPlan(planItems, {
        mini: true,
        label: `Floor ${nearest.floor} map with ${lower} locations${anchor.floor === nearest.floor && anchor.at ? ' and where you are' : ''}`,
        pins: list.filter(onPlanFloor),
        marker: anchor.floor === nearest.floor ? anchor.at : undefined,
      })
      : null,
    planItems ? h('p', { class: 'muted small plan-key' },
      anchor.floor === nearest.floor && anchor.at ? h('span', { class: 'key key-you', 'aria-hidden': 'true' }) : null,
      anchor.floor === nearest.floor && anchor.at ? 'You · ' : null,
      h('span', { class: 'key key-fac', 'aria-hidden': 'true' }),
      `${typeName}s on floor ${nearest.floor} (red: out of order, amber: not confirmed)`) : null,
    list.length
      ? h('ul', { class: 'results' }, list.map((f, i) =>
        h('li', { class: 'card result' },
          h('a', { class: 'result-main', href: link({ id: f.id }) },
            h('div', { class: 'row' }, h('strong', null, floorText(f, anchor)), h('span', null, walkText(f))),
            i === 0 ? h('span', { class: 'badge' }, 'Nearest') : null,
            h('span', null, f.near),
            statusLine(f)),
          walkThere(f, 'btn btn-small walk'))))
      : h('p', null, `No ${lower}s in ${shortName(anchor.buildingName)} in our data yet.`,
        ' ', h('a', { class: 'inline-link', href: link({ pick: '1' }) }, 'Try another building')),
  );
}

function own(obj, key) {
  return !!obj && Object.hasOwn(obj, key);
}

const ERRORS = {
  building: () => "We couldn't find that building.",
  room: (a) => `We couldn't find room ${a.r} in ${shortName(a.buildingName)}.`,
  entrance: (a) => `${shortName(a.buildingName)} has no entrance "${a.e}" in our data.`,
  floor: (a) => `${shortName(a.buildingName)} has no floor "${a.f}".`,
};

function anchorError(root, anchor, params, nav, stepfree) {
  const b = anchor.error === 'building' ? undefined : anchor.b;
  append(root,
    backLink(nav.href('facilities', { b, stepfree, type: params.type }), 'Back'),
    h('h1', null, 'Where are you?'),
    h('p', { class: 'notice' }, `${ERRORS[anchor.error](anchor)} Pick where you are instead.`),
    h('a', { class: 'btn btn-primary', href: nav.href('facilities', { b, stepfree, type: params.type, pick: '1' }) }, 'Choose where you are'),
  );
}

// "Where are you?" Entrances, floors and rooms in this building, plus other
// buildings. Every choice is a link that sets the anchor and keeps the type.
function picker(root, anchor, params, nav, stepfree) {
  const go = (p) => nav.href('facilities', { b: anchor.b, stepfree, type: params.type, id: params.id, ...p });
  const c = anchorChoices(anchor.b);
  const current = anchorParams({ ...anchor, isDefault: false });
  const isCurrent = (p) => Object.entries(p).every(([k, v]) => current[k] === v) && Object.keys(p).length;
  const choice = (p, label, detail) => h('li', null,
    h('a', { class: `card choice${isCurrent(p) ? ' is-current' : ''}`, href: go(p), 'aria-current': isCurrent(p) ? 'true' : undefined },
      h('strong', null, label),
      detail ? h('span', { class: 'muted small' }, detail) : null));
  const section = (heading, items) => (items.length
    ? h('section', null, h('h2', { class: 'section-title' }, heading), h('ul', { class: 'choices' }, items))
    : null);

  append(root,
    backLink(go(anchorParams(anchor)), 'Back'),
    h('h1', null, 'Where are you?'),
    h('p', { class: 'muted' }, `We'll sort ${params.type ? `${facilityTypeName(params.type).toLowerCase()}s` : 'facilities'} by how far they are from here.`),
    section(`Entrances · ${shortName(anchor.buildingName)}`, c.entrances.map((e) => choice({ e: e.e }, e.label, [e.detail, e.stepFree ? 'Step-free' : null].filter(Boolean).join(' · ')))),
    section('On a floor', c.floors.map((f) => choice({ f: f.f }, f.label))),
    section('At a room', c.rooms.map((r) => choice({ r: r.r }, r.label, r.detail))),
    section('Another building', anchorBuildings().filter((x) => x.code !== anchor.b).map((x) =>
      h('li', null, h('a', { class: 'card choice', href: nav.href('facilities', { b: x.code, stepfree, type: params.type }) },
        h('strong', null, shortName(x.name)),
        h('span', { class: 'muted small' }, x.hasFacilities ? x.code : `${x.code} · no facility data yet`))))),
  );
}
