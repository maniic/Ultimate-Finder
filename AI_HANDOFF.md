# AI_HANDOFF.md — living work log for Ultimate Finder

> **Protocol:** Read this file in full at the start of every session. Update it
> at the end of every working pass: move finished items, record decisions with
> their why, keep "Next up" honest. Record the current state, not a transcript.

**Last updated:** 2026-11-21 (recover view: "I don't know where I am")

## Current state

**Live** at <https://ultimate-finder.junaidarshad.com>, auto-deployed from `main`.

- **App:** a hash-routed, phone-first frontend with six feature folders
  under `public/views/` (search, preview, floorplan, navigate, recover,
  facilities). They run on mock OISE data in `public/js/data.js`.
- **Server:** Express (ES modules) serving `public/` with `no-cache`,
  `/healthz` (which checks the DB), and auto-mounted `src/api/<feature>.js`
  routes.
- **Database:** Postgres 17 via Prisma 7.10.1. The schema is split per
  feature in `prisma/schema/`, with an init migration. Facilities' "Report
  a problem" saves to the database end to end.
- **Local development:** `docker compose up` (`compose.yaml`) runs the app
  plus Postgres, with a `prod` profile for prod-like checks.
- **Team docs:** `CONTRIBUTING.md` (workflow) and `docs/kickoff.md`
  (overview with diagrams). `CLAUDE.md` holds the agent rules: scope plus
  explicit approval for shared files, and the ship flow.

The design work lives in `submitted_docs/`. The chosen direction is in
`Ultimate Finder_ Prototyping Wayfinding at U of T (4).pdf`: an interactive
floor plan plus photo step cards, with evaluation findings and planned
design changes on pp. 22–32.

## Next up

- Teammates claim a view (Owner column in `README.md`) and work on
  `view/<name>` branches.
- Replace mock data with real buildings/rooms/routes. Real floor plans are
  in `submitted_docs/St. George Campus Floor-Plan Atlas.pdf`. Take real
  step photos.
- Evaluation priorities (report p. 30): recovery for users who don't know
  where they are (severity 3), step-free clarity, Previous step / Finish
  route (done in the starter), map legend (done in the starter), building
  names as well as codes (done in the starter).

## Decisions log

- **2026-11-21: "I don't know where I am" recovery (branch `view/recover`, owner Abdullah).** Answers the A2 severity-3 finding.
  - Recover menu leads with "I don't know where I am". Users place themselves by tapping a photo card of what they can see (every labelled item on the floor plans: lobby, elevators, stairs, entrances, room plates), filtered by floor, or via "I'm not sure": which floor number is on the nearest sign, or type a door-plate number. "Can't see any sign" says to walk to an elevator/stairwell or ask at the lobby desk.
  - A confirm screen shows the spot on the plan with the new path, "First, head toward …", then "Start directions from here" opens navigate at the rejoin step. Pure logic in `public/views/recover/reroute.js` (unit-tested), view flow in `recover.browser.test.js`.
  - Rejoin = nearest piece of the route on that floor; continue at its start if you're before it, else at its end. Never rejoin at the entrance step unless you're at an entrance. Blocked (or already-blocked) routes use `blockedElevator`; step-free stays on. Standing at the destination says "You're already there".
  - Kept in scope: spots come from `FLOORS` in shared `data.js`; captions live in `reroute.js`. `LOCATION_CHOICES` in `data.js` is now unused (left alone, shared file). Navigate's "avoiding the blocked elevator" notice is the only cue on the navigate side.
  - Photos are placeholders; take real ones for each spot.

- **2026-11-18: Outdoor map on Route preview (branch `view/preview-map`, owner Abdullah, not yet shipped).**
  - Google Maps JS API + Routes library (`Route.computeRoutes`, WALKING) in `public/views/preview/map.js`; location is asked only on "Directions from my location". Denied/unavailable → pick a start point. "Open in Google Maps" link is always there and is the fallback when there's no key or the script fails.
  - Destination comes from the URL (b, r or fac), never a fixed building: if the room has an indoor route, go to the entrance it starts from; otherwise the nearest (step-free if on) entrance. Entrance coordinates live in `public/views/preview/places.js` (estimates, verify on site); buildings with none get a Google Maps search link.
  - `?sim=1` adds a facilitator location simulator for indoor usability sessions.
  - Key goes in `public/js/config.js` (restricted to the site + localhost referrers, Maps JavaScript API + Routes API). `localStorage.uf.mapsKey` overrides it locally.
  - Tests: `npm test` (node:test; pure logic + Playwright browser tests with a fake google.maps, no key or DB needed). The fake must mirror the real library split (e.g. `LatLngBounds` is in `core`), or real-key bugs slip through.
  - Unknown room in a building with indoor data, or an unknown facility, shows a "couldn't find" message instead of a map. After the first location fix, timeouts are ignored (only a denied permission stops tracking).
