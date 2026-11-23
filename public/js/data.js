import { BAHEN_ENTRANCES, BAHEN_FACILITIES, BAHEN_FLOORS, BAHEN_ROOMS, BAHEN_ROUTES } from './bahen.js';

// Shared reference data. The mock OISE data is based on the paper-prototype scenario
// (OISE room 10-210, Entrances A/B, Elevator C) in submitted_docs/. Layouts,
// times and statuses are illustrative and NOT verified on site.
//
// Shared-file etiquette: ADD fields/entries freely, but don't rename or
// restructure existing ones in a feature branch. Other views depend on them.
// Propose a reshape in its own small PR.
//
// Floor-plan coordinates are an abstract 100 x 60 grid (x: west→east,
// y: north→south), not real measurements.

export const BUILDINGS = [
  { code: 'OI', name: 'OISE · Ontario Institute for Studies in Education', floors: 12, hasPlans: true,
    numberingNote: 'OISE has 12 floors. Room 10-210 is on floor 10, the tenth storey.' },
  { code: 'BA', name: 'Bahen Centre for Information Technology', floors: 8, hasPlans: true },
  { code: 'SS', name: 'Sidney Smith Hall', floors: 6, hasPlans: false },
  { code: 'MP', name: 'McLennan Physical Laboratories', floors: 16, hasPlans: false },
];

export const ENTRANCES = {
  BA: BAHEN_ENTRANCES,
  OI: [
    { id: 'A', name: 'Entrance A', detail: 'Bloor St W, by the bike racks', stepFree: true, note: 'Ramp, automatic door' },
    { id: 'B', name: 'Entrance B', detail: 'Bedford Rd side', stepFree: false, note: 'Stairs (6 steps)' },
  ],
};

// Floor plans: rooms + landmarks per building/floor.
// kind: room | elevator | stairs | washroom | facility | entrance | corridor
// label = text drawn on the plan; name (optional) = longer accessible name;
// labelY (optional) = where to draw the label instead of the box centre.
export const FLOORS = {
  BA: BAHEN_FLOORS,
  OI: {
    1: [
      { id: 'corridor', kind: 'corridor', x: 5, y: 26, w: 90, h: 8 },
      { id: 'lobby', label: 'Main lobby', kind: 'room', x: 35, y: 36, w: 30, h: 18, labelY: 40 },
      { id: 'desk', label: 'Lobby desk', kind: 'facility', x: 43, y: 47, w: 14, h: 5 },
      { id: 'elev-ab', label: 'Elevators A/B', kind: 'elevator', x: 44, y: 10, w: 12, h: 14 },
      { id: 'elev-c', label: 'Elevator C', kind: 'elevator', x: 84, y: 10, w: 9, h: 14 },
      { id: 'stairs-w', label: 'Stairs', kind: 'stairs', x: 6, y: 10, w: 9, h: 14 },
      { id: 'ent-a', label: 'A', name: 'Entrance A', kind: 'entrance', x: 40, y: 55, w: 12, h: 5 },
      { id: 'ent-b', label: 'B', name: 'Entrance B', kind: 'entrance', x: 0, y: 27, w: 5, h: 6 },
      { id: 'east-wing', label: 'East wing', kind: 'room', x: 70, y: 36, w: 25, h: 18 },
    ],
    10: [
      { id: 'corridor', kind: 'corridor', x: 5, y: 26, w: 90, h: 8 },
      { id: '10-200', label: '10-200', kind: 'room', x: 18, y: 36, w: 14, h: 16 },
      { id: '10-204', label: '10-204', kind: 'room', x: 33, y: 36, w: 14, h: 16 },
      { id: '10-210', label: '10-210', kind: 'room', x: 62, y: 36, w: 16, h: 16 },
      { id: '10-212', label: '10-212', kind: 'room', x: 79, y: 36, w: 14, h: 16 },
      { id: '10-101', label: '10-101', kind: 'room', x: 18, y: 8, w: 22, h: 16 },
      { id: 'elev-ab', label: 'Elevators A/B', kind: 'elevator', x: 44, y: 10, w: 12, h: 14 },
      { id: 'elev-c', label: 'Elevator C', kind: 'elevator', x: 84, y: 10, w: 9, h: 14 },
      { id: 'stairs-w', label: 'Stairs', kind: 'stairs', x: 6, y: 10, w: 9, h: 14 },
      { id: 'wr', label: 'WR', kind: 'washroom', x: 60, y: 10, w: 10, h: 14 },
      { id: 'filler-10', label: 'Bottle filler', kind: 'facility', x: 72, y: 18, w: 6, h: 6 },
    ],
  },
};

