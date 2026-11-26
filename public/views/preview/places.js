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
// Entrance coordinates come from OpenStreetMap entrance nodes on each
// building's outline (looked up 2026-11-25), not from a GPS reading at the
// door. Node ids are noted so they can be re-checked. Still worth a glance
// on site.

export const PLACES = {
  OI: {
    entrances: [
      { id: 'A', lat: 43.66795, lng: -79.39839 }, // Bloor St W front (OSM node 1707778363)
      { id: 'B', lat: 43.66843, lng: -79.39837 }, // east side, toward Bedford Rd (OSM node 4461090647)
    ],
  },
  BA: {
    entrances: [
      { id: 'M', name: 'Main entrance', detail: '40 St. George St', stepFree: true,
        note: 'Level entry, automatic doors', lat: 43.65967, lng: -79.39691 }, // St. George St side (OSM node 733206245)
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
