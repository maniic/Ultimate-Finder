// Pure helpers for the outdoor map on Route preview: distance, entrance
// choice, geolocation error states, Google Maps links and arrival checks.
// No DOM and no browser globals, so `node --test` can run outdoor.test.js.

const EARTH_RADIUS_M = 6371000;
const WALK_M_PER_MIN = 80; // ~1.33 m/s, a typical walking pace
export const ARRIVAL_RADIUS_M = 30;
const MAX_FIX_ACCURACY_M = 100; // ignore fixes vaguer than this for arrival

export function isValidLatLng(p) {
  return !!p
    && typeof p.lat === 'number' && typeof p.lng === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

export function distanceMeters(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function walkMinutes(meters) {
  return Math.max(1, Math.ceil(meters / WALK_M_PER_MIN));
}

export function formatDistance(meters) {
  if (meters < 999) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Choose the entrance to route to. Step-free on → only step-free entrances,
// unless the building has none (then all, flagged stepFreeUnavailable).
// With a start point → the nearest one; otherwise the first listed.
export function pickEntrance(entrances, { stepFree = false, from = null } = {}) {
  const usable = (entrances || []).filter(isValidLatLng);
  if (!usable.length) return null;
  let pool = usable;
  let stepFreeUnavailable = false;
  if (stepFree) {
    const sf = usable.filter((e) => e.stepFree);
    if (sf.length) pool = sf;
    else stepFreeUnavailable = true;
  }
  let best = pool[0];
  if (isValidLatLng(from)) {
    for (const e of pool) {
      if (distanceMeters(from, e) < distanceMeters(from, best)) best = e;
    }
  }
  return stepFreeUnavailable ? { ...best, stepFreeUnavailable } : best;
}

// GeolocationPositionError codes: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
export function geoErrorState(err) {
  if (err?.code === 1) return 'denied';
  if (err?.code === 3) return 'timeout';
  return 'unavailable';
}

const fmt = (p) => `${p.lat},${p.lng}`;

// Google Maps "Maps URLs" walking directions. Opens the app on phones.
export function directionsUrl({ origin, destination } = {}) {
  if (!isValidLatLng(destination)) return null;
  const params = new URLSearchParams({ api: '1' });
  if (isValidLatLng(origin)) params.set('origin', fmt(origin));
  params.set('destination', fmt(destination));
  params.set('travelmode', 'walking');
  return `https://www.google.com/maps/dir/?${params}`;
}

export function hasArrived(position, target, radius = ARRIVAL_RADIUS_M) {
  if (!isValidLatLng(position) || !isValidLatLng(target)) return false;
  if (typeof position.accuracy === 'number' && position.accuracy > MAX_FIX_ACCURACY_M) return false;
  return distanceMeters(position, target) <= radius;
}

// Entrances for a building: the shared ENTRANCES data (names, step-free),
// plus coordinates and map-only entrances from this view's places.js,
// matched by id. Works for any building code; nothing is per-building here.
export function entrancesFor(code, shared, places) {
  if (!code) return [];
  const base = (shared && shared[code]) || [];
  const extra = (places && places[code] && places[code].entrances) || [];
  const byId = new Map(base.map((e) => [e.id, { ...e }]));
  for (const p of extra) byId.set(p.id, { ...p, ...(byId.get(p.id) || {}), lat: p.lat, lng: p.lng });
  return [...byId.values()];
}

// For a building we have no coordinates for: let Google find it by name.
export function searchUrl(name) {
  if (!name) return null;
  const params = new URLSearchParams({ api: '1', query: `${name}, University of Toronto` });
  return `https://www.google.com/maps/search/?${params}`;
}

// A google.maps.routes.Route (or a plain object shaped like one) →
// { meters, minutes, steps: [text] }. Null if there's no distance.
export function summarizeRoute(route) {
  if (!route || typeof route.distanceMeters !== 'number') return null;
  const meters = route.distanceMeters;
  const minutes = typeof route.durationMillis === 'number'
    ? Math.max(1, Math.ceil(route.durationMillis / 60000))
    : walkMinutes(meters);
  const steps = (route.legs || [])
    .flatMap((leg) => leg.steps || [])
    .map((s) => (s.instructions || '').trim())
    .filter(Boolean);
  return { meters, minutes, steps };
}

// Location simulator: move `meters` along the straight line toward target.
export function stepToward(from, to, meters) {
  const total = distanceMeters(from, to);
  if (total <= meters) return { lat: to.lat, lng: to.lng };
  const t = meters / total;
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}

// Where the outdoor route ends. If there's an indoor route, it starts at a
// specific entrance, so go there (the inside steps then match). Otherwise
// the nearest suitable entrance.
export function chooseDestination(entrances, { routeEntranceId, stepFree = false, from = null } = {}) {
  const fixed = routeEntranceId && (entrances || []).find((e) => e.id === routeEntranceId && isValidLatLng(e));
  return fixed || pickEntrance(entrances, { stepFree, from });
}

// What the step-free choice means at this building: the entrance used, the
// stair entrances it avoids, and whether no step-free entrance is on record.
export function stepFreeInfo(entrances, chosen) {
  const avoids = (entrances || []).filter((e) => !e.stepFree && e.id !== chosen?.id);
  return { uses: chosen || null, avoids, unavailable: !chosen?.stepFree };
}