// Rooms people can search for. `floor` must exist in FLOORS for the plan view.
export const ROOMS = {
  BA: BAHEN_ROOMS,
  OI: [
    { number: '10-210', floor: 10, side: 'right', type: 'Classroom' },
    { number: '10-200', floor: 10, side: 'right', type: 'Classroom' },
    { number: '10-204', floor: 10, side: 'right', type: 'Seminar room' },
    { number: '10-101', floor: 10, side: 'left', type: 'Office' },
  ],
};

// Routes: building:room -> variants. Each step has a mini-map position
// (`floor`, `at: [x, y]`) and a caption for the photo we'd show.
export const ROUTES = {
  ...BAHEN_ROUTES,
  'OI:10-210': {
    standard: {
      entrance: 'B', walkMin: 9,
      steps: [
        { text: 'Enter at Entrance B on Bedford Rd, under the blue entrance sign.', see: 'Blue entrance sign above the doors', floor: 1, at: [3, 30] },
        { text: 'Walk straight past the lobby desk to Elevators A/B.', see: 'Lobby desk with the elevators behind it', floor: 1, at: [50, 30] },
        { text: 'Take the elevator to floor 10.', see: 'Elevator bank, floor buttons up to 12', floor: 1, at: [50, 18] },
        { text: 'Exit the elevator and turn right at the blue sign.', see: 'Blue room-number sign: 10-200 to 10-212 →', floor: 10, at: [56, 30] },
        { text: "You've arrived: 10-210 is on your right. Check the room plate.", see: 'Door with room plate 10-210', floor: 10, at: [70, 34], arrival: true },
      ],
    },
    stepfree: {
      entrance: 'A', walkMin: 11,
      steps: [
        { text: 'Enter at Entrance A on Bloor St W, using the ramp by the bike racks.', see: 'Ramp and bike racks at Entrance A', floor: 1, at: [46, 56] },
        { text: 'Go through the main lobby to Elevators A/B.', see: 'Main lobby, elevators straight ahead', floor: 1, at: [50, 30] },
        { text: 'Take the elevator to floor 10.', see: 'Elevator bank, floor buttons up to 12', floor: 1, at: [50, 18] },
        { text: 'Exit the elevator and turn right at the blue sign.', see: 'Blue room-number sign: 10-200 to 10-212 →', floor: 10, at: [56, 30] },
        { text: "You've arrived: 10-210 is on your right. Check the room plate.", see: 'Door with room plate 10-210', floor: 10, at: [70, 34], arrival: true },
      ],
    },
    // Used by the recovery flow when the main elevators are blocked.
    blockedElevator: {
      steps: [
        { text: 'Walk east along the corridor to Elevator C (past the east wing).', see: 'Elevator C sign at the east end of the hall', floor: 1, at: [88, 30] },
        { text: 'Take Elevator C to floor 10.', see: 'Elevator C doors', floor: 1, at: [88, 18] },
        { text: 'Exit and walk west. 10-210 is on your left after 10-212.', see: 'Room plates 10-212, then 10-210', floor: 10, at: [80, 30] },
        { text: "You've arrived: 10-210. Check the room plate.", see: 'Door with room plate 10-210', floor: 10, at: [70, 34], arrival: true },
      ],
    },
  },
};

