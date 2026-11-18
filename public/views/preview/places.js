// Outdoor map data for Route preview: where each building's entrances are,
// and the start points offered when location is off.
//
// Keyed by building code, so the map works for whichever building and room
// (or facility) the person picked. Entrance names, notes and step-free come
// from ENTRANCES in /js/data.js when the building is there; an entry here
// only adds coordinates. Buildings missing from data.js can list full
// entrances here. A building with no entry falls back to a Google Maps
// search by name.
//
// VERIFY ON SITE: every coordinate below is an estimate from the campus map,
// not a GPS reading at the door. Stand at each entrance and fix them.

export const PLACES = {
  OI: {
    entrances: [
      { id: 'A', lat: 43.66846, lng: -79.39848 }, // Bloor St W, by the bike racks
      { id: 'B', lat: 43.66823, lng: -79.39905 }, // Bedford Rd side
    ],
  },
  BA: {
    entrances: [
      { id: 'M', name: 'Main entrance', detail: '40 St. George St', stepFree: true,
        note: 'Level entry, automatic doors', lat: 43.65957, lng: -79.39744 },
    ],
  },
};

// Offered when location is denied or unavailable, and in the facilitator
// simulator. Approximate too.
export const START_POINTS = [
  { id: 'stgeorge', name: 'St. George subway station', lat: 43.66826, lng: -79.39968 },
  { id: 'robarts', name: 'Robarts Library', lat: 43.66443, lng: -79.39915 },
  { id: 'sidsmith', name: 'Sidney Smith Hall', lat: 43.66240, lng: -79.39820 },
  { id: 'kcc', name: "King's College Circle", lat: 43.66105, lng: -79.39535 },
  { id: 'queenspark', name: "Queen's Park subway station", lat: 43.65999, lng: -79.39042 },
];
