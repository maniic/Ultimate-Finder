# AI_HANDOFF.md — living work log for Ultimate Finder

> **Protocol:** Read this file in full at the start of every session. Update it
> at the end of every working pass: move finished items, record decisions with
> their why, keep "Next up" honest. Record the current state, not a transcript.

**Last updated:** 2026-11-16 (session 1: scaffold)

## Current state

Scaffolded: an Express server (`src/server.js`) on port 3000 serving a
placeholder page from `public/`, with `GET /healthz` for the deploy health
check, a `Dockerfile` (node:24-alpine, `npm ci`, runs as `node`), and
`CLAUDE.md` describing the auto-deploy rules and the deploy contract.

No product code yet. The design work lives in `submitted_docs/` (formative
studies, interview report, design concepts, experience map, floor-plan atlas).

## Next up

- Choose the frontend approach for the prototype (plain JS in `public/`, or a
  build step such as Vite). A build step must run inside the `Dockerfile`; the
  server only does `docker build`.
- First real feature from the chosen design concept.

## Decisions log

- **2026-11-16: `main` auto-deploys.** Several classmates contribute, so merges
  to `main` deploy without waiting on one person. The flip side is that `main`
  must always be deployable: branches + PRs, and humans do the merging. See
  `CLAUDE.md` → "`main` is production".
- **2026-11-16: the server owns the runtime, the repo owns the code.** The
  deploy server ignores any compose file here and runs the image read-only,
  non-root, without outbound network, behind its own proxy. That's why the
  deploy contract in `CLAUDE.md` exists. Changes to it are a server-side
  change (raise them with Junaid).
