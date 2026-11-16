// VIEW: Search. Building (name or code) + room number. Prototype Fig. 2a/2b.
// In:  #/search?b=OI&r=10-210   (optional, pre-fills the form)
// Out: #/preview?b=<code>&r=<room>
//
// TODO (from the evaluation, see submitted_docs prototyping report):
//  - Think-aloud finding 3: people think in building NAMES. Name search works
//    here; consider a browsable list of all buildings too.
//  - HE4: recent destinations / saved rooms (lower priority).
//  - Real building list (codes + names) instead of the mock in data.js.

import { h, append } from '/js/ui.js';
import { searchBuildings, getBuilding, getRoom, BUILDINGS } from '/js/data.js';

export const title = 'Find a room';

export function render(root, params, nav) {
  let chosen = getBuilding(params.b);

  const buildingInput = h('input', {
    type: 'search', id: 'building', autocomplete: 'off', placeholder: 'e.g. OISE or OI',
    value: chosen ? chosen.name : '', 'aria-describedby': 'building-hint',
  });
  const roomInput = h('input', { type: 'text', id: 'room', placeholder: 'e.g. 10-210', value: params.r || '', autocomplete: 'off' });
  const suggestions = h('ul', { class: 'suggestions', role: 'listbox', 'aria-label': 'Matching buildings' });
  const message = h('p', { class: 'message', role: 'status' });

  function showSuggestions() {
    chosen = undefined;
    const matches = buildingInput.value.trim().length >= 2 ? searchBuildings(buildingInput.value) : [];
    suggestions.replaceChildren(...matches.map((b) =>
      h('li', null, h('button', { type: 'button', class: 'suggestion', onclick: () => pick(b) },
        h('strong', null, b.code), ' · ', b.name))));
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
    return BUILDINGS.find((b) => b.code[0].toLowerCase() === first || b.name[0].toLowerCase() === first);
  }

  function submit(e) {
    e.preventDefault();
    const text = buildingInput.value;
    if (!chosen) {
      const matches = searchBuildings(text);
      if (matches.length === 1) chosen = matches[0];
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
    if (!getRoom(chosen.code, room)) {
      message.textContent = `We don't have directions to ${chosen.code} ${room} yet. (Mock data: try OI 10-210.)`;
      return;
    }
    nav.go('preview', { b: chosen.code, r: room });
  }

  buildingInput.addEventListener('input', showSuggestions);

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
