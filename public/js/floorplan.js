// Shared SVG floor-plan renderer, used by the floor-plan view (full size), the
// navigate view (mini map) and facilities (mini map).
//
//   drawPlan(FLOORS.OI[10], { highlight: '10-210', path: [[56,30],[70,34]], marker: [56,30] })

const NS = 'http://www.w3.org/2000/svg';

function s(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

export function drawPlan(items, { highlight, path, marker, pins = [], mini = false, onSelect, label } = {}) {
  const svg = s('svg', {
    viewBox: '0 0 100 60', class: `plan${mini ? ' plan-mini' : ''}`,
    // role=img would hide the clickable rooms from screen readers.
    role: onSelect ? 'group' : 'img',
    'aria-label': label || (mini ? 'Mini map of your position on the route' : 'Floor plan'),
  });
  svg.append(s('rect', { x: 0, y: 0, width: 100, height: 60, class: 'plan-bg' }));

  for (const it of items || []) {
    const selected = it.id === highlight;
    const g = s('g', { class: `plan-item kind-${it.kind}${selected ? ' is-highlight' : ''}` });
    g.append(s('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 0.8 }));
    if (it.label && !mini) {
      g.append(s('text', { x: it.x + it.w / 2, y: it.labelY ?? it.y + it.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, it.label));
    }
    if (onSelect && it.kind !== 'corridor') {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', it.name || it.label || it.id);
      g.addEventListener('click', () => onSelect(it));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(it); } });
    }
    svg.append(g);
  }

  if (path && path.length > 1) {
    svg.append(s('polyline', { points: path.map((p) => p.join(',')).join(' '), class: 'plan-path' }));
  }
  for (const p of pins) {
    svg.append(s('circle', { cx: p.at[0], cy: p.at[1], r: 1.8, class: `plan-pin${p.status ? ` status-${p.status}` : ''}` }));
  }
  if (marker) {
    svg.append(s('circle', { cx: marker[0], cy: marker[1], r: 2.2, class: 'plan-marker' }));
  }
  return svg;
}

// Legend for the symbols above (heuristic-evaluation finding: add a legend).
export function legend() {
  const wrap = document.createElement('dl');
  wrap.className = 'plan-legend';
  for (const [kind, label] of [['room', 'Room'], ['elevator', 'Elevator'], ['stairs', 'Stairs'], ['washroom', 'Washroom (WR)'], ['facility', 'Facility'], ['entrance', 'Entrance']]) {
    const dt = document.createElement('dt');
    dt.className = `swatch kind-${kind}`;
    const dd = document.createElement('dd');
    dd.textContent = label;
    wrap.append(dt, dd);
  }
  return wrap;
}
