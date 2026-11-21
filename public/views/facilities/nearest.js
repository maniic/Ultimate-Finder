// "Nearest to what?" for the facilities view: where the person is starting
// from (the anchor), and walk-time estimates from there to each facility.
// No DOM here, so it's unit-tested (nearest.test.js).
//
// The anchor comes from URL params:
//   b=<building>  plus at most one of
//   r=<room>      "I'm at room 10-210"
//   e=<entrance>  "I'm at Entrance A"
//   f=<floor>     "I'm on floor 10" (taken as: by the elevators)
// With only b, it's the building's first entrance (first step-free one when
// stepfree=1). With no b, it's the first building that has facility data.
//
// Walk times are ESTIMATES on the abstract floor-plan grid (about 1 m per
// unit), walking the corridors (x + y, not a straight line). Changing floors
// goes through whichever elevator makes the trip shortest, plus a wait and
// ride time. Floors without a plan are assumed to have the elevators in the
// same place as the floors that do. Not verified on site.

import { BUILDINGS, ENTRANCES, FLOORS, ROOMS, FACILITIES, getBuilding } from '../../js/data.js'; // relative so node --test can load it too

export const WALK_M_PER_MIN = 70;
export const ELEVATOR_WAIT_MIN = 1;
export const ELEVATOR_MIN_PER_FLOOR = 0.1;

const code = (b) => String(b || '').toUpperCase();
const own = (obj, key) => !!obj && Object.hasOwn(obj, key);
const centre = (it) => [it.x + it.w / 2, it.y + it.h / 2];
const floorsOf = (b) => (own(FLOORS, b) ? FLOORS[b] : {});
const entrancesOf = (b) => (own(ENTRANCES, b) ? ENTRANCES[b] : []);
const roomsOf = (b) => (own(ROOMS, b) ? ROOMS[b] : []);

// Buildings with at least one facility, in data order.
export function facilityBuildings() {
  return [...new Set(FACILITIES.map((f) => f.building))];
}

// Elevators in a building, each once, at their position on the plan.
function elevators(b) {
  const seen = new Map();
  for (const items of Object.values(floorsOf(b))) {
    for (const it of items) if (it.kind === 'elevator' && !seen.has(it.id)) seen.set(it.id, { id: it.id, name: it.name || it.label, at: centre(it) });
  }
  return [...seen.values()];
}

// Where an entrance is drawn on the plan (any floor), if it is.
function entrancePoint(b, e) {
  for (const [floor, items] of Object.entries(floorsOf(b))) {
    const it = items.find((x) => x.kind === 'entrance' && (x.name === e.name || x.label === e.id));
    if (it) return { floor: Number(floor), at: centre(it) };
  }
  return { floor: 1, at: undefined };
}

function nearElevators(b, floor) {
  const items = own(floorsOf(b), floor) ? floorsOf(b)[floor] : [];
  const onFloor = items.find((x) => x.kind === 'elevator');
  return onFloor ? centre(onFloor) : elevators(b)[0]?.at;
}

// The anchor for these params, or { error } when a param names something we
// don't have. error: 'building' | 'room' | 'entrance' | 'floor'.
export function resolveAnchor(params = {}) {
  const b = params.b ? code(params.b) : facilityBuildings()[0];
  const building = getBuilding(b);
  if (!building) return { error: 'building', b };
  const base = { b, buildingName: building.name };

  if (params.r) {
    const room = roomsOf(b).find((x) => x.number === params.r);
    if (!room) return { ...base, error: 'room', r: params.r };
    const it = own(floorsOf(b), room.floor) ? floorsOf(b)[room.floor].find((x) => x.id === room.number) : undefined;
    return { ...base, kind: 'room', r: room.number, floor: room.floor, at: it ? centre(it) : nearElevators(b, room.floor), label: `Room ${room.number}` };
  }

  if (params.e) {
    const e = entrancesOf(b).find((x) => x.id === String(params.e).toUpperCase());
    if (!e) return { ...base, error: 'entrance', e: params.e };
    const p = entrancePoint(b, e);
    return { ...base, kind: 'entrance', e: e.id, floor: p.floor, at: p.at, label: e.name, detail: e.detail };
  }

  if (params.f !== undefined && params.f !== '') {
    const floor = Number(params.f);
    const max = building.floors || 0;
    if (!Number.isInteger(floor) || floor < 1 || (max && floor > max)) return { ...base, error: 'floor', f: params.f };
    return { ...base, kind: 'floor', f: floor, floor, at: nearElevators(b, floor), label: `Floor ${floor}, by the elevators` };
  }

  // Only a building: start from its entrance.
  const list = entrancesOf(b);
  const e = (params.stepfree === '1' && list.find((x) => x.stepFree)) || list[0];
  if (e) {
    const p = entrancePoint(b, e);
    return { ...base, kind: 'entrance', e: e.id, floor: p.floor, at: p.at, label: e.name, detail: e.detail, isDefault: true };
  }
  return { ...base, kind: 'building', floor: 1, at: undefined, label: building.name, isDefault: true };
}

