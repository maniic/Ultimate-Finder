// Owner: (your name here)
// VIEW: Search / landing. Building + room number. Prototype Fig. 2a/2b.
// In:  #/search?b=OI&r=10-210   (optional, pre-fills the form)
// Out: #/preview?b=<code>&r=<room>
//
// Flow: the building is pre-selected (from ?b=, else the last one used on
// this device, else the only enabled building) and shown as a chip with a
// "Change" link, so most people only type a room. Buildings come from the
// database (GET /api/buildings); ones with enabled: false have no room data
// yet, so they're listed but greyed out.
//
// TODO (from the evaluation, see submitted_docs prototyping report):
//  - HE4: recent destinations / saved rooms (lower priority).

import { h, append } from '/js/ui.js';
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

async function loadBuildings() {
  const res = await fetch('/api/buildings');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).buildings;
}

// Accepts a code ("oi", "OI") or part of a name ("oise", "bahen").
function matchBuildings(buildings, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return buildings.filter((b) => b.code.toLowerCase().startsWith(q) || b.name.toLowerCase().includes(q));
}

export function render(root, params, nav) {
  let buildings = [];
  let chosen;
  let picking = false;
  let loadFailed = false;

  const buildingBox = h('div', { class: 'building-box' }, h('p', { class: 'muted' }, 'Loading buildings…'));
  const roomInput = h('input', { type: 'text', id: 'room', placeholder: 'e.g. 10-210', value: params.r || '', autocomplete: 'off' });
  const roomChips = h('div', { class: 'chips' });
  const roomHint = h('p', { class: 'muted small', id: 'room-hint' });
  const message = h('p', { class: 'message', role: 'status' });
  const suggestions = h('ul', { class: 'suggestions', 'aria-label': 'Matching buildings' });
  const buildingInput = h('input', {
    type: 'search', id: 'building', autocomplete: 'off', placeholder: 'e.g. OISE or OI', 'aria-describedby': 'building-hint',
  });

  // ---- building section ---------------------------------------------------

  function drawBuilding() {
    if (loadFailed) { buildingBox.replaceChildren(); return; }
    if (chosen && !picking) {
      buildingBox.replaceChildren(h('div', { class: 'building-chip' },
        h('div', null, h('span', { class: 'muted small' }, 'Building'), h('strong', null, chosen.name)),
        h('button', { type: 'button', class: 'linklike', onclick: startPicking }, 'Change')));
      return;
    }
    buildingBox.replaceChildren(
      h('label', { class: 'field', for: 'building' }, 'Building'),
      buildingInput,
      h('span', { id: 'building-hint', class: 'muted small' }, 'Name or code, like "OISE" or "OI".'),
      suggestions,
    );
    showSuggestions();
  }

  function startPicking() {
    picking = true;
    message.textContent = '';
    buildingInput.value = '';
    drawBuilding();
    buildingInput.focus();
  }

  function showSuggestions() {
    const typed = buildingInput.value.trim();
    // Before they type, offer the buildings that work right now.
    const list = typed.length >= 2 ? matchBuildings(buildings, typed) : buildings.filter((b) => b.enabled);
    suggestions.replaceChildren(...list.map((b) => h('li', null,
      h('button', {
        type: 'button', class: 'suggestion', disabled: !b.enabled,
        onclick: () => pick(b),
      }, h('strong', null, b.code), ' · ', b.name, b.enabled ? '' : h('span', { class: 'soon' }, ' (coming soon)')))));
  }

  function pick(b) {
    chosen = b;
    picking = false;
    rememberBuilding(b.code);
    message.textContent = '';
    suggestions.replaceChildren();
    drawBuilding();
    drawRooms();
    roomInput.focus();
  }

  function didYouMean(text) {
    const first = text.trim()[0]?.toLowerCase();
    return buildings.find((b) => b.enabled && (b.code[0].toLowerCase() === first || b.name[0].toLowerCase() === first));
  }

  // ---- room section -------------------------------------------------------

  function drawRooms() {
    const known = chosen ? ROOMS[chosen.code] || [] : [];
    roomHint.textContent = known.length ? 'Tap a room to try it:' : '';
    roomChips.replaceChildren(...known.map((r) => h('button', {
      type: 'button', class: 'chip', onclick: () => { roomInput.value = r.number; form.requestSubmit(); },
    }, r.number)));
  }

  // ---- submit -------------------------------------------------------------

  // While the picker is open, work out which building the typed text means.
  function resolveTyped() {
    const text = buildingInput.value;
    const matches = matchBuildings(buildings, text);
    const usable = matches.filter((b) => b.enabled);
    if (usable.length === 1) { pick(usable[0]); return true; }
    if (matches.length > 1) {
      message.textContent = usable.length ? 'Several buildings match. Pick one from the list.' : "Those buildings aren't available yet.";
      showSuggestions();
    } else if (matches.length === 1) {
      message.textContent = `${matches[0].name} isn't available yet. Directions are coming soon.`;
    } else if (text.trim()) {
      const guess = didYouMean(text);
      message.replaceChildren(
        `No building matches "${text.trim()}".`,
        guess ? ' Did you mean ' : '',
        guess ? h('button', { type: 'button', class: 'linklike', onclick: () => pick(guess) }, guess.name.split(' · ')[0]) : '',
        guess ? '?' : '',
      );
    } else {
      message.textContent = 'Choose a building first.';
    }
    return false;
  }

  async function submit(e) {
    e.preventDefault();
    await ready;
    if (loadFailed) {
      message.textContent = "Couldn't load the building list. Check your connection and reload.";
      return;
    }
    if (picking && !resolveTyped()) return;
    if (!chosen) { message.textContent = 'Choose a building first.'; startPicking(); return; }
    const room = roomInput.value.trim();
    if (!room) { message.textContent = 'Enter a room number.'; roomInput.focus(); return; }
    const known = ROOMS[chosen.code] || [];
    if (!known.some((r) => r.number === room)) {
      message.textContent = `${chosen.code} has no room "${room}".` +
        (known.length ? ` Rooms we know: ${known.map((r) => r.number).join(', ')}.` : '');
      roomInput.setAttribute('aria-invalid', 'true');
      roomInput.focus();
      return;
    }
    nav.go('preview', { b: chosen.code, r: room });
  }

  // ---- wiring -------------------------------------------------------------

  const ready = loadBuildings().then((list) => {
    buildings = list;
    const enabled = buildings.filter((b) => b.enabled);
    const byCode = (code) => enabled.find((b) => b.code === String(code || '').toUpperCase());
    chosen = byCode(params.b) || byCode(lastBuilding()) || (enabled.length === 1 ? enabled[0] : undefined);
    picking = !chosen;
    drawBuilding();
    drawRooms();
  }).catch(() => {
    loadFailed = true;
    drawBuilding();
    message.textContent = "Couldn't load the building list. Check your connection and reload.";
  });

  buildingInput.addEventListener('input', () => { message.textContent = ''; showSuggestions(); });
  roomInput.addEventListener('input', () => roomInput.removeAttribute('aria-invalid'));

  const form = h('form', { class: 'card', onsubmit: submit, novalidate: true },
    buildingBox,
    h('label', { class: 'field', for: 'room' }, 'Room number'),
    roomInput,
    roomHint,
    roomChips,
    message,
    h('button', { type: 'submit', class: 'btn btn-primary' }, 'Find room'),
  );

  append(root,
    h('h1', null, 'Where to?'),
    h('p', { class: 'muted' }, 'Enter the room from your timetable.'),
    form,
  );
  roomInput.focus();
}
