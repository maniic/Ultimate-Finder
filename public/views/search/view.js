// Owner: (your name here)
// VIEW: Landing + room search. Three steps, all in this view, driven by URL
// params so every step is linkable and the back button works:
//   #/search                    1. choose a building (cards, with filter)
//   #/search?b=OI               2. what do you need? Find a room / a facility
//   #/search?b=OI&mode=room     3. enter the room number
// Out: #/preview?b=<code>&r=<room>  ·  #/facilities?b=<code>
//
// Buildings come from the database (GET /api/buildings). Ones with
// enabled: false have no room data yet, so they're shown greyed out and
// can't be opened. The last building used is remembered on this device.
//
// TODO:
//  - Facilities ignores ?b= today and is mock-OISE only; it should take an
//    anchor (an entrance or a room) and rank by walk time from it.
//  - HE4: recent destinations / saved rooms (lower priority).

import { h, append, backLink } from '/js/ui.js';
import { ROOMS } from '/js/data.js';

export const title = 'Find a room';

const LAST_BUILDING_KEY = 'uf.building';

// localStorage can be missing or throw (private windows); it's only a
// convenience, so every access is wrapped.
function lastBuilding() {
  try { return localStorage.getItem(LAST_BUILDING_KEY) || ''; } catch { return ''; }
}
function rememberBuilding(code) {
  try { localStorage.setItem(LAST_BUILDING_KEY, code); } catch { /* ignore */ }
}

let buildingsPromise;
function loadBuildings() {
  buildingsPromise ??= fetch('/api/buildings')
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .then((data) => data.buildings)
    .catch((err) => { buildingsPromise = undefined; throw err; }); // retry next time
  return buildingsPromise;
}

// Accepts a code ("oi", "OI") or part of a name ("oise", "bahen").
function matches(b, query) {
  const q = query.trim().toLowerCase();
  return !q || b.code.toLowerCase().startsWith(q) || b.name.toLowerCase().includes(q);
}

// "OISE · Ontario Institute for Studies in Education" -> short + long parts.
function splitName(name) {
  const [short, ...rest] = name.split(' · ');
  return { short, long: rest.join(' · ') };
}

export function render(root, params, nav) {
  append(root, h('p', { class: 'muted' }, 'Loading buildings…'));
  loadBuildings().then((buildings) => {
    const code = String(params.b || '').toUpperCase();
    const chosen = buildings.find((b) => b.enabled && b.code === code);
    root.replaceChildren();
    if (!chosen) return drawPicker(root, buildings, nav, params.b ? "That building isn't available yet." : '');
    rememberBuilding(chosen.code);
    if (params.mode === 'room') return drawRoom(root, chosen, params, nav);
    return drawChoice(root, chosen, nav);
  }).catch(() => {
    root.replaceChildren(h('p', { class: 'message' }, "Couldn't load the building list. Check your connection and reload."));
  });
}

// ---- step 1: choose a building ---------------------------------------------

function drawPicker(root, buildings, nav, notice) {
  const last = lastBuilding();
  const grid = h('div', { class: 'bgrid' });
  const empty = h('p', { class: 'muted', role: 'status' });
  const filter = h('input', {
    type: 'search', id: 'building', autocomplete: 'off', placeholder: 'Search by name or code, like OISE or OI',
    'aria-label': 'Search buildings',
  });

  function drawCards() {
    const q = filter.value;
    const list = buildings.filter((b) => matches(b, q)).sort((a, b) =>
      (b.enabled - a.enabled) || ((b.code === last) - (a.code === last)) || a.name.localeCompare(b.name));
    grid.replaceChildren(...list.map((b) => {
      const { short, long } = splitName(b.name);
      const inner = [
        h('span', { class: 'code' }, b.code),
        h('strong', null, short),
        long ? h('span', { class: 'muted small' }, long) : null,
        b.enabled ? (b.code === last ? h('span', { class: 'tag' }, 'Last used') : null) : h('span', { class: 'tag soon' }, 'Coming soon'),
      ];
      return b.enabled
        ? h('a', { class: 'bcard', href: nav.href('search', { b: b.code }) }, inner)
        : h('div', { class: 'bcard disabled', 'aria-disabled': 'true' }, inner);
    }));
    empty.textContent = list.length ? '' : `No building matches "${q.trim()}".`;
  }

  filter.addEventListener('input', drawCards);
  append(root,
    h('h1', null, 'Which building?'),
    h('p', { class: 'muted' }, 'Pick where you are headed. You can find a room or a facility next.'),
    notice ? h('p', { class: 'message', role: 'status' }, notice) : null,
    filter, grid, empty,
  );
  drawCards();
}

// ---- step 2: room or facility ----------------------------------------------

function drawChoice(root, b, nav) {
  const { short, long } = splitName(b.name);
  const known = ROOMS[b.code] || [];
  append(root,
    backLink(nav.href('search'), 'Change building'),
    h('div', { class: 'where' },
      h('span', { class: 'code' }, b.code),
      h('div', null, h('strong', null, short), long ? h('div', { class: 'muted small' }, long) : null)),
    h('h1', null, 'What do you need?'),
    h('a', { class: 'choice', href: nav.href('search', { b: b.code, mode: 'room' }) },
      h('strong', null, 'Find a room'),
      h('span', { class: 'muted' }, 'Directions to a classroom, office or seminar room'),
      known.length ? h('span', { class: 'muted small' }, `Try ${known.slice(0, 3).map((r) => r.number).join(', ')}`) : null),
    h('a', { class: 'choice', href: nav.href('facilities', { b: b.code }) },
      h('strong', null, 'Find a facility'),
      h('span', { class: 'muted' }, 'Bottle fillers, washrooms, microwaves, charging and more')),
  );
}

// ---- step 3: room number ---------------------------------------------------

function drawRoom(root, b, params, nav) {
  const known = ROOMS[b.code] || [];
  const roomInput = h('input', { type: 'text', id: 'room', placeholder: 'e.g. 10-210', value: params.r || '', autocomplete: 'off' });
  const message = h('p', { class: 'message', role: 'status' });

  function submit(e) {
    e.preventDefault();
    const room = roomInput.value.trim();
    if (!room) { message.textContent = 'Enter a room number.'; roomInput.focus(); return; }
    if (!known.some((r) => r.number === room)) {
      message.textContent = `${b.code} has no room "${room}".` +
        (known.length ? ` Rooms we know: ${known.map((r) => r.number).join(', ')}.` : '');
      roomInput.setAttribute('aria-invalid', 'true');
      roomInput.focus();
      return;
    }
    nav.go('preview', { b: b.code, r: room });
  }

  roomInput.addEventListener('input', () => roomInput.removeAttribute('aria-invalid'));
  const form = h('form', { class: 'card', onsubmit: submit, novalidate: true },
    h('label', { class: 'field', for: 'room' }, 'Room number'),
    roomInput,
    known.length ? h('p', { class: 'muted small' }, 'Or tap a room:') : null,
    h('div', { class: 'chips' }, known.map((r) => h('button', {
      type: 'button', class: 'chip', onclick: () => { roomInput.value = r.number; form.requestSubmit(); },
    }, r.number))),
    message,
    h('button', { type: 'submit', class: 'btn btn-primary' }, 'Find room'),
  );

  append(root,
    backLink(nav.href('search', { b: b.code }), splitName(b.name).short),
    h('h1', null, 'Which room?'),
    form,
  );
  roomInput.focus();
}
