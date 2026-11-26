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
  ...[
    // Rooms added from the floor plans. Each door is where the plan shows a
    // door swing, so check them on site like the rest of the pilot data.
    ['1160', 1, 'Lecture hall', [690, 470, 160, 165]],
    ['1180', 1, 'Lecture room', [391, 484, 84, 143]],
    ['1200', 1, 'Lecture room', [457, 722, 78, 128]],
    ['1210', 1, 'Lecture room', [377, 722, 80, 128]],
    ['1220', 1, 'Lecture room', [297, 722, 80, 128]],
    ['1230', 1, 'Lecture room', [297, 866, 78, 94]],
    ['1240', 1, 'Lecture room', [377, 866, 76, 94]],
    ['2139', 2, 'Room', [715, 585, 127, 50]],
    ['2145', 2, 'Room', [692, 462, 85, 123]],
    ['2159', 2, 'Room', [547, 585, 125, 50]],
    ['2165', 2, 'Room', [522, 462, 85, 123]],
    ['2175', 2, 'Room', [437, 462, 85, 120]],
    ['2185', 2, 'Room', [352, 462, 85, 120]],
    ['2195', 2, 'Room', [270, 462, 82, 115]],
    ['3135', 3, 'Room', [777, 462, 85, 165]],
    ['3145', 3, 'Room', [692, 462, 85, 165]],
    ['3155', 3, 'Room', [607, 462, 85, 165]],
    ['3165', 3, 'Room', [522, 462, 85, 165]],
    ['3175', 3, 'Room', [437, 462, 85, 165]],
    ['3177', 3, 'Room', [375, 587, 62, 40]],
    ['3185', 3, 'Room', [352, 462, 85, 125]],
    ['3195', 3, 'Room', [270, 462, 82, 120]],
  ].map(([number, floor, type, bounds]) => ({ number, floor, type, bounds })),
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

// Rooms whose door opens off a main hall: walk the hall, then turn to the door.
function hallRoute(number, floor, x, doorY, finalText) {
  const sign = `BA${number} room sign`;
  const arrive = step(floor, [x, doorY], finalText || `Turn right to the door marked BA${number}.`, sign, true);
  if (floor === 1) {
    return [...entranceSteps,
      step(1, [x, 659], `Continue along the main hall to BA${number} on your right.`, `BA${number} doorway`), arrive];
  }
  return [...elevatorSteps(floor, elevatorExits[floor]),
    step(floor, [elevatorExits[floor][0], 650], 'Turn right out of the elevators and continue to the atrium hall.', 'Hall overlooking the atrium'),
    step(floor, [x, 650], `Turn right and follow the hall to BA${number} on your right.`, `BA${number} doorway`), arrive];
}

// The lecture rooms south of the main hall, off corridors 1210V and 1220K.
function southRoute(number, corridorY, x) {
  const corridor = corridorY === 712 ? 'first corridor' : 'lower corridor';
  return [...entranceSteps,
    step(1, [555, 659], 'Continue down the main hall and turn left toward the south elevators.', 'South elevator hall turnoff'),
    step(1, [555, corridorY], `Turn right into the ${corridor} past the stairs.`, `Corridor ${corridorY === 712 ? '1210V' : '1220K'}`),
    step(1, [x, corridorY], `Follow the corridor to BA${number} on your left.`, `BA${number} doorway`),
    step(1, [x, corridorY + 10], `Turn left to the door marked BA${number}.`, `BA${number} room sign`, true),
  ];
}

Object.assign(routes, {
  '1160': hallRoute('1160', 1, 822, 634, 'Turn right to the door marked BA1160 at the back of the hall.'),
  '1180': hallRoute('1180', 1, 460, 636),
  '1200': southRoute('1200', 712, 528),
  '1210': southRoute('1210', 712, 445),
  '1220': southRoute('1220', 712, 365),
  '1230': southRoute('1230', 858, 368),
  '1240': southRoute('1240', 858, 440),
  '2139': hallRoute('2139', 2, 838, 632),
  '2145': hallRoute('2145', 2, 693, 592, 'Turn right into the short passage. BA2145 is the door at its end.'),
  '2159': hallRoute('2159', 2, 665, 632),
  '2165': hallRoute('2165', 2, 535, 592, 'Turn right into the short passage. BA2165 is the door at its end.'),
  '2175': hallRoute('2175', 2, 505, 627),
  '2185': hallRoute('2185', 2, 368, 627),
  '2195': hallRoute('2195', 2, 335, 627, 'Turn right through BA2197 to the door marked BA2195.'),
  '3135': hallRoute('3135', 3, 840, 632),
  '3145': hallRoute('3145', 3, 711, 632),
  '3155': hallRoute('3155', 3, 617, 632),
  '3165': hallRoute('3165', 3, 538, 632),
  '3175': hallRoute('3175', 3, 512, 632),
  '3177': hallRoute('3177', 3, 405, 632),
  '3185': hallRoute('3185', 3, 370, 632),
  '3195': hallRoute('3195', 3, 335, 632, 'Turn right through BA3197 to the door marked BA3195.'),
});
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
