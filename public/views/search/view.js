// Owner: (your name here)
// VIEW: Landing + search. Three steps, all in this view, driven by URL params
// so every step is linkable and the back button works:
//   #/search                    1. search anything, or pick a building
//   #/search?b=OI               2. what do you need? Find a room / a facility
//   #/search?b=OI&mode=room     3. enter the room number
// Out: #/preview?b=<code>&r=<room> or &fac=<facility>  ·  #/facilities?type=<id>&b=<code>
//
// Step 1's search box takes a whole destination: "OI 10-210", "10-210",
// "bahen", "bottle filler", "washroom". Results are grouped (rooms,
// facilities, buildings) and Enter opens the top one.
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
import { ROOMS, FACILITY_TYPES, FACILITIES } from '/js/data.js';

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

// "OISE · Ontario Institute for Studies in Education" -> short + long parts.
function splitName(name) {
  const [short, ...rest] = name.split(' · ');
  return { short, long: rest.join(' · ') };
}

// Words people type for each facility type, besides its name.
const KEYWORDS = {
  'bottle-filler': 'water bottle refill drink',
  'water-fountain': 'water drink drinking fountains',
  microwave: 'food heat lunch eat',
  charging: 'charge outlet plug power phone',
  washroom: 'washrooms bathrooms toilets restrooms wc',
  prayer: 'pray prayer room space multi-faith faith quiet',
};
const ICONS = { room: '🚪', 'bottle-filler': '💧', 'water-fountain': '🚰', microwave: '🍲', charging: '🔌', washroom: '🚻', prayer: '🕌' };

function icon(kind) {
  return h('span', { class: 'ico', 'aria-hidden': 'true' }, ICONS[kind] || '📍');
}

function searchIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'search-ico');
  svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(ns, 'circle');
  c.setAttribute('cx', '10.5'); c.setAttribute('cy', '10.5'); c.setAttribute('r', '6.5');
  const l = document.createElementNS(ns, 'path');
  l.setAttribute('d', 'm15.5 15.5 5 5');
  for (const el of [c, l]) { el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '2.2'); el.setAttribute('stroke-linecap', 'round'); }
  svg.append(c, l);
  return svg;
}

export function render(root, params, nav) {
  const loading = h('p', { class: 'muted' }, 'Loading buildings…');
  append(root, loading);
  // The router wipes root on navigation, so if the placeholder is gone a newer
  // view owns root and this (stale) callback must not touch it.
  loadBuildings().then((buildings) => {
    if (!root.contains(loading)) return;
    const code = String(params.b || '').toUpperCase();
    const chosen = buildings.find((b) => b.enabled && b.code === code);
    root.replaceChildren();
    if (!chosen) return drawLanding(root, buildings, nav, params.b ? "That building isn't available yet." : '');
    rememberBuilding(chosen.code);
    // The preview view's "Change room" link sends ?b=&r=, so a room param means step 3.
    if (params.mode === 'room' || params.r) return drawRoom(root, chosen, params, nav);
    return drawChoice(root, chosen, nav);
  }).catch(() => {
    if (!root.contains(loading)) return;
    root.replaceChildren(h('p', { class: 'message' }, "Couldn't load the building list. Check your connection and reload."));
  });
}

// ---- step 1: search anything, or pick a building ---------------------------