// The URL params that describe an anchor (to keep it across links).
export function anchorParams(anchor) {
  if (!anchor || anchor.error === 'building') return {};
  const p = { b: anchor.b };
  if (anchor.isDefault) return p;
  if (anchor.kind === 'room') p.r = anchor.r;
  else if (anchor.kind === 'entrance') p.e = anchor.e;
  else if (anchor.kind === 'floor') p.f = String(anchor.f);
  return p;
}

const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

// Minutes from the anchor to a facility, rounded up (at least 1), or null
// when we can't tell (another building, or no position on the plan).
export function walkMinutes(anchor, facility) {
  if (!anchor || anchor.error || !facility || facility.building !== anchor.b) return null;
  if (!anchor.at || !facility.at) return null;
  let metres;
  let extra = 0;
  if (facility.floor === anchor.floor) metres = dist(anchor.at, facility.at);
  else {
    const lifts = elevators(anchor.b);
    if (!lifts.length) return null;
    metres = Math.min(...lifts.map((l) => dist(anchor.at, l.at) + dist(l.at, facility.at)));
    extra = ELEVATOR_WAIT_MIN + ELEVATOR_MIN_PER_FLOOR * Math.abs(facility.floor - anchor.floor);
  }
  return Math.max(1, Math.ceil(metres / WALK_M_PER_MIN + extra - 1e-9));
}

// Facilities of a type in the anchor's building, nearest first. Ties go to
// the working one; facilities we can't time come last.
const STATUS_ORDER = { working: 0, unknown: 1, out: 2 };
export function rankFacilities(type, anchor) {
  if (!anchor || anchor.error) return [];
  return FACILITIES
    .filter((f) => f.type === type && f.building === anchor.b)
    .map((f) => ({ ...f, walkMin: walkMinutes(anchor, f) }))
    .sort((x, y) => ((x.walkMin ?? Infinity) - (y.walkMin ?? Infinity))
      || ((STATUS_ORDER[x.status] ?? 3) - (STATUS_ORDER[y.status] ?? 3)));
}

// What the person can pick as "where I am" in a building.
export function anchorChoices(building) {
  const b = code(building);
  if (!getBuilding(b)) return { entrances: [], floors: [], rooms: [] };
  const floors = [...new Set([
    ...Object.keys(floorsOf(b)).map(Number),
    ...FACILITIES.filter((f) => f.building === b).map((f) => f.floor),
  ])].sort((x, y) => x - y);
  return {
    entrances: entrancesOf(b).map((e) => ({ e: e.id, label: e.name, detail: e.detail, stepFree: e.stepFree })),
    floors: floors.map((f) => ({ f: String(f), label: `Floor ${f}, by the elevators` })),
    rooms: [...roomsOf(b)].sort((x, y) => x.number.localeCompare(y.number)).map((r) => ({ r: r.number, label: `Room ${r.number}`, detail: `${r.type} · floor ${r.floor}` })),
  };
}

// Buildings someone can switch the anchor to: those with facility data first.
export function anchorBuildings() {
  const withData = new Set(facilityBuildings());
  return [...BUILDINGS].sort((x, y) => withData.has(y.code) - withData.has(x.code))
    .map((x) => ({ code: x.code, name: x.name, hasFacilities: withData.has(x.code) }));
}
