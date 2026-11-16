# CLAUDE.md — working on Ultimate Finder

## Session ritual

1. **Start:** read `AI_HANDOFF.md` in full. It records the current state,
   decisions already made, and what's next.
2. **End of every working pass:** update `AI_HANDOFF.md`. Move finished items,
   log new decisions with their *why*, and list what's next. Record the
   current state, not a transcript.

## What this repo is

Ultimate Finder is a CSC318 (U of T) group project: a wayfinding prototype for
the St. George campus. It's a Node.js + Express server on port 3000 that
serves a static frontend from `public/` (plain ES modules, no build step).
Several classmates contribute through branches and pull requests. `submitted_docs/` holds course deliverables
(research, concepts, experience maps) and is not part of the app.

## `main` is production — every merge auto-deploys

**Anything that lands on `main` is live at
<https://ultimate-finder.junaidarshad.com> within about two minutes, with no
human step.** A server polls this repo's `main`, builds the `Dockerfile` at the
new commit, health-checks it, and swaps it in. If the build fails or the image
is rejected, the previous version keeps serving. If the new version starts but
fails its health check, it's live for up to ~90s before being rolled back. A
failed commit isn't retried: pushing a new commit is the only way to retry.

Rules that follow from this (they apply to humans and AI agents alike):

- **Never commit or push directly to `main`.** Work on a branch, open a pull
  request, and merge it only when it works locally (`npm start`, then load
  the page and `/healthz`). An agent should open the PR and stop. Merging is
  a human decision, because merging is deploying.
- **Keep `main` deployable at every commit.** Don't merge half-finished work
  that breaks the server. Put it behind a page nobody links to yet, or keep
  it on a branch.
- **Don't rewrite `main`'s history** (`--force`, rebase-and-force-push). A
  revert is a normal PR that deploys like any other.

### The deploy contract — don't break these

The server only uses what's described here. Anything else is ignored.

| Requirement | Why |
|---|---|
| `Dockerfile` at the repo root builds with plain `docker build .` | It's the only build instruction the server follows. |
| The container listens on **port 3000** | The reverse proxy in front of it expects 3000. |
| `GET /healthz` returns **200** within ~90s of starting, and keeps returning 200 (no crash or restart) across a re-check ~5s later | A failing health check rolls the deploy back. |
| The app runs on a **read-only filesystem** as a non-root user; only `/tmp` is writable (wiped on every deploy) | Persistent state needs a different design. Talk to Junaid first. |
| The server has **no outbound network access** at runtime | Server-side calls to external APIs fail. Browser-side calls (map tiles, client-side APIs) work. Talk to Junaid if the server needs to call out. |
| **No `LABEL`** instructions, except `org.opencontainers.image.*` | Any other label gets the deploy rejected. |
| **No `VOLUME`** instructions | The deploy gets rejected. There's no persistent storage. |
| A `docker-compose.yml` in this repo is **not used** | The server runs its own. Add one for local dev if you like. |

Changing any of these means a change on the server side too. Raise it with
Junaid in the PR; it won't take effect just by merging.

## App structure: one folder per view

`README.md` has the layout and the view table. `CONTRIBUTING.md` is the team
workflow (branch names, merge-commit merges, pre-merge checklist, reverts).
Follow it, and point teammates to it.
The short version for agents:

- Each screen is `public/views/<name>/view.js` (exports
  `render(root, params, nav)`) plus `view.css` (scoped under `.view-<name>`).
  Views share state **only through URL params**: no globals, no
  cross-view imports. That keeps one person's branch from breaking another's.
- A teammate's branch `view/<name>` should normally touch only that folder.
  Shared files (`public/js/{app,ui,data,floorplan}.js`, `public/css/base.css`)
  are add-only in feature branches. Don't rename or reshape what other views
  use, and propose changes like that in a separate PR.
- Build DOM with `h()` / `append()` from `public/js/ui.js`, never
  `innerHTML` with data. `h()` doesn't check `href`/`src`, so in-app links
  go through `nav.href()`, and URL params or user input never go into an
  `href`/`src` directly.
- View-only mock data lives in `public/views/<name>/data.js`. Teammates
  claim a view with the `// Owner:` line in its `view.js`.
- `public/js/data.js` is mock data. Keep the "not verified on site" caveat
  until it's replaced with real, checked data.

## Hard rules

- **Never commit secrets** (API keys, passwords, tokens). The repo is
  **public**. `.env` is gitignored, and the deployed app gets no secrets at
  all today.
- **No personal data in the repo.** Interview transcripts and survey results
  in `submitted_docs/` are already public. Don't add anything identifying a
  participant beyond what the course submissions already contain.

## Verifying changes

- `npm install && npm start`, then open <http://localhost:3000> and
  <http://localhost:3000/healthz>.
- `docker build -t uf-test . && docker run --rm --read-only --tmpfs /tmp -p 3000:3000 uf-test`
  runs it the way the server does.
