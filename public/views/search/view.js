// Owner: (your name here)
// VIEW: Search. Building (name or code) + room number. Prototype Fig. 2a/2b.
// In:  #/search?b=OI&r=10-210   (optional, pre-fills the form)
// Out: #/preview?b=<code>&r=<room>
//
// TODO (from the evaluation, see submitted_docs prototyping report):
//  - Think-aloud finding 3: people think in building NAMES. Name search works
//    here; consider a browsable list of all buildings too.
//  - HE4: recent destinations / saved rooms (lower priority).

import { h, append } from '/js/ui.js';
import { ROOMS } from '/js/data.js';

export const title = 'Find a room';

// Buildings come from the database (GET /api/buildings). Ones with
// enabled: false have no room data yet: they're listed but greyed out.
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

  const buildingInput = h('input', {
    type: 'search', id: 'building', autocomplete: 'off', placeholder: 'e.g. OISE or OI',
    'aria-describedby': 'building-hint',
  });
  const roomInput = h('input', { type: 'text', id: 'room', placeholder: 'e.g. 10-210', value: params.r || '', autocomplete: 'off' });
  const suggestions = h('ul', { class: 'suggestions', 'aria-label': 'Matching buildings' });
  const message = h('p', { class: 'message', role: 'status' });

  const ready = loadBuildings().then((list) => {
    buildings = list;
    const fromUrl = buildings.find((b) => b.enabled && b.code === String(params.b || '').toUpperCase());
    if (fromUrl) { chosen = fromUrl; buildingInput.value = fromUrl.name; }
  }).catch(() => {
    message.textContent = "Couldn't load the building list. Check your connection and reload.";
  });

  function showSuggestions() {
    chosen = undefined;
    const matches = buildingInput.value.trim().length >= 2 ? matchBuildings(buildings, buildingInput.value) : [];
    suggestions.replaceChildren(...matches.map((b) => h('li', null,
      h('button', {
        type: 'button', class: 'suggestion', disabled: !b.enabled,
        onclick: () => pick(b),
      }, h('strong', null, b.code), ' · ', b.name, b.enabled ? '' : h('span', { class: 'soon' }, ' (coming soon)')))));
  }

  function pick(b) {
    chosen = b;
    buildingInput.value = b.name;
    suggestions.replaceChildren();
    message.textContent = '';
    roomInput.focus();
  }

  function didYouMean(text) {
    const first = text.trim()[0]?.toLowerCase();
    return buildings.find((b) => b.enabled && (b.code[0].toLowerCase() === first || b.name[0].toLowerCase() === first));
  }

  async function submit(e) {
    e.preventDefault();
    await ready;
    const text = buildingInput.value;
    if (!chosen) {
      const matches = matchBuildings(buildings, text);
      const usable = matches.filter((b) => b.enabled);
      if (usable.length === 1) chosen = usable[0];
      else if (matches.length > 1) {
        message.textContent = usable.length ? 'Several buildings match. Pick one from the list.' : "Those buildings aren't available yet.";
        showSuggestions();
        return;
      } else if (matches.length === 1) {
        message.textContent = `${matches[0].name} isn't available yet. Directions are coming soon.`;
        return;
      }
    }
    if (!chosen) {
      const guess = didYouMean(text);
      message.replaceChildren(
        `No building matches "${text.trim()}".`,
        guess ? ' Did you mean ' : '',
        guess ? h('button', { type: 'button', class: 'linklike', onclick: () => pick(guess) }, guess.name.split(' · ')[0]) : '',
        guess ? '?' : '',
      );
      return;
    }
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

  buildingInput.addEventListener('input', showSuggestions);
  roomInput.addEventListener('input', () => roomInput.removeAttribute('aria-invalid'));

  append(root, 
    h('h1', null, 'Find a room'),
    h('p', { class: 'muted' }, 'Enter the building and room from your timetable.'),
    h('form', { class: 'card', onsubmit: submit, novalidate: true },
      h('label', { class: 'field', for: 'building' }, 'Building'),
      buildingInput,
      h('span', { id: 'building-hint', class: 'muted small' }, 'Name or code, like "OISE" or "OI".'),
      suggestions,
      h('label', { class: 'field', for: 'room' }, 'Room number'),
      roomInput,
      message,
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Find room'),
    ),
  );
}
