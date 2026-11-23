// Shared SVG floor-plan renderer, used by the floor-plan view (full size), the
// navigate view (mini map) and facilities (mini map).
//
//   drawPlan(FLOORS.OI[10], { highlight: '10-210', path: [[56,30],[70,34]], marker: [56,30] })

const NS = 'http://www.w3.org/2000/svg';
let nextArrowId = 0;

function s(tag, attrs, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== undefined && v !== null) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

function routeViewBox(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const spanX = Math.max(...xs) - left;
  const spanY = Math.max(...ys) - top;
  const width = Math.max(spanX + 10, (spanY + 8) * 2.4);
  const height = width / 2.4;
  return [left + (spanX - width) / 2, top + (spanY - height) / 2, width, height].join(' ');
}

export function drawPlan(items, { highlight, path, marker, pins = [], mini = false, onSelect, label, background } = {}) {
  const viewBox = background && mini && path?.length > 1 ? routeViewBox(path) : background?.viewBox;
  const svg = s('svg', {
    viewBox: viewBox || '0 0 100 60',
    class: `plan${mini ? ' plan-mini' : ''}${background ? ' plan-reference' : ''}`,
    // role=img would hide the clickable rooms from screen readers.
    role: onSelect ? 'group' : 'img',
    'aria-label': label || (mini ? 'Mini map of your position on the route' : 'Floor plan'),
  });
  svg.append(s('rect', { x: 0, y: 0, width: background?.width || 100, height: background?.height || 60, class: 'plan-bg' }));
  if (background) {
    svg.append(s('image', {
      href: background.href, x: 0, y: 0, width: background.width, height: background.height, 'aria-hidden': 'true',
    }));
  }
  const labels = background && !mini ? s('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }) : null;

  for (const it of items || []) {
    const selected = it.id === highlight;
    const g = s('g', { class: `plan-item kind-${it.kind}${it.facility ? ' plan-facility' : ''}${selected ? ' is-highlight' : ''}` });
    if (it.facility) {
      if (onSelect) {
        const hitRadius = items.reduce((radius, other) => other.facility && other !== it
          ? Math.min(radius, 0.48 * Math.hypot(it.at[0] - other.at[0], it.at[1] - other.at[1])) : radius, 3.4);
        g.append(s('circle', { class: 'plan-facility-hit', cx: it.at[0], cy: it.at[1], r: hitRadius }));
      }
      g.append(s('circle', { class: 'plan-facility-dot', cx: it.at[0], cy: it.at[1], r: selected ? 1.35 : 1 }));
    } else {
      g.append(s('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 0.8 }));
    }
    if (it.label && !mini && (!it.facility || selected)) {
      const labelY = it.facility ? it.at[1] - 3 : (it.labelY ?? it.y + it.h / 2);
      (labels || g).append(s('text', { class: 'plan-label', x: it.x + it.w / 2, y: labelY, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, it.label));
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
    const points = path.map((p) => p.join(',')).join(' ');
    let arrow;
    if (background) {
      const id = `plan-arrow-${nextArrowId++}`;
      svg.append(s('defs', {}, s('marker', {
        id, viewBox: '0 0 6 6', markerWidth: 3, markerHeight: 3,
        markerUnits: 'userSpaceOnUse', refX: 5.2, refY: 3, orient: 'auto',
      }, s('path', { d: 'M0 0 L6 3 L0 6 Z', class: 'plan-arrow' }))));
      svg.append(s('polyline', { points, class: 'plan-path-outline', 'aria-hidden': 'true' }));
      arrow = `url(#${id})`;
    }
    svg.append(s('polyline', { points, class: 'plan-path', 'marker-end': arrow, 'aria-hidden': 'true' }));
  }
  for (const p of pins) {
    svg.append(s('circle', { cx: p.at[0], cy: p.at[1], r: 1.8, class: `plan-pin${p.status ? ` status-${p.status}` : ''}` }));
  }
  if (marker) {
    svg.append(s('circle', { cx: marker[0], cy: marker[1], r: 2.2, class: 'plan-marker' }));
  }
  if (labels) svg.append(labels);
  return svg;
}

// Legend for the symbols above (heuristic-evaluation finding: add a legend).
export function legend({ reference = false } = {}) {
  const wrap = document.createElement('dl');
  wrap.className = reference ? 'plan-legend plan-legend-reference' : 'plan-legend';
  for (const [kind, label] of [['room', 'Room'], ['elevator', 'Elevator'], ['stairs', 'Stairs'], ['washroom', 'Washroom (WR)'], ['facility', 'Facility'], ['entrance', 'Entrance']]) {
    const dt = document.createElement('dt');
    dt.className = `swatch kind-${kind}`;
    const dd = document.createElement('dd');
    dd.textContent = label;
    wrap.append(dt, dd);
  }
  return wrap;
}
