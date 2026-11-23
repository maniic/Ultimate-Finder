// Coordinates are pixels in the original ECE drawings. Area pins stay in the
// public corridor when the current door sign or fixture wall is uncertain.
// Facility details were cross-checked with the SONAD event map, Student Life,
// the Engineering washroom guide, the EHS fixture list, and the CSSU.
const firstSouth = [
  [[555, 659], 'Continue west to the hallway toward the College Street side.', 'Turnoff beside the lecture rooms'],
  [[555, 819], 'Turn left and follow the hallway toward the south elevators.', 'Hallway by the south elevator bank'],
];

const upperSouth = [
  [[903, 650], 'Turn right out of the east elevators and walk to the atrium hall.', 'Hallway overlooking the atrium'],
  [[586, 650], 'Turn right and follow the atrium hall to the connector beside the curved stairs.', 'Connector beside the curved stairs'],
  [[586, 744], 'Follow the narrow corridor beside the stairs.', 'South end of the connector'],
  [[590, 774], 'Continue into the hallway toward the south elevators.', 'South elevator hallway'],
];

export const BAHEN_FACILITY_PLANS = [
  {
    id: 'ba-prayer-1255', type: 'prayer', floor: 1, roomNumber: '1255', at: [602, 958], mapLabel: 'Prayer',
    label: 'Muslim Prayer Space · BA1255',
    near: 'Drop-in prayer space by the first-floor café, near the College Street entrance.',
    aliases: ['prayer room', 'musalla', 'prayer space', 'worship'],
    steps: [
      ...firstSouth,
      [[555, 924], 'Continue toward the College Street doors.', 'Hallway to the College Street entrance'],
      [[605, 924], 'Head into the lobby beside the café.', 'Lobby facing the curved room'],
      [[605, 953], 'Follow the lobby to the double doors for BA1255.', 'Double doors of the prayer space'],
      [[602, 958], 'You’ve reached the Muslim Prayer Space.', 'BA1255 prayer space'],
    ],
  },
  {
    id: 'ba-washroom-1108', type: 'washroom', floor: 1, roomNumber: '1108', at: [882, 417], mapLabel: 'WC',
    label: 'Accessible all-gender washroom · BA1108',
    near: 'Single-user washroom in the hall just north of the east elevators.',
    aliases: ['accessible bathroom', 'all gender bathroom', 'universal washroom', 'single user'],
    steps: [
      [[894, 659], 'Turn right from the main hall into the east elevator hallway.', 'Hallway beside the east elevators'],
      [[894, 417], 'Continue past the elevators. Look for BA1108 on your left.', 'Single-user washroom doors'],
      [[882, 417], 'Stop at the door marked BA1108.', 'Accessible all-gender washroom'],
    ],
  },
  {
    id: 'ba-washroom-1110', type: 'washroom', floor: 1, roomNumber: '1110', at: [882, 389], mapLabel: 'WC',
    label: 'Accessible single-user washroom · BA1110',
    near: 'Just past BA1108 in the hall north of the east elevators.',
    aliases: ['accessible bathroom', 'single user'],
    steps: [
      [[894, 659], 'Turn right from the main hall into the east elevator hallway.', 'Hallway beside the east elevators'],
      [[894, 389], 'Pass the elevators and BA1108. Look for BA1110 on your left.', 'Single-user washroom doors'],
      [[882, 389], 'Stop at the door marked BA1110.', 'Accessible single-user washroom'],
    ],
  },
  {
    id: 'ba-washroom-1284', type: 'washroom', floor: 1, roomNumber: '1284', at: [620, 811], mapLabel: 'WC',
    label: 'Women’s washroom · BA1284',
    near: 'By the south elevators, with a baby change table.',
    aliases: ['women bathroom', 'women restroom', 'change table', 'baby changing'],
    steps: [
      ...firstSouth,
      [[620, 819], 'Turn left into the hall by the south elevators and look for BA1284.', 'Door on the north side of the corridor'],
      [[620, 811], 'Stop at the women’s washroom marked BA1284.', 'BA1284 washroom sign'],
    ],
  },
  {
    id: 'ba-washroom-1286', type: 'washroom', floor: 1, roomNumber: '1286', at: [678, 827], mapLabel: 'WC',
    label: 'Men’s washroom · BA1286',
    near: 'By the south elevators, with a baby change table.',
    aliases: ['men bathroom', 'men restroom', 'change table', 'baby changing'],
    steps: [
      ...firstSouth,
      [[678, 819], 'Turn left into the hall by the south elevators and look for BA1286.', 'Door on the south side of the corridor'],
      [[678, 827], 'Stop at the men’s washroom marked BA1286.', 'BA1286 washroom sign'],
    ],
  },
  {
    id: 'ba-water-1', type: 'water-fountain', floor: 1, at: [550, 559], mapLabel: 'Water', approximate: true,
    label: 'Water fountain by BA1170',
    near: 'In the stair bay between BA1170 and BA1180, beside stair BA1171S.',
    aliases: ['drinking water', 'BA1171S'],
    steps: [
      [[550, 659], 'Follow the main hall toward the gap between BA1170 and BA1180.', 'Opening near stair BA1171S'],
      [[550, 559], 'Turn right into the bay and look for the fountain beside the stairs.', 'Fountain area by BA1171S'],
    ],
  },
  {
    id: 'ba-washrooms-east-2', type: 'washroom', floor: 2, at: [918, 544], mapLabel: 'WC', approximate: true,
    label: 'Washrooms by the east elevators · Floor 2',
    near: 'Men’s and women’s washrooms are signed near the east elevators.',
    steps: [
      [[902, 544], 'With the east elevator doors behind you, look across the hall for washroom signs.', 'Washroom signs across from the east elevators'],
      [[918, 544], 'Follow the signs at the washroom entrance.', 'East elevator washroom area'],
    ],
  },
  {
    id: 'ba-washrooms-south-2', type: 'washroom', floor: 2, at: [596, 796], mapLabel: 'WC', approximate: true,
    label: 'Washrooms by the south elevators · Floor 2',
    near: 'Men’s and women’s washrooms are signed near the south elevators.',
    steps: [
      ...upperSouth,
      [[590, 796], 'Look for the washroom signs on the elevator side of the hallway.', 'Washrooms near the south elevators'],
      [[596, 796], 'Follow the signs to the washroom you need.', 'South elevator washroom area'],
    ],
  },
  {
    id: 'ba-microwave-2285', type: 'microwave', floor: 2, roomNumber: '2285', at: [572, 802], mapLabel: 'Microwave',
    label: 'Microwave · CSSU lounge BA2285',
    near: 'Inside the CSSU lounge by the south elevators, available during lounge hours.',
    aliases: ['cssu', 'student lounge', 'heat food', 'kettle'],
    steps: [
      ...upperSouth,
      [[590, 802], 'Look for the CSSU lounge door on the right side of the hallway.', 'BA2285 room sign'],
      [[572, 802], 'The microwave is inside BA2285 when the lounge is open.', 'CSSU lounge entrance'],
    ],
  },
  {
    id: 'ba-water-2', type: 'water-fountain', floor: 2, at: [589, 867], mapLabel: 'Water', approximate: true,
    label: 'Water fountain near BA2283',
    near: 'In the south elevator hallway by BA2283. Exact fixture position is unconfirmed.',
    aliases: ['drinking water', 'BA2283'],
  },
  {
    id: 'ba-washrooms-east-3', type: 'washroom', floor: 3, roomNumber: '3120', at: [919, 548], mapLabel: 'WC', approximate: true,
    label: 'Washrooms by the east elevators · BA3120',
    near: 'This washroom area includes the men’s washroom BA3120. Check the door signs at the vestibule.',
    aliases: ['men bathroom', 'men restroom'],
    steps: [
      [[903, 548], 'With the east elevator doors behind you, look across the hall for washroom signs.', 'Washroom signs across from the east elevators'],
      [[919, 548], 'Follow the sign for BA3120 or the washroom you need.', 'East elevator washroom area'],
    ],
  },
  {
    id: 'ba-washrooms-south-3', type: 'washroom', floor: 3, at: [596, 796], mapLabel: 'WC', approximate: true,
    label: 'Washrooms by the south elevators · Floor 3',
    near: 'Men’s and women’s washrooms are signed near the south elevators.',
    steps: [
      ...upperSouth,
      [[590, 796], 'Look for the washroom signs on the elevator side of the hallway.', 'Washrooms near the south elevators'],
      [[596, 796], 'Follow the signs to the washroom you need.', 'South elevator washroom area'],
    ],
  },
  {
    id: 'ba-water-3', type: 'water-fountain', floor: 3, at: [589, 867], mapLabel: 'Water', approximate: true,
    label: 'Water fountain near BA3285',
    near: 'In the south elevator hallway by BA3285. Exact fixture position is unconfirmed.',
    aliases: ['drinking water', 'BA3285'],
  },
];
