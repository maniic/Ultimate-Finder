// Browser-side settings. Everything in this file ships to every visitor, so
// only put values here that are safe to be public.
//
// GOOGLE_MAPS_API_KEY: a browser key, restricted in Google Cloud to
//   - website referrers ultimate-finder.junaidarshad.com/* and localhost:3000/*
//   - the Maps JavaScript API and the Routes API only.
// Never commit an unrestricted key. Empty = the map falls back to an
// "Open in Google Maps" link.
//
// To try a key locally without committing it, run this once in the browser
// console:  localStorage.setItem('uf.mapsKey', '<your key>')

export const GOOGLE_MAPS_API_KEY = '';
