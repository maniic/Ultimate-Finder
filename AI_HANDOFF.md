# AI_HANDOFF.md — living work log for Ultimate Finder

> **Protocol:** Read this file in full at the start of every session. Update it
> at the end of every working pass: move finished items, record decisions with
> their why, keep "Next up" honest. Record the current state, not a transcript.

**Last updated:** 2026-11-16 (session 1: scaffold, views, DB + Docker)

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

- **2026-11-16: static files are `Cache-Control: no-cache`, not hash-versioned.**
  Without an explicit header, Cloudflare gave JS/CSS a 4-hour browser cache,
  so people kept running old views after a merge. The platform's usual fix,
  `?v=<hash>` on the assets the HTML references (home-infra
  `asset-cache-versioning` skill), would need an import map or a build step
  to reach ES-module `import`s. Revalidating with ETags costs one 304 per
  module per page load (about 11 files), which is fine for a small
  prototype that changes often. Known edge case: a tab left open across a
  deploy keeps the old shared modules in memory, so a newly opened view
  that imports a new shared export can fail until the page is reloaded.
  `app.js` shows a render-error message in that case. Revisit if a build
  step is ever added.

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
