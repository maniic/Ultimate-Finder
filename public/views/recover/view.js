// Owner: Abdullah
// VIEW: Recovery ("This isn't what I see"). Go back a step, say the elevator
// or stairs are blocked, or say "I don't know where I am": place yourself by
// a landmark or room sign you can see, check it on the plan, and continue
// the route from there. Prototype Fig. 4 / Fig. 7.
// In:  #/recover?b=OI&r=10-210&step=3[&stepfree=1][&alt=blockedElevator]
//        [&why=lost|blocked][&stage=where|unsure|here][&floor=10][&spot=10:wr][&nosign=1]
// Out: #/navigate?b&r[&stepfree][&alt=blockedElevator]&step=<rejoin step>
//
// Answers the A2 severity-3 finding (HE1/HE3): recovery assumed people know
// where they are. Now they pick what they can see (photo cards), or answer
// "which floor number is on the nearest sign?", or type a door-plate number,
// and an "I'm not sure" path is as prominent as the photo cards.
// The rejoin logic is in reroute.js (unit-tested).

import { h, append, photo, backLink } from '/js/ui.js';
import { getBuilding, getRoom, getRoute, FLOORS } from '/js/data.js';
import { getBahenBackground } from '/js/bahen.js';
import { drawPlan } from '/js/floorplan.js';
import { spotsFor, findSpot, findRoomSign, pickVariant, rejoin } from './reroute.js';

export const title = "This isn't what I see";

export function render(root, params, nav) {
  const building = getBuilding(params.b);
  const room = building && getRoom(building.code, params.r);
  if (!room) {
    append(root, backLink(nav.href('search')), h('p', null, 'Nothing to recover. Start a new search.'));
    return;
  }
  const n = Math.min(Math.max(parseInt(params.step, 10) || 1, 1), 50);
  const alt = params.alt === 'blockedElevator' ? params.alt : undefined;
  const why = params.why === 'blocked' ? 'blocked' : 'lost';
  const routeParams = { b: building.code, r: room.number, stepfree: params.stepfree === '1' ? '1' : undefined,
    from: params.from, via: params.via, alt };
  const here = (extra = {}) => nav.href('recover', { ...routeParams, step: n, why, ...extra });
  const floors = Object.keys(FLOORS[building.code] || {}).map(Number).sort((a, b) => a - b);
  const ctx = { building, room, n, why, routeParams, here, floors, nav };

  if (params.stage === 'here') return renderHere(root, params, ctx);
  if (params.stage === 'unsure') return renderUnsure(root, params, ctx);
  if (params.stage === 'where') return renderWhere(root, params, ctx);

  append(root,
    backLink(nav.href('navigate', { ...routeParams, step: n }), 'Back to directions'),
    h('div', { class: 'sheet' },
      h('h1', null, "This isn't what I see"),
      h('p', { class: 'muted' }, `You were on step ${n}. What's wrong?`),
      h('a', { class: 'btn btn-primary', href: here({ stage: 'where', why: 'lost' }) }, "I don't know where I am"),
      n > 1 ? h('a', { class: 'btn', href: nav.href('navigate', { ...routeParams, step: n - 1 }) }, 'Go back one step') : null,
      h('a', { class: 'btn', href: here({ stage: 'where', why: 'blocked' }) }, 'Elevator or stairs are blocked'),
      h('button', { class: 'btn', disabled: true, title: 'Not built yet' }, 'Report an outdated photo (coming later)'),
    ),
  );
}

// Step 1: "Where are you now?" Photo cards of what you might see, by floor.
function renderWhere(root, params, { building, why, here, floors, routeParams, n, nav }) {
  const floor = floors.includes(Number(params.floor)) ? Number(params.floor) : undefined;
  const spots = spotsFor(building.code).filter((s) => floor === undefined || s.floor === floor);

  append(root,
    backLink(here(), 'Back'),
    h('h1', null, 'Where are you now?'),
    why === 'blocked'
      ? h('p', { class: 'notice small' }, building.code === 'BA'
        ? 'Check signs or ask building staff if a stairwell or elevator is blocked. The map can help you identify where you are.'
        : "We'll route you around the blocked elevator. First, tell us where you are.")
      : null,
    h('p', { class: 'muted' }, 'Tap something you can see right now: a sign, an elevator, a room number.'),
    h('a', { class: 'btn btn-primary unsure', href: here({ stage: 'unsure' }) }, "I'm not sure where I am"),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Show places on' },
      h('a', { class: 'chip', href: here({ stage: 'where' }), 'aria-current': floor === undefined ? 'true' : null }, 'All floors'),
      floors.map((f) => h('a', { class: 'chip', href: here({ stage: 'where', floor: f }), 'aria-current': floor === f ? 'true' : null }, `Floor ${f}`))),
    h('div', { class: 'choices' }, spots.map((s) =>
      h('a', { class: 'card choice', href: here({ stage: 'here', spot: s.key }) },
        photo(s.see), h('strong', null, s.name), h('span', { class: 'muted small' }, `Floor ${s.floor}`)))),
    h('p', { class: 'muted small' }, 'Photos are placeholders until we take real ones.'),
    h('a', { class: 'btn', href: nav.href('navigate', { ...routeParams, step: n }) }, 'Back to directions'),
  );
}

