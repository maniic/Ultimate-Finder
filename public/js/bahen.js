import { BAHEN_FACILITY_PLANS } from './bahen-facilities.js';
import { BAHEN_STAIR_LANDINGS, buildBahenRouting } from './bahen-routing.js';

// Geometry was traced from the U of T ECE plans in the team's atlas.
// Positions below use the original 1500 × 1160 image coordinates.
const MAP_SCALE = 15;
const point = ([x, y]) => [x / MAP_SCALE, y / MAP_SCALE];

export function getBahenBackground(building, floor) {
  if (building !== 'BA' || ![1, 2, 3].includes(floor)) return undefined;
  return {
    href: `/maps/bahen/floor-${floor}.png`,
    width: 1500 / MAP_SCALE,
    height: 1160 / MAP_SCALE,
    viewBox: '16 2.8 63 71.5',
  };
}

const roomPlans = [
  { number: '1170', floor: 1, type: 'Lecture room', bounds: [581, 484, 81, 144] },
  { number: '1190', floor: 1, type: 'Lecture room', bounds: [301, 484, 84, 143] },
  { number: '2179', floor: 2, type: 'Classroom', bounds: [378, 581, 60, 56] },
  { number: '3000', floor: 3, type: 'Classroom', bounds: [914, 175, 57, 75] },
  { number: '3200', floor: 3, type: 'Room', bounds: [273, 763, 157, 90] },
];

export const BAHEN_ROOMS = roomPlans.map(({ number, floor, type }) => ({ number, floor, type }));
export const BAHEN_FACILITIES = BAHEN_FACILITY_PLANS.map(({ steps, at, mapLabel, ...details }) => ({
  ...details, building: 'BA', at: point(at), mapLabel, status: 'unknown',
}));
export const BAHEN_ENTRANCES = [
  { id: 'M', name: 'St. George Street entrance', detail: '40 St. George St', stepFree: true,
    note: 'Pilot route starts inside the east vestibule. Verify access on site.' },
];

function mapItem(id, label, kind, [x, y, w, h]) {
  return { id, label, kind, x: x / MAP_SCALE, y: y / MAP_SCALE, w: w / MAP_SCALE, h: h / MAP_SCALE };
}

const liftBounds = {
  1: [857, 479, 22, 78],
  2: [866, 501, 24, 82],
  3: [866, 501, 24, 82],
};
export const BAHEN_FLOORS = Object.fromEntries([1, 2, 3].map((floor) => {
  const rooms = roomPlans.filter((room) => room.floor === floor);
  const items = [
    ...rooms.map(({ number, bounds }) => mapItem(number, `BA${number}`, 'room', bounds)),
    mapItem('elev-east', 'East elevators', 'elevator', liftBounds[floor]),
    ...BAHEN_STAIR_LANDINGS.filter((landing) => landing.floor === floor).map(({ id, at, to }) => ({
      ...mapItem(`stairs-${id}-to-${to}`, id, 'stairs', [at[0] - 7, at[1] - 7, 14, 14]),
      name: `Stairs ${id} · ${to > floor ? 'up' : 'down'} to floor ${to}`,
      at: point(at),
    })),
    ...BAHEN_FACILITIES.filter((facility) => facility.floor === floor).map((facility) => ({
      id: facility.id, label: facility.mapLabel, name: facility.label,
      kind: facility.type === 'washroom' ? 'washroom' : 'facility',
      facility: true, at: facility.at,
      x: facility.at[0] - 1, y: facility.at[1] - 1, w: 2, h: 2,
    })),
  ];
  if (floor === 1) items.push({
    ...mapItem('ent-m', 'Entrance', 'entrance', [1071, 650, 28, 44]),
    name: BAHEN_ENTRANCES[0].name, at: point([1098, 674]),
  });
  return [floor, items];
}));

function step(floor, at, text, see, arrival = false) {
  return { floor, at: point(at), text, see, arrival };
}

const entranceSteps = [
  step(1, [1098, 674], 'Start just inside the St. George Street entrance.', 'East entrance vestibule'),
  step(1, [1048, 674], 'Walk past the inner doors into the main hall.', 'Inner doors'),
  step(1, [1028, 659], 'Head west down the main hall toward the lecture rooms.', 'Main hall'),
];

