// Tests for outdoor.js (pure helpers for the map on Route preview).
// Run: node --test public/views/preview/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceMeters, walkMinutes, formatDistance, pickEntrance,
  geoErrorState, directionsUrl, hasArrived, isValidLatLng,
} from './outdoor.js';

const ROBARTS = { lat: 43.6644, lng: -79.3990 };
const OISE = { lat: 43.6683, lng: -79.3987 };

test('isValidLatLng accepts real coordinates and rejects junk', () => {
  assert.equal(isValidLatLng(OISE), true);
  assert.equal(isValidLatLng({ lat: 91, lng: 0 }), false);
  assert.equal(isValidLatLng({ lat: 0, lng: 181 }), false);
  assert.equal(isValidLatLng({ lat: '43', lng: -79 }), false);
  assert.equal(isValidLatLng({ lat: NaN, lng: 0 }), false);
  assert.equal(isValidLatLng(null), false);
  assert.equal(isValidLatLng(undefined), false);
});

test('distanceMeters is zero for the same point and symmetric', () => {
  assert.equal(distanceMeters(OISE, OISE), 0);
  assert.equal(distanceMeters(OISE, ROBARTS), distanceMeters(ROBARTS, OISE));
});

test('distanceMeters matches a known campus distance (Robarts to OISE ~435 m)', () => {
  const d = distanceMeters(ROBARTS, OISE);
  assert.ok(d > 400 && d < 470, `got ${d}`);
});

test('walkMinutes rounds up at ~80 m per minute and is at least 1', () => {
  assert.equal(walkMinutes(0), 1);
  assert.equal(walkMinutes(10), 1);
  assert.equal(walkMinutes(80), 1);
  assert.equal(walkMinutes(81), 2);
  assert.equal(walkMinutes(800), 10);
});

test('formatDistance uses metres under 1 km and kilometres above', () => {
  assert.equal(formatDistance(0), '0 m');
  assert.equal(formatDistance(123.4), '120 m');
  assert.equal(formatDistance(999), '1.0 km');
  assert.equal(formatDistance(1234), '1.2 km');
  assert.equal(formatDistance(12500), '13 km');
});

const ENTRANCES = [
  { id: 'A', name: 'Bloor St entrance', stepFree: true, lat: 43.66835, lng: -79.39870 },
  { id: 'B', name: 'Bedford Rd entrance', stepFree: false, lat: 43.66810, lng: -79.39930 },
];

test('pickEntrance returns the first entrance when nothing else is known', () => {
  assert.equal(pickEntrance(ENTRANCES).id, 'A');
});

test('pickEntrance picks the nearest entrance to the start point', () => {
  const nearB = { lat: 43.66805, lng: -79.39940 };
  assert.equal(pickEntrance(ENTRANCES, { from: nearB }).id, 'B');
});

test('pickEntrance only offers step-free entrances when step-free is on', () => {
  const nearB = { lat: 43.66805, lng: -79.39940 };
  assert.equal(pickEntrance(ENTRANCES, { from: nearB, stepFree: true }).id, 'A');
});

test('pickEntrance falls back to all entrances if none is step-free, and flags it', () => {
  const stairs = ENTRANCES.map((e) => ({ ...e, stepFree: false }));
  const e = pickEntrance(stairs, { stepFree: true });
  assert.equal(e.id, 'A');
  assert.equal(e.stepFreeUnavailable, true);
});

test('pickEntrance returns null for no entrances and ignores ones without coordinates', () => {
  assert.equal(pickEntrance([]), null);
  assert.equal(pickEntrance(undefined), null);
  const one = [{ id: 'X', stepFree: true }, ENTRANCES[1]];
  assert.equal(pickEntrance(one).id, 'B');
});

test('geoErrorState maps browser geolocation errors to UI states', () => {
  assert.equal(geoErrorState({ code: 1 }), 'denied');
  assert.equal(geoErrorState({ code: 2 }), 'unavailable');
  assert.equal(geoErrorState({ code: 3 }), 'timeout');
  assert.equal(geoErrorState(undefined), 'unavailable');
  assert.equal(geoErrorState({ code: 99 }), 'unavailable');
});

test('directionsUrl builds a Google Maps walking link to the entrance', () => {
  const url = new URL(directionsUrl({ destination: OISE }));
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/dir/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('destination'), '43.6683,-79.3987');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(url.searchParams.has('origin'), false);
});

test('directionsUrl includes the origin when one is known', () => {
  const url = new URL(directionsUrl({ origin: ROBARTS, destination: OISE }));
  assert.equal(url.searchParams.get('origin'), '43.6644,-79.399');
});

test('directionsUrl rejects a bad destination instead of building a broken link', () => {
  assert.equal(directionsUrl({ destination: { lat: 200, lng: 0 } }), null);
  assert.equal(directionsUrl({}), null);
  // a bad origin is dropped, not fatal
  const url = new URL(directionsUrl({ origin: { lat: 'x' }, destination: OISE }));
  assert.equal(url.searchParams.has('origin'), false);
});

test('hasArrived is true within 30 m of the entrance', () => {
  const near = { lat: OISE.lat + 0.0001, lng: OISE.lng }; // ~11 m
  const far = { lat: OISE.lat + 0.001, lng: OISE.lng };   // ~111 m
  assert.equal(hasArrived(near, OISE), true);
  assert.equal(hasArrived(far, OISE), false);
  assert.equal(hasArrived(far, OISE, 150), true);
});

test('hasArrived does not trigger on a very inaccurate fix', () => {
  const near = { lat: OISE.lat + 0.0001, lng: OISE.lng, accuracy: 500 };
  assert.equal(hasArrived(near, OISE), false);
});

test('hasArrived is false for missing positions', () => {
  assert.equal(hasArrived(null, OISE), false);
  assert.equal(hasArrived(OISE, null), false);
});
