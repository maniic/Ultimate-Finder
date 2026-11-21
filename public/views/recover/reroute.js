// Recovery logic for "I don't know where I am": the places a lost user can
// recognise, and where they rejoin their route from there. No DOM here, so
// it's unit-tested (reroute.test.js).
//
// A "spot" is a thing on the floor plan someone can see: a room plate, an
// elevator, the lobby desk. Its key is `<floor>:<plan item id>`, because ids
// such as `elev-ab` repeat on every floor.

import { FLOORS, getRoute } from '../../js/data.js'; // relative so node --test can load it too

// What each spot looks like, for the photo card. Rooms without an entry get
// "Door plate <number>". MOCK captions, not verified on site.
const LOOKS = {
  OI: {
    '1:lobby': { see: 'Big open lobby with the front desk' },
    '1:desk': { name: 'Lobby desk', see: 'Front desk in the middle of the lobby' },
    '1:elev-ab': { see: 'Main elevator bank behind the lobby desk' },
    '1:elev-c': { see: 'Single elevator at the east end of the hall, marked C' },
    '1:stairs-w': { name: 'West stairs', see: 'Stairwell door at the west end of the hall' },
    '1:ent-a': { see: 'Glass doors and a ramp onto Bloor St W' },
    '1:ent-b': { see: 'Doors onto Bedford Rd, under the blue entrance sign' },
    '1:east-wing': { name: 'East wing', see: 'Long hallway with glass study rooms' },
    '10:elev-ab': { see: 'Blue room-number sign facing the elevators' },
    '10:elev-c': { see: 'Elevator C doors at the east end of the hall' },
    '10:stairs-w': { name: 'West stairs', see: 'Stairwell door at the west end of the hall' },
    '10:wr': { name: 'Washrooms', see: 'Washroom doors just east of the elevators' },
    '10:filler-10': { see: 'Bottle filler beside the washrooms' },
  },
};

const code = (b) => String(b || '').toUpperCase();

function toSpot(b, floor, it) {
  const key = `${floor}:${it.id}`;
  const look = (LOOKS[b] && Object.hasOwn(LOOKS[b], key)) ? LOOKS[b][key] : {};
  const isRoom = it.kind === 'room' && /^\d/.test(it.label || '');
  return {
    key, id: it.id, floor, kind: it.kind,
    name: look.name || (isRoom ? `Room ${it.label}` : it.name || it.label || it.id),
    see: look.see || (isRoom ? `Door plate ${it.label}` : it.name || it.label || it.id),
    room: isRoom ? it.label : undefined,
    at: [it.x + it.w / 2, it.y + it.h / 2],
  };
}

// Every recognisable place in a building, floor by floor.
export function spotsFor(building) {
  const b = code(building);
  const floors = Object.hasOwn(FLOORS, b) ? FLOORS[b] : {};
  return Object.keys(floors).map(Number).sort((x, y) => x - y).flatMap((floor) =>
    floors[floor].filter((it) => it.kind !== 'corridor').map((it) => toSpot(b, floor, it)));
}

export function findSpot(building, key) {
  if (typeof key !== 'string') return undefined;
  return spotsFor(building).find((s) => s.key === key);
}

// What someone types from a door plate: "10-212", "10 212", "10212".
export function findRoomSign(building, typed) {
  const want = String(typed || '').replace(/[^0-9a-z]/gi, '').toLowerCase();
  if (!want) return undefined;
  return spotsFor(building).find((s) => s.room && s.room.replace(/[^0-9a-z]/gi, '').toLowerCase() === want);
}

// Which route variant the new directions should follow. A blocked elevator,
// or a route that already avoids it, keeps avoiding it.
export function pickVariant(params) {
  if (params.why === 'blocked' || params.alt === 'blockedElevator') return 'blockedElevator';
  return params.stepfree === '1' ? 'stepfree' : 'standard';
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Where on the route (1-based step) someone at `spot` should continue.
// The steps on the spot's floor form a line; find the nearest piece of it.
// If they're before the start of that piece, continue at its start,
// otherwise at its end (the next thing ahead of them).
export function rejoin(building, roomNumber, spot, variant) {
  const route = getRoute(code(building), roomNumber, variant);
  if (!route || !spot) return undefined;
  if (spot.room && spot.room === roomNumber) return { arrived: true, variant, floor: spot.floor };

  const onFloor = route.steps.map((s, i) => ({ ...s, n: i + 1 })).filter((s) => s.floor === spot.floor);
  if (!onFloor.length) return undefined;

  let best = { d: dist(spot.at, onFloor[0].at), n: onFloor[0].n };
  for (let i = 0; i + 1 < onFloor.length; i++) {
    const a = onFloor[i].at; const b = onFloor[i + 1].at;
    const ab = [b[0] - a[0], b[1] - a[1]];
    const len2 = ab[0] ** 2 + ab[1] ** 2;
    const t = len2 ? Math.max(0, Math.min(1, ((spot.at[0] - a[0]) * ab[0] + (spot.at[1] - a[1]) * ab[1]) / len2)) : 0;
    const d = dist(spot.at, [a[0] + t * ab[0], a[1] + t * ab[1]]);
    if (d < best.d - 1e-9) best = { d, n: t > 0 ? onFloor[i + 1].n : onFloor[i].n };
  }

  // Someone already inside doesn't need "Enter at Entrance B".
  let step = best.n;
  if (step === 1 && route.entrance && spot.kind !== 'entrance') step = 2;

  const join = route.steps[step - 1];
  const path = [spot.at, ...route.steps.slice(step - 1).filter((s) => s.floor === spot.floor).map((s) => s.at)];
  // `nearby`: the next step is the destination itself. Its text ("on your
  // right") assumes the original approach, so the view guides them instead.
  return { variant, step, floor: spot.floor, toward: join.see, text: join.text, path, nearby: Boolean(join.arrival) };
}
