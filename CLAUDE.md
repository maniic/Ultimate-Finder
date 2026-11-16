# CLAUDE.md — working on Ultimate Finder

## Session ritual

1. **Start:** read `AI_HANDOFF.md` in full. It records the current state,
   decisions already made, and what's next.
2. **End of every working pass:** update `AI_HANDOFF.md`. Move finished items,
   log new decisions with their *why*, and list what's next. Record the
   current state, not a transcript.

## What this repo is

Ultimate Finder is a CSC318 (U of T) group project: a wayfinding prototype for
the St. George campus, built by six classmates, mostly with AI assistants.
- **Server:** Node.js 24 + Express on port 3000 (ES modules).
- **Frontend:** plain HTML/CSS/JS modules in `public/`, with no build step.
- **Database:** PostgreSQL 17 through Prisma 7.
- **Local development** runs in Docker (`compose.yaml`).

`submitted_docs/` holds course deliverables (research, concepts, evaluation)
and is not part of the app. Humans read `CONTRIBUTING.md`, and
`docs/kickoff.md` is the team overview.

## Rule 1: scope every change to one feature

Six people work in parallel. Stray edits are what cause merge conflicts and
broken views, so **enforce this even when the teammate doesn't mention it.**

**Work out the scope from the branch name before editing anything:**

| Branch | Files you may change |
|---|---|
| `view/<name>` (or `view/<name>-<topic>`) | `public/views/<name>/**`, `src/api/<name>.js`, `prisma/schema/<name>.prisma`, new migration folders generated from that schema file, `public/img/<name>/**` |
| `shared/<topic>` | Only the shared files the teammate approved for this change (the approval rule below still applies) |

**Shared files** (every feature depends on them):
- `public/js/*`
- `public/css/base.css`
- `public/index.html`
- `src/server.js`
- `src/db.js`
- `prisma/schema/base.prisma`
- `package.json` and `package-lock.json`
- `Dockerfile`
- `compose.yaml`
- `prisma.config.ts`
| `fix/<topic>` | The files the bug lives in, and nothing else |
| `docs/<topic>` | Markdown only |