// "I'm not sure": one easy question at a time.
function renderUnsure(root, params, { building, here, floors }) {
  const msg = h('p', { class: 'notice small', role: 'alert', hidden: true });
  const input = h('input', { type: 'text', id: 'room-sign', name: 'room', autocomplete: 'off', placeholder: 'e.g. 10-212' });
  const form = h('form', {
    class: 'room-sign',
    onsubmit: (e) => {
      e.preventDefault();
      const spot = findRoomSign(building.code, input.value);
      if (spot) { location.hash = here({ stage: 'here', spot: spot.key }); return; }
      msg.hidden = false;
      msg.textContent = input.value.trim()
        ? `We couldn't find "${input.value.trim()}" in ${building.code}. Check the plate, or pick a floor above.`
        : 'Type the number on the nearest door plate.';
    },
  },
  h('label', { for: 'room-sign' }, 'Or type the number on the nearest door plate'),
  h('div', { class: 'btn-row' }, input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Find it')),
  msg);

  append(root,
    backLink(here({ stage: 'where' }), 'Back to photos'),
    h('h1', null, "Let's work it out"),
    h('h2', { class: 'question' }, 'What floor number is on the nearest sign?'),
    h('p', { class: 'muted small' }, 'Look by the elevators, the stairwell door, or the first digits of a room number.'),
    h('div', { class: 'floor-pick' },
      floors.map((f) => h('a', { class: 'btn', href: here({ stage: 'where', floor: f }) }, `Floor ${f}`)),
      h('a', { class: 'btn', href: here({ stage: 'unsure', nosign: 'floor' }) }, 'Another floor')),
    form,
    params.nosign === 'floor'
      ? h('div', { class: 'notice' },
        h('strong', null, 'On another floor?'),
        h('p', null, `We only have plans for floor ${floors.join(' and ')} so far. Take the elevator to floor 1 and pick the main lobby, or ask at the lobby desk.`),
        h('a', { class: 'btn', href: here({ stage: 'where', floor: floors[0] }) }, `I'm on floor ${floors[0]} now`))
      : null,
    params.nosign === '1'
      ? h('div', { class: 'notice' },
        h('strong', null, "Can't see any sign?"),
        h('p', null, 'Walk to the nearest elevator or stairwell. Every floor number is posted there. You can also ask at the lobby desk on floor 1.'),
        h('a', { class: 'btn', href: here({ stage: 'unsure' }) }, "OK, I'm at a sign now"))
      : h('a', { class: 'btn', href: here({ stage: 'unsure', nosign: '1' }) }, "I can't see any sign"),
  );
}

// Step 2: "You're here." Show it on the plan, then continue from there.
function renderHere(root, params, { building, room, why, here, routeParams, nav }) {
  const spot = findSpot(building.code, params.spot);
  if (!spot) {
    append(root, backLink(here({ stage: 'where' }), 'Back to photos'),
      h('p', null, "We don't know that place. Pick one of the photos instead."));
    return;
  }
  const variant = pickVariant({ ...params, why });
  const r = rejoin(building.code, room.number, spot, variant, params.from);
  const plan = drawPlan(FLOORS[building.code]?.[spot.floor], {
    highlight: r?.arrived ? room.number : spot.id, path: r?.path, marker: spot.at,
    background: getBahenBackground(building.code, spot.floor),
    label: `Floor ${spot.floor} plan: you are at ${spot.name}`,
  });
  const notRight = h('a', { class: 'btn', href: here({ stage: 'where', floor: spot.floor }) }, "That's not where I am");

  const back = backLink(here({ stage: 'where', floor: spot.floor }), 'Back to photos');
  if (r?.arrived) {
    append(root, back,
      h('h1', null, "You're already there"),
      plan,
      h('p', null, `${building.code} ${room.number} is the room you're standing at. Check the room plate.`),
      h('a', { class: 'btn btn-primary', href: nav.href('search') }, 'Finish route'),
      notRight);
    return;
  }
  if (!r) {
    const noRoute = !getRoute(building.code, room.number, variant, params.from);
    append(root, back,
      h('h1', null, `You're at ${spot.name}`),
      plan,
      h('p', { class: 'notice' }, noRoute
        ? `We have no indoor directions to ${room.number} yet. Ask at the lobby desk on floor 1.`
        : `We don't have directions from floor ${spot.floor} yet. Take the nearest elevator to floor 1 and ask at the lobby desk.`),
      notRight);
    return;
  }
  // The room is a few steps away: point them at it here. The route's last
  // step says "on your right", which is only true from the original approach.
  if (r.nearby) {
    append(root, back,
      h('p', { class: 'small muted' }, `Floor ${spot.floor} · ${building.code}`),
      h('h1', null, `You're at ${spot.name}`),
      plan,
      h('p', { class: 'muted small' }, 'Red dot: you. Line: the way to your room.'),
      h('div', { class: 'card rejoin' },
        h('strong', null, `${room.number} is close by on this floor.`),
        h('span', { class: 'small' }, `Follow the line on the plan and look for: ${r.toward}.`)),
      h('a', { class: 'btn btn-primary', href: nav.href('search') }, `I found ${room.number}: finish route`),
      notRight);
    return;
  }

  append(root, back,
    h('p', { class: 'small muted' }, `Floor ${spot.floor} · ${building.code}`),
    h('h1', null, `You're at ${spot.name}`),
    plan,
    h('p', { class: 'muted small' }, 'Red dot: you. Line: your new route on this floor.'),
    h('div', { class: 'card rejoin' },
      h('span', { class: 'small muted' }, 'First, head toward'),
      h('strong', null, r.toward),
      h('span', { class: 'small' }, `Then continue at step ${r.step}: ${r.text}`)),
    r.variant === 'blockedElevator' ? h('p', { class: 'notice small' }, 'This route avoids the blocked elevator.') : null,
    h('a', { class: 'btn btn-primary', href: nav.href('navigate', { ...routeParams, alt: r.variant === 'blockedElevator' ? 'blockedElevator' : undefined, step: r.step }) },
      'Start directions from here'),
    notRight,
  );
}