// Every token the person typed has to appear somewhere in the haystack, so
// "oi 10-210", "10-210" and "210" all find OISE 10-210.
const allTokens = (q, hay) => q.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
const normalizeSearchText = (text) => text.toLowerCase().replace(/['’‘]/g, '');

function facilityRoomNumber(facility) {
  const number = String(facility.roomNumber ?? '').trim();
  return number.toUpperCase().startsWith(facility.building)
    ? number.slice(facility.building.length).trim()
    : number;
}

function search(buildings, query) {
  const q = normalizeSearchText(query.trim());
  if (!q) return null;
  const enabled = new Map(buildings.filter((b) => b.enabled).map((b) => [b.code, b]));
  const terms = q.split(/\s+/);
  const compact = q.replace(/\s+/g, '');
  const rooms = [];
  for (const b of enabled.values()) {
    for (const r of ROOMS[b.code] || []) {
      // A room matches only if part of the query is about the room itself, so
      // searching a building name doesn't list all of its rooms.
      const own = `${r.number} ${r.type}`.toLowerCase();
      const exactWithCode = compact === `${b.code}${r.number}`.toLowerCase();
      if (exactWithCode || (allTokens(q, `${b.code} ${b.name} ${own}`.toLowerCase()) && terms.some((t) => own.includes(t)))) rooms.push({ b, r });
    }
  }
  const locations = [];
  if (q.length >= 2) {
    for (const f of FACILITIES) {
      const b = enabled.get(f.building);
      if (!b || !f.label) continue;
      const number = facilityRoomNumber(f);
      const address = number ? `${b.code}${number}` : '';
      const exact = number && (compact === address.toLowerCase() || q === number.toLowerCase());
      const building = `${b.code} ${b.name}`.toLowerCase();
      const buildingWords = building.split(/\W+/);
      const type = FACILITY_TYPES.find((t) => t.id === f.type);
      const own = normalizeSearchText([f.label, address, f.near, type?.name, KEYWORDS[f.type], ...(f.aliases ?? [])].join(' '));
      const mentionsFacility = terms.some((term) => !buildingWords.includes(term) && own.includes(term));
      const genderMatches = terms.every((term) => !['mens', 'womens'].includes(term) || own.split(/\W+/).includes(term));
      if (exact || (mentionsFacility && genderMatches && allTokens(q, `${building} ${own}`))) {
        locations.push({ b, f, address, exact: Boolean(exact) });
      }
    }
    locations.sort((a, b) => Number(b.exact) - Number(a.exact));
  }
  const scope = [...enabled.values()].find((building) => {
    const short = splitName(building.name).short.toLowerCase().split(' ')[0];
    return terms.includes(building.code.toLowerCase()) || terms.includes(short);
  });
  const facilities = q.length < 2 || (scope && locations.length) ? [] : FACILITY_TYPES
    .filter((t) => allTokens(q, `${t.name} ${t.id} ${KEYWORDS[t.id] || ''}`.toLowerCase()))
    .map((t) => {
      const here = FACILITIES.filter((f) => f.type === t.id && enabled.has(f.building));
      const codes = [...new Set(here.map((f) => f.building))];
      return { t, count: here.length, where: codes.join(', '), building: codes.length === 1 ? codes[0] : undefined };
    });
  const blds = buildings.filter((b) => allTokens(q, `${b.code} ${b.name}`.toLowerCase()) &&
    (b.code.toLowerCase().startsWith(q) || b.name.toLowerCase().includes(q) || q.length >= 2));
  return { rooms, locations, facilities, blds };
}

function drawLanding(root, buildings, nav, notice) {
  const last = lastBuilding();
  const results = h('div', { class: 'results', role: 'region', 'aria-label': 'Search results', 'aria-live': 'polite' });
  const grid = h('div', { class: 'bgrid' });
  const browse = h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Buildings'), grid);
  const input = h('input', {
    type: 'search', id: 'q', autocomplete: 'off', enterkeyhint: 'go',
    placeholder: 'Try "OI 10-210" or "water"',
    'aria-label': 'Search for a room, facility or building',
  });
  const hint = h('p', { class: 'message', role: 'status' });
  let first; // what Enter opens

  function buildingCard(b) {
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
  }

  const row = (kind, href, main, sub, disabled) => (disabled
    ? h('div', { class: 'row disabled', 'aria-disabled': 'true' }, icon(kind), h('div', { class: 'grow' }, h('strong', null, main), h('div', { class: 'muted small' }, sub)))
    : h('a', { class: 'row', href }, icon(kind), h('div', { class: 'grow' }, h('strong', null, main), h('div', { class: 'muted small' }, sub)), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));

  function draw() {
    const res = search(buildings, input.value);
    first = undefined;
    if (!res) { // nothing typed: browse
      results.replaceChildren();
      browse.hidden = false;
      return;
    }
    browse.hidden = true;
    const sections = [];
    if (res.rooms.length) {
      const items = res.rooms.map(({ b, r }) => {
        const href = nav.href('preview', { b: b.code, r: r.number });
        first ??= href;
        return row('room', href, `${splitName(b.name).short} · Room ${r.number}`, `${r.type} · floor ${r.floor}`);
      });
      sections.push(h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Rooms'), ...items));
    }
    if (res.locations.length) {
      const items = res.locations.map(({ b, f, address }) => {
        const href = nav.href('preview', { b: b.code, fac: f.id });
        first ??= href;
        const location = [splitName(b.name).short, `Floor ${f.floor}`, address].filter(Boolean).join(' · ');
        return row(f.type, href, f.label, location);
      });
      sections.push(h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Facilities'), ...items));
    }
    if (res.facilities.length) {
      const items = res.facilities.map(({ t, count, where, building }) => {
        const href = nav.href('facilities', { b: building, type: t.id });
        if (count) first ??= href;
        return row(t.id, href, t.name, count ? `${count} place${count === 1 ? '' : 's'} · ${where}` : 'No locations yet', !count);
      });
      sections.push(h('section', { class: 'section' }, h('h2', { class: 'section-title' }, res.locations.length ? 'Facility types' : 'Facilities'), ...items));
    }
    if (res.blds.length) {
      const items = res.blds.sort((a, b) => (b.enabled - a.enabled) || a.name.localeCompare(b.name)).map((b) => {
        const href = nav.href('search', { b: b.code });
        if (b.enabled) first ??= href;
        return row('building', href, splitName(b.name).short, `${b.code}${b.enabled ? '' : ' · coming soon'}`, !b.enabled);
      });
      sections.push(h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Buildings'), ...items));
    }
    results.replaceChildren(...(sections.length ? sections
      : [h('p', { class: 'muted' }, `Nothing matches "${input.value.trim()}". Try a room like 10-210, a facility like "water", or a building name.`)]));
  }

  function submit(e) {
    e.preventDefault();
    if (first) { location.hash = first; return; }
    hint.textContent = input.value.trim() ? 'Nothing available to open for that yet.' : 'Type a room, facility or building first.';
  }

  input.addEventListener('input', () => { hint.textContent = ''; draw(); });
  grid.replaceChildren(...[...buildings].sort((a, b) =>
    (b.enabled - a.enabled) || ((b.code === last) - (a.code === last)) || a.name.localeCompare(b.name)).map(buildingCard));

  append(root,
    h('header', { class: 'hero' },
      h('h1', null, 'Find your way around St. George'),
      h('p', null, 'Rooms, facilities and buildings, with step-by-step directions.'),
      h('form', { class: 'searchbox', onsubmit: submit, role: 'search' }, searchIcon(), input)),
    notice ? h('p', { class: 'message', role: 'status' }, notice) : null,
    hint, results, browse,
  );
  draw();
}

// ---- step 2: room or facility ----------------------------------------------

function buildingHero(b, nav, backHref, backLabel, heading) {
  const { short, long } = splitName(b.name);
  return h('header', { class: 'hero compact' },
    backLink(backHref, backLabel),
    h('div', { class: 'where' }, h('span', { class: 'code solid' }, b.code),
      h('div', null, h('strong', null, short), long ? h('div', { class: 'small' }, long) : null)),
    h('h1', null, heading));
}

function drawChoice(root, b, nav) {
  const known = ROOMS[b.code] || [];
  append(root,
    buildingHero(b, nav, nav.href('search'), 'Change building', 'What do you need?'),
    h('a', { class: 'choice', href: nav.href('search', { b: b.code, mode: 'room' }) },
      icon('room'),
      h('div', { class: 'grow' }, h('strong', null, 'Find a room'),
        h('div', { class: 'muted' }, 'Directions to a classroom, office or seminar room'),
        known.length ? h('div', { class: 'muted small' }, `Try ${known.slice(0, 3).map((r) => r.number).join(', ')}`) : null),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')),
    h('a', { class: 'choice', href: nav.href('facilities', { b: b.code }) },
      icon('bottle-filler'),
      h('div', { class: 'grow' }, h('strong', null, 'Find a facility'),
        h('div', { class: 'muted' }, 'Bottle fillers, washrooms, microwaves, charging and more')),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')),
  );
}

// ---- step 3: room number ---------------------------------------------------

function drawRoom(root, b, params, nav) {
  const known = ROOMS[b.code] || [];
  const example = known[0] ? `e.g. ${b.code} ${known[0].number}` : 'Enter a room number';
  const roomInput = h('input', { type: 'text', id: 'room', placeholder: example, value: params.r || '', autocomplete: 'off' });
  const message = h('p', { class: 'message', role: 'status' });

  function submit(e) {
    e.preventDefault();
    const entered = roomInput.value.trim();
    const room = entered.toUpperCase().startsWith(b.code) ? entered.slice(b.code.length).trim() : entered;
    if (!room) { message.textContent = 'Enter a room number.'; roomInput.focus(); return; }
    if (!known.some((r) => r.number === room)) {
      const facility = FACILITIES.find((f) => f.building === b.code && facilityRoomNumber(f).toLowerCase() === room.toLowerCase());
      if (facility) {
        nav.go('preview', { b: b.code, fac: facility.id });
        return;
      }
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

  append(root, buildingHero(b, nav, nav.href('search', { b: b.code }), 'Back', 'Which room?'), form);
  roomInput.focus();
}