- **2026-11-16: Buildings live in the DB; only OISE is enabled.** Branch
  `view/search` (not yet reviewed or shipped).
  - `Building` table (`prisma/schema/buildings.prisma`), seeded at startup
    by `src/api/buildings.js` from `src/api/_buildings-seed.json`: 46
    buildings from the floor-plan atlas plus OISE (not in the atlas).
    A migration can't `INSERT` (additive-only checker), hence the startup
    upsert. It never overwrites `enabled`.
  - `enabled` is false for everything except OISE, the only building with
    room data. The search view greys out disabled ones ("coming soon").
    Flip a building on in the DB once it has rooms in `data.js`.
  - Search autocomplete reads `GET /api/buildings`. Room validation still
    uses `ROOMS` in `public/js/data.js` (campus reference data stays in the
    repo).
  - Atlas codes are kept as printed, including odd ones: `Graham`,
    `Coach House`, `TF / MH / PI`, `HH6&8`, `HH2&96`. Worth a human check.
  - `public/js/data.js` `BUILDINGS` is now unused by search but still used
    by other views; left alone (shared file).

- **2026-11-16: Postgres + Prisma 7, Docker for local dev, per-feature files.**
  Junaid wanted a database and Docker.
  - The server runs a **dedicated Postgres 17** (not the platform's shared
    one) in the app's sandbox. It runs `prisma migrate deploy` from the new
    image before each swap, after a pre-migration dump.
  - Migrations are **additive only**, because a rollback runs old code
    against the new schema.
  - Prisma 7.10.1 is pinned: npm's `latest` tag currently points at an 8.0
    RC.
  - The generated client is TypeScript. It loads with no build step via
    Node 24 type stripping, which is why the package is `"type": "module"`.
  - **Per-feature files** keep six people from colliding:
    `prisma/schema/<feature>.prisma` (multi-file schema),
    `src/api/<feature>.js` (auto-mounted by `server.js`), and
    `public/views/<feature>/`.
  - `CLAUDE.md` Rule 1 makes agents stay in scope, and **ask for explicit
    approval** before touching any shared file.
  - `compose.yaml` is local only: an app with live reload, Postgres, and a
    `prod` profile that runs the production image read-only with
    migrations first.
  - Facilities' "Report a problem" (`src/api/facilities.js` +
    `views/facilities/reports.js`) is the worked end-to-end example.
- **2026-11-16: ship flow re-checks `main` right before merging.** `main`
  can move during the review. The agent re-fetches it, merges and re-checks
  if it moved, regenerates its own migration if `main` gained migrations,
  and requires GitHub to report `MERGEABLE` before `gh pr merge --merge`.

- **2026-11-16: static files are `Cache-Control: no-store`.** Without an
  explicit header, Cloudflare gave JS/CSS a 4-hour browser cache, so people
  kept running old views after a merge.
  - `no-cache` was shipped first (PR #3), and the live headers showed
    Cloudflare still rewrote it to `max-age=14400`. `no-store` passes
    through (as on the platform's notepad app).
  - `?v=<hash>` versioning (the home-infra `asset-cache-versioning` skill)
    would need an import map or a build step to reach ES-module `import`s.
  - Cost: about 11 small files re-downloaded per page load. Revisit if a
    build step is ever added.
- **2026-11-16: no build step; one folder per view; URL-only coupling.** Six
  people work in parallel, so the structure minimises merge conflicts: each
  screen lives in its own folder, and views pass state only through the
  hash URL. Plain ES modules keep the `Dockerfile` trivial and let anyone
  edit and refresh. Revisit if someone wants a framework, since that's a
  `Dockerfile` change too.

- **2026-11-16: `main` auto-deploys.** Several classmates contribute, so merges
  to `main` deploy without waiting on one person. The flip side is that `main`
  must always be deployable: branches + PRs, and humans do the merging. See
  `CLAUDE.md` → "`main` is production".
- **2026-11-16: the server owns the runtime, the repo owns the code.** The
  deploy server ignores any compose file here and runs the image read-only,
  non-root, without outbound network, behind its own proxy. That's why the
  deploy contract in `CLAUDE.md` exists. Changes to it are a server-side
  change (raise them with Junaid).
