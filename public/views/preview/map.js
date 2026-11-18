// Outdoor map for Route preview: walking directions from where you are (or
// a start point you pick) to the building entrance. Google Maps JS API with
// the Routes library; falls back to an "Open in Google Maps" link when
// there's no key or the script can't load.
//
// Location is only requested when the person taps "Directions from my
// location". With ?sim=1 a facilitator panel fakes the position, for
// usability sessions run indoors.

import { h } from '/js/ui.js';
import { GOOGLE_MAPS_API_KEY } from '/js/config.js';
import {
  chooseDestination, directionsUrl, distanceMeters, formatDistance, geoErrorState,
  hasArrived, isValidLatLng, stepToward, summarizeRoute, walkMinutes,
} from './outdoor.js';
import { START_POINTS } from './places.js';

const SIM_STEP_M = 50;

// Local testing: localStorage.setItem('uf.mapsKey', '<key>') overrides the
// committed key in this browser only.
function mapsKey() {
  try { const k = localStorage.getItem('uf.mapsKey'); if (k) return k; } catch { /* ignore */ }
  return GOOGLE_MAPS_API_KEY;
}

let mapsPromise;
let authFailed = false;
function loadGoogleMaps(key) {
  if (authFailed) return Promise.reject(new Error('auth'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  mapsPromise ??= new Promise((resolve, reject) => {
    const cb = '__ufMapsReady';
    window[cb] = () => resolve(window.google.maps);
    // Google calls this when the key is rejected (wrong referrer, API off).
    window.gm_authFailure = () => {
      authFailed = true;
      reject(new Error('auth'));
      window.dispatchEvent(new Event('uf-maps-auth-failure'));
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: cb })}`;
    s.async = true;
    s.onerror = () => reject(new Error('load'));
    document.head.append(s);
    setTimeout(() => reject(new Error('timeout')), 15000);
  }).catch((err) => { mapsPromise = undefined; throw err; });
  return mapsPromise;
}

// Only one live location watch at a time, across re-renders.
let activeWatch = null;
function stopWatch() {
  if (activeWatch !== null) navigator.geolocation?.clearWatch(activeWatch);
  activeWatch = null;
}

const GEO_MESSAGES = {
  denied: "Location is off for this site, so we can't see where you are. Choose where you're starting from below, or allow location in your browser settings and try again.",
  timeout: "Finding your location took too long. Try again outside, or choose where you're starting from below.",
  unavailable: "We couldn't find your location. Choose where you're starting from below.",
  unsupported: "This browser can't share your location. Choose where you're starting from below.",
};

// opts: { entrances, routeEntranceId, stepFree, sim, arrival: { href, label } | null,
//         onRoute(summary) }
export function outdoorMap(opts) {
  stopWatch();
  const { entrances, routeEntranceId, stepFree, sim, arrival, onRoute = () => {} } = opts;
  const state = { origin: null, position: null, dest: null, maps: null, map: null, lines: [], dot: null, pins: new Map(), arrived: false };
  state.dest = chooseDestination(entrances, { routeEntranceId, stepFree });

  const mapEl = h('div', { class: 'map', role: 'region', 'aria-label': 'Map of the walk to the entrance' });
  const closeBtn = h('button', { type: 'button', class: 'btn map-close', onclick: () => setExpanded(false) }, 'Close map');
  const expandBtn = h('button', { type: 'button', class: 'btn btn-small map-expand', onclick: () => setExpanded(true) }, 'Full screen');
  const mapBox = h('div', { class: 'map-box' }, mapEl, expandBtn, closeBtn);
  const status = h('p', { class: 'map-status', 'aria-live': 'polite' });
  const notice = h('p', { class: 'notice small', hidden: true, role: 'status' });
  const stepsList = h('ol', { class: 'map-steps small' });
  const steps = h('details', { class: 'map-steps-wrap', hidden: true }, h('summary', null, 'Show steps'), stepsList);
  const arrivalBox = h('div', { class: 'notice arrival', hidden: true, role: 'status' });
  const gmLink = h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: directionsUrl({ destination: state.dest }) }, 'Open in Google Maps');
  const locateBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: locate }, 'Directions from my location');
  const startSelect = h('select', { id: 'map-start', onchange: (e) => pickStart(e.target.value) },
    h('option', { value: '' }, 'Choose a place…'),
    START_POINTS.map((p) => h('option', { value: p.id }, p.name)));
  const startRow = h('label', { class: 'map-start small', for: 'map-start' }, "Or choose where you're starting from", startSelect);

  const simPanel = sim ? simulator() : null;

  const root = h('section', { class: 'card outdoor', 'aria-label': 'Walking directions to the building' },
    mapBox, status, notice, arrivalBox, steps,
    h('div', { class: 'btn-row' }, locateBtn, gmLink),
    startRow, simPanel);

  setStatus();

  function setExpanded(on) {
    mapBox.classList.toggle('map-expanded', on);
    document.body.classList.toggle('map-open', on);
    (on ? closeBtn : expandBtn).focus();
  }
  mapBox.addEventListener('keydown', (e) => { if (e.key === 'Escape') setExpanded(false); });

  function destLabel() { return state.dest ? state.dest.name : 'the entrance'; }

  function setStatus(summary) {
    if (summary) {
      status.textContent = '';
      status.append(h('strong', null, `${summary.minutes} min`), ` · ${formatDistance(summary.meters)} walk to ${destLabel()}`);
    } else if (state.origin) {
      const m = distanceMeters(state.origin, state.dest);
      status.textContent = `About ${walkMinutes(m * 1.3)} min to ${destLabel()} (${formatDistance(m)} in a straight line).`;
    } else {
      status.textContent = `Walking to ${destLabel()}${state.dest?.detail ? `, ${state.dest.detail}` : ''}.`;
    }
  }

  function showNotice(text) { notice.textContent = text; notice.hidden = !text; }

  // ---- map ----
  const key = mapsKey();
  if (!key) {
    mapBox.replaceWith(h('div', { class: 'map-fallback small muted' }, 'Live map not set up yet. Use Open in Google Maps for walking directions.'));
  } else {
    loadGoogleMaps(key).then(drawMap).catch(mapFailed);
    window.addEventListener('uf-maps-auth-failure', mapFailed, { once: true });
  }

  // Called on a load error and on a rejected key; the second call is a no-op.
  function mapFailed() {
    state.maps = null;
    mapBox.replaceWith(h('div', { class: 'map-fallback small muted' }, "The map couldn't load. Use Open in Google Maps instead."));
  }

  async function drawMap(gm) {
    const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([gm.importLibrary('maps'), gm.importLibrary('marker')]);
    state.maps = { gm, AdvancedMarkerElement };
    state.map = new Map(mapEl, {
      center: { lat: state.dest.lat, lng: state.dest.lng }, zoom: 17,
      mapId: 'DEMO_MAP_ID', disableDefaultUI: true, zoomControl: true, clickableIcons: false,
    });
    for (const e of entrances.filter(isValidLatLng)) {
      const pin = h('div', { class: 'map-pin', title: e.name }, e.id);
      state.pins.set(e.id, pin);
      new AdvancedMarkerElement({ map: state.map, position: { lat: e.lat, lng: e.lng }, content: pin, title: `${e.name}${e.stepFree ? ' (step-free)' : ''}` });
    }
    highlightDest();
    if (state.position) moveDot(state.position);
    if (state.origin) route();
  }

  function highlightDest() {
    for (const [id, pin] of state.pins) pin.classList.toggle('is-dest', id === state.dest?.id);
  }

  function moveDot(p) {
    if (!state.maps) return;
    const position = { lat: p.lat, lng: p.lng };
    if (!state.dot) {
      state.dot = new state.maps.AdvancedMarkerElement({ map: state.map, position, content: h('div', { class: 'map-dot' }), title: 'You are here' });
    } else state.dot.position = position;
  }

  // ---- route ----
  let routeSeq = 0;
  async function route() {
    const seq = ++routeSeq;
    const origin = { lat: state.origin.lat, lng: state.origin.lng };
    state.dest = chooseDestination(entrances, { routeEntranceId, stepFree, from: origin });
    highlightDest();
    gmLink.href = directionsUrl({ origin, destination: state.dest });
    setStatus();
    if (!state.maps) { onRoute(null); return; }
    try {
      const { Route } = await state.maps.gm.importLibrary('routes');
      const { routes } = await Route.computeRoutes({
        origin, destination: { lat: state.dest.lat, lng: state.dest.lng },
        travelMode: 'WALKING', fields: ['path', 'distanceMeters', 'durationMillis', 'legs'],
      });
      if (seq !== routeSeq) return;
      const best = routes && routes[0];
      const summary = summarizeRoute(best);
      if (!summary) throw new Error('no route');
      state.lines.forEach((l) => l.setMap(null));
      state.lines = best.createPolylines();
      state.lines.forEach((l) => l.setMap(state.map));
      const bounds = new (await state.maps.gm.importLibrary('maps')).LatLngBounds();
      bounds.extend(origin); bounds.extend({ lat: state.dest.lat, lng: state.dest.lng });
      state.map.fitBounds(bounds, 48);
      setStatus(summary);
      stepsList.replaceChildren(...summary.steps.map((t) => h('li', null, t)));
      steps.hidden = summary.steps.length === 0;
      onRoute(summary);
    } catch (err) {
      if (seq !== routeSeq) return;
      console.warn('Walking route failed', err);
      showNotice("We couldn't get walking directions here. Open in Google Maps has them.");
      onRoute(null);
    }
  }

  function setOrigin(p) {
    state.origin = { lat: p.lat, lng: p.lng };
    state.arrived = false;
    arrivalBox.hidden = true;
    route();
  }

  function setPosition(p) {
    state.position = p;
    moveDot(p);
    if (!state.arrived && hasArrived(p, state.dest)) arrive();
  }

  function arrive() {
    state.arrived = true;
    stopWatch();
    arrivalBox.replaceChildren(
      h('strong', null, `You're at ${destLabel()}.`), ' ',
      arrival ? h('a', { class: 'btn btn-primary', href: arrival.href }, arrival.label) : 'Indoor directions for this building are coming soon.');
    arrivalBox.hidden = false;
  }

  // ---- location ----
  function locate() {
    showNotice('');
    if (!('geolocation' in navigator)) { geoFailed('unsupported'); return; }
    stopWatch();
    status.textContent = 'Finding your location…';
    let first = true;
    activeWatch = navigator.geolocation.watchPosition((pos) => {
      if (!root.isConnected) { stopWatch(); return; }
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      if (first) { first = false; startSelect.value = ''; setOrigin(p); }
      setPosition(p);
    }, (err) => {
      if (!root.isConnected) { stopWatch(); return; }
      stopWatch();
      geoFailed(geoErrorState(err));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }

  function geoFailed(kind) {
    setStatus();
    showNotice(GEO_MESSAGES[kind] || GEO_MESSAGES.unavailable);
    startSelect.focus();
  }

  function pickStart(id) {
    const p = START_POINTS.find((s) => s.id === id);
    if (!p) return;
    stopWatch();
    showNotice('');
    setOrigin(p);
  }

  // ---- facilitator simulator (?sim=1) ----
  function simulator() {
    const sel = h('select', { id: 'sim-start', onchange: (e) => {
      const p = START_POINTS.find((s) => s.id === e.target.value);
      if (!p) return;
      stopWatch();
      setOrigin(p);
      setPosition(p);
    } }, h('option', { value: '' }, 'Choose…'), START_POINTS.map((p) => h('option', { value: p.id }, p.name)));
    const walk = h('button', { type: 'button', class: 'btn btn-small', onclick: () => {
      if (!state.position) return;
      setPosition(stepToward(state.position, state.dest, SIM_STEP_M));
    } }, `Walk ${SIM_STEP_M} m closer`);
    return h('fieldset', { class: 'sim small' },
      h('legend', null, 'Facilitator: simulate location'),
      h('label', { for: 'sim-start' }, "Pretend I'm at"), sel, walk);
  }

  return root;
}
