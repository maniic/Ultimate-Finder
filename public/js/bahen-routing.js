// The entrance routes already trace public corridors. Join those traces at
// shared points so indoor starts can reuse them in either direction.
const FLOOR_SCALE = 15;

// Each approach starts on a traced hall and ends at the usable lip of the
// flight. The lower and upper floor numbers can differ for the same flight.
const STAIR_FLIGHTS = [
  {
    name: 'main hall stairs',
    lower: { floor: 1, id: '1200S', approach: [[690, 659], [690, 680], [682, 680]] },
    upper: { floor: 2, id: '2290S', approach: [[586, 650], [586, 716], [601, 716]] },
  },
  {
    name: 'curved stairs',
    lower: { floor: 2, id: '2200S', approach: [[586, 716], [586, 718], [579, 718]] },
    upper: { floor: 3, id: '3200S', approach: [[450, 793], [455, 786], [466, 775], [466, 758]] },
  },
  {
    name: 'stairs by the St. George entrance',
    alternate: true,
    lower: { floor: 1, id: '1135S', approach: [[1028, 659], [1020, 659], [1020, 626], [1015, 626]] },
    upper: { floor: 2, id: '2130S', approach: [[902, 650], [941, 650], [941, 652], [950, 652]] },
  },
  {
    name: 'stairs by the St. George entrance',
    alternate: true,
    lower: { floor: 2, id: '2130S', approach: [[941, 650], [941, 634], [1040, 634], [1040, 652], [1034, 652]] },
    upper: { floor: 3, id: '3130S', approach: [[903, 650], [941, 650], [941, 652], [949, 652]] },
  },
];

export const BAHEN_STAIR_LANDINGS = STAIR_FLIGHTS.flatMap(({ lower, upper }) => [
  { id: lower.id, floor: lower.floor, to: upper.floor, at: lower.approach.at(-1) },
  { id: upper.id, floor: upper.floor, to: lower.floor, at: upper.approach.at(-1) },
]);

const LIFT_LANDINGS = { 1: [894, 520], 2: [902, 535], 3: [903, 544] };
const ENTRY = [1098, 674];
const LANDMARKS = {
  '1:1048:674': 'the inner vestibule doors',
  '1:1028:659': 'the main hall',
  '1:894:659': 'the turn into the east elevator hall',
  '1:555:659': 'the south elevator hall turnoff',
  '1:555:819': 'the corridor by the south elevators',
  '2:370:635': 'the BA 2179 doorway recess',
  '2:370:650': 'the west end of the atrium hall',
  '2:902:650': 'the turn between the atrium and east elevator halls',
  '2:586:650': 'the connector by the curved stair',
  '2:586:716': 'the turn toward the curved stairs',
  '3:903:650': 'the turn between the atrium and east elevator halls',
  '3:903:326': 'the narrow north corridor',
  '3:586:650': 'the connector by the curved stair',
};

function pixels(step) {
  const [x, y] = step.at.map((value) => Math.round(value * FLOOR_SCALE));
  // The floor-two atrium corner was traced one pixel apart in the room and
  // facility drawings. They are the same turn.
  return step.floor === 2 && x === 903 && y === 650 ? [902, 650] : [x, y];
}

