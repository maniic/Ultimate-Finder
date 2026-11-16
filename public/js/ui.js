// Tiny DOM helpers shared by every view. Build elements with h() instead of
// innerHTML so text from data is never interpreted as HTML.
//
//   h('button', { class: 'btn', onclick: fn }, 'Next')
//   h('ul', null, items.map((i) => h('li', null, i.name)))

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) { if (typeof v === 'function') el.addEventListener(k.slice(2), v); continue; } // never string handlers
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

// Like el.append(), but skips null/undefined/false, so views can write
// `cond ? h(...) : null` (native append would print the text "null").
export function append(el, ...children) {
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

// A grey box standing in for a photo we haven't taken yet.
export function photo(caption, src) {
  return src
    ? h('img', { class: 'photo', src, alt: caption })
    : h('div', { class: 'photo photo-placeholder', role: 'img', 'aria-label': caption }, caption);
}

// "Back" link row used at the top of most views.
export function backLink(href, label = 'Back') {
  return h('a', { class: 'back-link', href }, `‹ ${label}`);
}

export function minutes(n) {
  return `${n} min`;
}