// Places a lost user can pick from in the recovery flow. A photo helps them
// recognise it (heuristic-evaluation finding 1).
export const LOCATION_CHOICES = {
  OI: [
    { id: 'lobby', name: 'Main lobby', see: 'Big open lobby with the front desk', floor: 1 },
    { id: 'east-wing', name: 'Floor 1, east wing', see: 'Long hallway with glass study rooms', floor: 1 },
    { id: 'floor10-elev', name: 'Floor 10, by the elevators', see: 'Blue room-number sign facing the elevators', floor: 10 },
  ],
};

export const FACILITY_TYPES = [
  { id: 'bottle-filler', name: 'Bottle filler' },
  { id: 'water-fountain', name: 'Water fountain' },
  { id: 'microwave', name: 'Microwave' },
  { id: 'charging', name: 'Charging spot' },
  { id: 'washroom', name: 'Washroom' },
  { id: 'prayer', name: 'Prayer room' },
];

// status: working | out | unknown. lastConfirmed: ISO date.
export const FACILITIES = [
  { id: 'f1', type: 'bottle-filler', building: 'OI', floor: 10, near: 'Beside the washrooms, east of Elevators A/B', walkMin: 1, status: 'working', lastConfirmed: '2026-11-10', at: [75, 21] },
  { id: 'f2', type: 'bottle-filler', building: 'OI', floor: 1, near: 'Main lobby, next to the lobby desk', walkMin: 3, status: 'out', lastConfirmed: '2026-11-12', at: [58, 42] },
  { id: 'f3', type: 'bottle-filler', building: 'OI', floor: 5, near: 'North corridor by the stairs', walkMin: 4, status: 'unknown', lastConfirmed: '2026-09-30', at: [12, 30] },
  { id: 'f4', type: 'microwave', building: 'OI', floor: 1, near: 'Student lounge, east wing', walkMin: 4, status: 'working', lastConfirmed: '2026-11-08', at: [80, 44] },
  { id: 'f5', type: 'charging', building: 'OI', floor: 1, near: 'Lobby benches along the south windows', walkMin: 3, status: 'working', lastConfirmed: '2026-11-01', at: [40, 50] },
  { id: 'f6', type: 'washroom', building: 'OI', floor: 10, near: 'East of Elevators A/B', walkMin: 1, status: 'working', lastConfirmed: '2026-11-14', at: [65, 17] },
  { id: 'f7', type: 'prayer', building: 'OI', floor: 7, near: 'Room 7-162 (multi-faith space)', walkMin: 5, status: 'unknown', lastConfirmed: '2026-08-20', at: [30, 40] },
  ...BAHEN_FACILITIES,
];

// ---- lookups --------------------------------------------------------------

// Accepts a code ("oi", "OI") or part of a name ("oise", "bahen").
export function searchBuildings(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return BUILDINGS.filter((b) => b.code.toLowerCase().startsWith(q) || b.name.toLowerCase().includes(q));
}

export function getBuilding(code) {
  return BUILDINGS.find((b) => b.code === String(code || '').toUpperCase());
}

export function getRoom(code, number) {
  return (ROOMS[String(code || '').toUpperCase()] || []).find((r) => r.number === number);
}

export function getRoute(code, number, variant = 'standard') {
  const r = ROUTES[`${String(code || '').toUpperCase()}:${number}`];
  // Own-property check: `variant` can come from the URL (?alt=constructor).
  return r && Object.hasOwn(r, variant) && r[variant]?.steps ? r[variant] : undefined;
}

export function getEntrance(code, id) {
  return (ENTRANCES[code] || []).find((e) => e.id === id);
}

export function getFacility(building, id) {
  return id ? FACILITIES.find((facility) => facility.building === building && facility.id === id) : undefined;
}

export function facilityTypeName(id) {
  return FACILITY_TYPES.find((t) => t.id === id)?.name || id;
}