function onSegment(node, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const x = node.x - a.x, y = node.y - a.y;
  const projection = x * dx + y * dy;
  return node.floor === a.floor && x * dy === y * dx &&
    projection >= 0 && projection <= dx * dx + dy * dy;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shortestPath(start, end, mode, preferMainHall) {
  const best = new Map([[start, 0]]);
  const previous = new Map();
  const pending = new Set([start]);
  while (pending.size) {
    let current;
    for (const node of pending) if (!current || best.get(node) < best.get(current)) current = node;
    pending.delete(current);
    if (current === end) {
      const path = [];
      for (let node = end; node; node = previous.get(node)) path.push(node);
      return path.reverse();
    }
    for (const { node, cost, connection, alternate } of current.edges) {
      if (connection && connection !== mode) continue;
      // Prefer the familiar main hall approach from the entrance when the
      // walking distances are close. Indoor starts use distance alone.
      const next = best.get(current) + cost + (preferMainHall && alternate ? 100 : 0);
      if (next >= (best.get(node) ?? Infinity)) continue;
      best.set(node, next);
      previous.set(node, current);
      pending.add(node);
    }
  }
  return null;
}

function removeStraightPoints(path) {
  return path.filter((node, i) => {
    const a = path[i - 1], b = path[i + 1];
    if (!a || !b || a.floor !== node.floor || node.floor !== b.floor) return true;
    return !onSegment(node, a, b);
  });
}

function routeSteps(path, startLabel, arrival, mode) {
  const compact = removeStraightPoints(path);
  return compact.map((node, i) => {
    const prev = compact[i - 1], next = compact[i + 1];
    const position = { floor: node.floor, at: [node.x / FLOOR_SCALE, node.y / FLOOR_SCALE] };
    if (!next) {
      if (!prev) return { ...position, see: arrival.see, text: 'You are already at the destination.', arrival: true };
      return { ...arrival, ...position };
    }
    if (next.floor !== node.floor) {
      return {
        ...position,
        see: mode === 'stairs' ? `Stair sign ${node.stair.id}` : 'East elevator bank',
        text: mode === 'stairs'
          ? `Take the ${node.stair.name} (${node.stair.id}) to floor ${next.floor}.`
          : `Take the east elevator to floor ${next.floor}.`,
      };
    }
    if (!prev) return { ...position, see: startLabel, text: `Start at ${startLabel}.` };
    if (prev.floor !== node.floor) {
      const exit = mode === 'stairs' ? `stairs at ${node.stair.id}` : 'east elevator';
      return { ...position, see: `Floor ${node.floor} sign`, text: `Exit the ${exit} on floor ${node.floor}.` };
    }
    const landmark = LANDMARKS[`${node.floor}:${node.x}:${node.y}`];
    return {
      ...position,
      see: landmark ? landmark.replace(/^the /, '') : 'Marked point on the floor plan',
      text: `Follow the highlighted hallway to ${landmark || 'the marked point'}.`,
    };
  });
}

export function buildBahenRouting(traces, rooms) {
  const nodes = new Map();
  const segments = [];
  const destinations = new Map();

  function node(floor, [x, y]) {
    const key = `${floor}:${x}:${y}`;
    if (!nodes.has(key)) nodes.set(key, { floor, x, y, edges: [] });
    return nodes.get(key);
  }

  function join(a, b, connection, alternate = false) {
    const cost = connection ? 150 * Math.abs(a.floor - b.floor) : distance(a, b);
    a.edges.push({ node: b, cost, connection, alternate });
    b.edges.push({ node: a, cost, connection, alternate });
  }

  for (const [id, steps] of traces) {
    const points = steps.map((step) => node(step.floor, pixels(step)));
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i];
      if (a !== b && a.floor === b.floor) segments.push([a, b]);
    }
    destinations.set(id, { node: points.at(-1), arrival: steps.at(-1) });
  }

  const entry = node(1, ENTRY);
  const lifts = new Map();
  for (const [key, location] of Object.entries(LIFT_LANDINGS)) {
    const floor = Number(key);
    const lift = node(floor, location);
    for (const other of lifts.values()) join(lift, other, 'elevator');
    lifts.set(floor, lift);
  }

  for (const { name, lower, upper, alternate } of STAIR_FLIGHTS) {
    const landings = [lower, upper].map(({ floor, id, approach }) => {
      const points = approach.map((point) => node(floor, point));
      for (let i = 1; i < points.length; i += 1) segments.push([points[i - 1], points[i]]);
      const landing = points.at(-1);
      landing.stair = { id, name };
      return landing;
    });
    join(...landings, 'stairs', alternate);
  }

  for (const [a, b] of segments) {
    const points = [...nodes.values()].filter((point) => onSegment(point, a, b))
      .sort((u, v) => distance(a, u) - distance(a, v));
    for (let i = 1; i < points.length; i += 1) join(points[i - 1], points[i]);
  }

  const roomStarts = new Map(rooms.map(({ number }) => [
    `r:${number}`, { node: destinations.get(number).node, label: `BA ${number}` },
  ]));
  const starts = new Map(roomStarts);
  for (const [floor, lift] of lifts) starts.set(`f:${floor}`, { node: lift, label: `the east elevators on floor ${floor}` });

  return function routeTo(id, variant, from) {
    const destination = destinations.get(id);
    const start = from ? starts.get(from) : { node: entry, label: 'the St. George Street entrance' };
    if (!destination || !start) return undefined;
    const mode = variant === 'stairs' ? 'stairs' : 'elevator';
    const path = shortestPath(start.node, destination.node, mode, !from);
    if (!path) return undefined;
    const stairStops = mode === 'stairs' ? path.flatMap((point, i) => {
      const prev = path[i - 1], next = path[i + 1];
      return point.stair && ((prev && prev.floor !== point.floor) || (next && next.floor !== point.floor))
        ? [point.stair.id] : [];
    }).filter((id, i, ids) => id !== ids[i - 1]) : [];
    return {
      entrance: 'M',
      startLabel: start.label,
      startFloor: start.node.floor,
      usesStairs: stairStops.length > 0,
      stairStops,
      steps: routeSteps(path, start.label, destination.arrival, mode),
    };
  };
}