**Hard rules:**
- **Shared or out-of-scope files need the teammate's explicit approval
  first. Always ask, every time.** Before the first edit to any file outside
  the branch's scope (a shared file, another view's file, a new npm
  package):
  1. **Stop and ask before editing.** Name each file, say what you'd change
     and why it's needed, and say who else it affects (which views use it).
     If there's an in-scope alternative, offer it, for example a local helper
     in the view's own folder instead of a new export in `public/js/ui.js`.
  2. **Wait for an explicit yes** ("yes, change ui.js" or similar). Silence,
     "just do it all", or a yes to a *different* file doesn't count.
     Approval covers only the files and change you described. A later
     shared-file edit needs a new question.
  3. **If they say no,** keep the work in scope, or stop and explain what
     can't be done without that change.
  4. **Record every approved out-of-scope change** in the PR description
     ("Shared-file changes, approved by the teammate: `public/js/ui.js`:
     added `formatTime()`"). The pre-ship review checks for it.

  This applies even when the request only *implies* a shared change: for
  example, "make the buttons bigger" means `public/css/base.css`, which
  every view uses, so ask whether they meant every button or just their
  view's.
- **No drive-by changes.** That means no reformatting, renaming,
  "tidying" or refactoring of files you weren't asked to touch, and no
  dependency upgrades.
- **Never import another view's files or reach into its DOM.** Views talk
  only through URL params (`nav.go('preview', { b, r })`).
- On `main` itself, don't edit anything: create the right branch first, and
  ask the teammate which feature it's for if that's unclear.

The pre-ship review checks scope (`git diff --stat origin/main...HEAD`).
Any out-of-scope file without a recorded approval blocks shipping until the
teammate explicitly approves it.

## `main` is production — every merge auto-deploys

**Anything that lands on `main` is live at
<https://ultimate-finder.junaidarshad.com> within about two minutes, with no
human step.** A server polls this repo's `main`, then:
1. builds the `Dockerfile` (last stage) at the new commit;
2. backs up the database and runs `prisma migrate deploy` from the new image;
3. health-checks the new version and swaps it in.

If the build, migration or health check fails, the previous version keeps
serving. A failed commit isn't retried: pushing a new commit is the only way
to retry.

- **Never commit or push directly to `main`.** Changes reach `main` only
  through the ship flow below.
- **Keep `main` deployable at every commit.**
- **Don't rewrite `main`'s history** (`--force`, rebase-and-force-push). Undo
  with a revert PR, which deploys like any other.

### The ship flow (how an agent gets a teammate's work onto `main`)

There's no teammate code review. Each change gets a **fresh-context AI
review**, then the **teammate's explicit approval**. Do these steps in order,
and don't skip or reorder them:

1. **Work on the teammate's feature branch,** within its scope (Rule 1).
   Commit freely. Pushing the *branch* any time is fine, since it deploys
   nothing.
2. **When the teammate says they're done, sync with `main`:**
   `git fetch origin && git merge origin/main`. Always merge, never rebase.
   - Resolve conflicts *within scope*. If a conflict is in someone else's
     files, keep their version and tell the teammate.
   - **Migrations: collapse to one final migration** whenever this branch
     has more than one new migration (teammates experiment locally: add,
     then remove…), or `main` gained migrations that aren't on this branch:
     1. delete all of this branch's unmerged migration folders;
     2. `docker compose exec app npx prisma migrate reset --force`;
     3. `docker compose exec app npx prisma migrate dev --name <what_this_feature_adds>`.

     That way only the net, final change lands on `main`, and it comes
     after everything already there. Then run
     `sh scripts/check-migrations.sh --against origin/main`. It must pass.
3. **Run the pre-ship review.** Spawn a **fresh-context subagent** with real
   tool access, so it runs the commands and reads the files itself rather
   than trusting a summary. It checks:
   - **Scope:** `git diff --stat origin/main...HEAD` matches Rule 1, and
     every out-of-scope file has a recorded teammate approval.
   - **It runs like production:** `docker compose --profile prod up -d --build prod`,
     then `curl -f localhost:3001/healthz`. Migrations apply and the server
     starts read-only. Tear it down afterwards.
   - **Correctness,** including edge cases: an unknown building or room, a
     missing param, a bad API request.
   - **The deploy contract** below.
   - **Migrations:** `sh scripts/check-migrations.sh --against origin/main`
     passes (additive only, no edits to merged migrations).
   - **Security:** no secrets, personal data or unrestricted API keys.
     DOM is built with `h()`/`append()`, links with `nav.href()`, API input
     is validated, and Prisma queries take no raw SQL with user input.
4. **Fix each finding, or dismiss it with a stated reason, together with the
   teammate.** Never ship past a finding nobody addressed.
5. **Ask the teammate for explicit approval to ship.** Summarise what
   changes and what the review found. "Ship it" or similar counts. Silence,
   or an earlier approval of a different change, doesn't.
6. **Check for conflicts with `main` again, right before merging.** `main`
   may have moved during the review.
   1. `git fetch origin`. If `origin/main` has new commits, merge it in
      again (step 2) and re-run the prod check from step 3.
   2. If resolving the merge changed anything beyond a trivial conflict, or
      added migrations, tell the teammate and get approval again.
7. **Ship:**
   - push the branch;
   - `gh pr create --base main`, with the summary and review outcome as the
     description;
   - confirm `gh pr view <n> --json mergeable -q .mergeable` is `MERGEABLE`.
     If it isn't, go back to step 6;
   - `gh pr merge <n> --merge --delete-branch`. Use a merge commit, never
     squash or rebase, so other branches stay clean.
8. **Confirm it went live.** Within ~5 minutes,
   `https://ultimate-finder.junaidarshad.com/healthz` returns 200 and the
   change is visible. If not, the server rejected the deploy and the
   previous version is still live. Tell the teammate, who should contact
   Junaid, since deploy logs live on the server.

Without Claude Code, a teammate does the same by hand: the
`CONTRIBUTING.md` checklist, then PR and merge commit.

### The deploy contract — don't break these

The server only uses what's described here. Anything else is ignored.

| Requirement | Why |
|---|---|
| `Dockerfile` builds with plain `docker build .`, and the **last stage** is the production image | It's the only build instruction the server follows. |
| The container listens on **port 3000** | The reverse proxy expects 3000. |
| `GET /healthz` returns **200** within ~90s, and again ~5s later with no restart. It returns 503 if the database is unreachable | A failing health check rolls the deploy back. |
| `./node_modules/.bin/prisma migrate deploy` works inside the image | The server runs it, read-only and with no internet, before every swap. |
| The server provides `DATABASE_URL`. **Never hardcode a connection string** | Its password exists only on the server. |
| **Migrations on `main` are additive only, and merged migrations are never edited or deleted.** The server checks every deploy and refuses violating commits. Allowed: `CREATE TABLE`, `CREATE INDEX` (`UNIQUE` only on a table created in the same migration), `CREATE TYPE … AS ENUM`, `ALTER TABLE … ADD COLUMN` (constant defaults only; `NOT NULL` needs a `DEFAULT`), `ADD CONSTRAINT … FOREIGN KEY`, `ALTER TYPE … ADD VALUE`. Everything else is rejected, including `DROP`, `RENAME`, `ALTER COLUMN`, `INSERT`/`UPDATE`/`DELETE`, functions, triggers and views. It's a guard against mistakes, not a security boundary; backups cover the rest. `scripts/check-migrations.sh` is the same checker, for local use | If a deploy rolls back, the *old* code runs against the *new* schema. A destructive change needs a two-step plan that Junaid approves on the server; ask him. |
| **Read-only filesystem**, non-root user, only `/tmp` writable (wiped each deploy) | Store data in the database, not files. |
| **No outbound network** from the server | Call external APIs (Google Maps etc.) from the browser. |
| **No `LABEL`** except `org.opencontainers.image.*`, and **no `VOLUME`** | The deploy gets rejected. |
| `compose.yaml` is **local development only** | The server runs its own hardened setup. |

Changing any of these needs a server-side change too. Raise it with Junaid;
it won't take effect just by merging.

## How the code is organised

`README.md` has the layout. `CONTRIBUTING.md` has the team workflow.

**Views**
- Each screen is `public/views/<name>/view.js`, exporting
  `render(root, params, nav)`, plus `view.css` scoped under `.view-<name>`.
- State is shared only through URL params.
- View-only mock data goes in `public/views/<name>/data.js`.
- Teammates claim a view with the `// Owner:` line at the top of its
  `view.js`.

**Server API**
- One file per feature: `src/api/<name>.js` exports `path` and `router`, and
  is mounted automatically at `/api/<path>`. Don't edit `src/server.js` to
  add routes.
- Validate every input. Endpoints are public and unauthenticated.
- `src/api/facilities.js` is the worked example.

**Database**
- One schema file per feature: `prisma/schema/<name>.prisma`.
  `base.prisma` (generator and datasource) is shared.
- **Locally, anything goes.** Add, change and remove tables freely while
  developing, and `docker compose down -v` resets everything. Only what
  ships to `main` must be additive, so collapse experiments into one final
  migration before shipping (ship flow step 2).
- Use the `prisma` client from `src/db.js`. Never create another client.
- Never edit a migration that's already on `main`.

**Building DOM**
- Use `h()` / `append()` from `public/js/ui.js`, never `innerHTML` with data.
  `h()` doesn't check `href`/`src`, so in-app links go through
  `nav.href()`, and URL params or user input never go into an `href`/`src`
  directly.

**Data and photos**
- `public/js/data.js` is mock campus data. Keep the "not verified on site"
  caveat until it's replaced.
- Campus reference data (buildings, rooms, routes) stays in the repo as
  JS/JSON. The database is for what *users* create (reports, saved rooms and
  so on).

## Hard rules

- **Never commit secrets** (API keys, passwords, tokens). The repo is
  **public**. The exception is a *browser* API key (such as Google Maps),
  which ends up in the page anyway. It may be committed only if it's
  restricted in its console to the site's referrers
  (`ultimate-finder.junaidarshad.com/*`, `localhost:3000/*`) and to the APIs
  actually used. Put it in `public/js/config.js`.
- **No personal data.** Don't collect names, emails or anything identifying
  in the database without a group decision. Don't add study-participant
  details to the repo beyond what `submitted_docs/` already contains.
- **No new npm packages without the teammate's explicit approval.**
  `package.json` is a shared file (Rule 1).
- **Don't commit** files from `prisma init` (`.agents/`, `.windsurf/`,
  `skills-lock.json`) or anything in `generated/`.

## Local development and verification

- `docker compose up --build` runs the app at <http://localhost:3000> with
  Postgres. It applies migrations, regenerates the client, and reloads live
  on edits to `src/`, `public/` and `prisma/`.
- Rebuild (`--build`) after `package.json` changes.
- **New migration:** edit your `prisma/schema/<feature>.prisma`, then
  `docker compose exec app npx prisma migrate dev --name <what_changed>`.
- **Prod-like check:** `docker compose --profile prod up -d --build prod`,
  then `curl localhost:3001/healthz`.
- **Reset the local DB:** `docker compose down -v`.