function elevatorSteps(floor, exit) {
  return [
    ...entranceSteps,
    step(1, [894, 659], 'Turn right into the east elevator hallway.', 'Elevator hallway on your right'),
    step(1, [894, 520], 'Follow the hallway to the bank of three east elevators.', 'East elevator bank'),
    step(1, [882, 520], `Take an elevator to floor ${floor}.`, 'Elevator doors'),
    step(floor, exit, `Exit the east elevators on floor ${floor}.`, `Floor ${floor} sign at the elevators`),
  ];
}

const routes = {
  '1170': [
    ...entranceSteps,
    step(1, [657, 659], 'Continue down the main hall to the first BA1170 doorway.', 'Door at the east end of BA1170'),
    step(1, [657, 637], 'Turn right to the door marked BA1170.', 'BA1170 room sign', true),
  ],
  '1190': [
    ...entranceSteps,
    step(1, [366, 659], 'Continue along the main hall, past BA1170 and BA1180.', 'BA1190 near the west end of the hall'),
    step(1, [366, 636], 'Turn right to the door marked BA1190.', 'BA1190 room sign', true),
  ],
  '2179': [
    ...elevatorSteps(2, [902, 535]),
    step(2, [902, 650], 'Turn right out of the elevators and continue to the main hall.', 'Hall overlooking the atrium'),
    step(2, [370, 650], 'Turn right into the hall. Keep the atrium railing on your left.', 'Recessed doorway near the west end'),
    step(2, [370, 635], 'Turn right into the doorway recess.', 'BA2179 doorway recess'),
    step(2, [375, 635], 'Stop at the door marked BA2179.', 'BA2179 room sign', true),
  ],
  '3000': [
    ...elevatorSteps(3, [903, 544]),
    step(3, [903, 455], 'Turn left out of the elevators and pass the first stairwell.', 'Stairwell off the elevator hall'),
    step(3, [903, 326], 'Continue north to the narrower corridor.', 'Narrow north corridor'),
    step(3, [900, 275], 'Follow the corridor toward the next stairwell.', 'North corridor'),
    step(3, [901, 164], 'Look for BA3000 on the right beside the stairwell.', 'BA3000 doorway'),
    step(3, [911, 164], 'Stop at the door marked BA3000.', 'BA3000 room sign', true),
  ],
  '3200': [
    ...elevatorSteps(3, [903, 544]),
    step(3, [903, 650], 'Turn right out of the elevators and continue to the atrium hall.', 'Hall overlooking the atrium'),
    step(3, [586, 650], 'Turn right and follow the hall to the connector beside the curved stair.', 'Connector beside the curved stair'),
    step(3, [586, 748], 'Cross the connector.', 'Connector on the east side of the stair enclosure'),
    step(3, [592, 804], 'Follow the corridor around the south side of the enclosure.', 'South side of the curved stair'),
    step(3, [455, 804], 'Continue to the double doors for BA3200.', 'Double doors at BA3200'),
    step(3, [450, 793], 'Move toward the middle of the double doors.', 'BA3200 doorway'),
    step(3, [438, 793], 'Stop at the door marked BA3200.', 'BA3200 room sign', true),
  ],
};

const elevatorExits = { 2: [902, 535], 3: [903, 544] };
const facilityRoutes = BAHEN_FACILITY_PLANS.filter((facility) => facility.steps).map(({ id, floor, steps }) => [
  id, [
    ...(floor === 1 ? entranceSteps : elevatorSteps(floor, elevatorExits[floor])),
    ...steps.map(([at, text, landmark], index) => step(floor, at, text, landmark, index === steps.length - 1)),
  ],
]);

const traces = [...Object.entries(routes), ...facilityRoutes];

export const BAHEN_ROUTES = Object.fromEntries(traces.map(([number, steps]) => {
  const route = { entrance: 'M', steps };
  return [`BA:${number}`, { standard: route, stepfree: route }];
}));

export const getBahenRoute = buildBahenRouting(traces, BAHEN_ROOMS);
