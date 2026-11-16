# Working on Ultimate Finder together

How the six of us build this without stepping on each other. The short
version:
- one feature each, on your own branch;
- stay in your feature's files;
- when you're done, an AI review checks your work, you say "ship it", and
  it merges and deploys.

For the big picture (architecture, pipeline, caveats), see
[`docs/kickoff.md`](docs/kickoff.md).

## The one rule that matters

**Merging into `main` publishes your change to
<https://ultimate-finder.junaidarshad.com> within about 2 minutes.** There's
no staging site: merging *is* deploying. So:

- Never push directly to `main`. Work on your branch and ship it through
  the flow below.
- Never force-push to `main` or rewrite its history.

A broken merge can't take the site down. If the build, the database
migration or the startup check fails, the live site keeps the previous
version and your change simply doesn't appear.

## Setup (once)

You need:
- **Docker Desktop** (or [OrbStack](https://orbstack.dev) on a Mac, which is
  lighter);
- **Git**;
- **Claude Code**;
- the **GitHub CLI**, logged in with `gh auth login`;
- **write access** to this repo (ask `maniic`).

```bash
git clone https://github.com/maniic/Ultimate-Finder.git
cd Ultimate-Finder
docker compose up --build        # first run takes a minute or two
```

Open <http://localhost:3000>. That's the app running with its own local
Postgres database, set up the same way as the server.
- Edits to `src/`, `public/` and `prisma/` apply live: refresh the browser.
- Stop it with `Ctrl+C`, or with `docker compose down`.
- After someone changes `package.json`, run `docker compose up --build`
  again.
- To wipe your local database and start fresh: `docker compose down -v`.

You never need access to the server itself.

## Features: one each, one folder each

| Feature | Its files |
|---|---|
| Search | `public/views/search/` |
| Route preview | `public/views/preview/` |
| Floor plan | `public/views/floorplan/` |
| Step-by-step | `public/views/navigate/` |
| "This isn't what I see" | `public/views/recover/` |
| Facilities | `public/views/facilities/`, `src/api/facilities.js`, `prisma/schema/facilities.prisma` |

When your feature needs server code or database tables, they get their own
files too: `src/api/<feature>.js` and `prisma/schema/<feature>.prisma`.
They're picked up automatically, so you never edit `src/server.js`.
Facilities' "Report a problem" is the worked example of the whole chain.

**To claim a feature,** say so in the group chat, then put your name on the
`// Owner:` line at the top of its `view.js` in your first PR.

## Stay in your lane (it's enforced)

Everything outside your feature's files is **shared**, because other
features depend on it:
- `public/js/*`
- `public/css/base.css`
- `public/index.html`
- `src/server.js`
- `src/db.js`
- `prisma/schema/base.prisma`
- `package.json`
- `Dockerfile`
- `compose.yaml`

**Claude Code won't touch a shared file, or anyone else's feature, without
asking you first.** It tells you which file, what it would change and who
else it affects. It goes ahead only after you explicitly say yes, and it
notes that approval in the PR. So when it asks:

- **Think before you say yes.** Could it be done inside your folder
  instead? (It suggests that when it can.) A change to `base.css` or
  `ui.js` changes everyone's views.
- **For bigger shared changes,** like reshaping `public/js/data.js` or
  adding an npm package, give the group a heads-up in the chat first.
- **Never import another view's files.** Views talk only through the URL,
  for example `nav.go('preview', { b: 'OI', r: '10-210' })`.

## The everyday loop

```bash
git checkout main && git pull           # start from the latest main
git checkout -b view/facilities         # your branch (names below)
docker compose up --build               # run it, then build with Claude Code
git add -A && git commit -m "Facilities: sort by distance"
git push -u origin view/facilities      # backup + visible to others; deploys nothing
```

Commit and push your branch as often as you like.

| Kind of change | Branch name | Example |
|---|---|---|
| Your feature | `view/<feature>` | `view/navigate` |
| A follow-up on it | `view/<feature>-<topic>` | `view/navigate-audio` |
| Shared files | `shared/<topic>` | `shared/real-building-list` |
| Bug fix | `fix/<topic>` | `fix/search-did-you-mean` |
| Docs only | `docs/<topic>` | `docs/photo-guidelines` |

**Keep up with `main`** while you work, especially before shipping:

```bash
git fetch origin && git merge origin/main && git push   # merge, never rebase, never --force
```

## Shipping your change

There are no teammate reviews. You decide when it's ready, and an AI review
checks it first:

1. **Tell Claude Code you're done** (for example, "I'm done, review this
   for shipping"). It:
   - merges in the latest `main` and sorts out any conflicts;
   - runs a **fresh, independent review**: does it work, does it run like
     production with migrations applied, did it stay in scope (with
     approvals recorded), and are there no secrets;
   - goes through each finding with you, fixing it or agreeing to skip it.
2. **Say "ship it".** Right before merging, it checks **again** whether
   `main` moved during the review. If it did, it merges that in and
   re-checks, and asks you again if anything meaningful changed. Then it
   opens a PR, merges it with a merge commit, and confirms the live site
   updated.

**Not using Claude Code?** Do the same by hand:
1. merge `origin/main` into your branch;
2. run the prod-like check (`docker compose --profile prod up -d --build prod`,
   then <http://localhost:3001/healthz> should say `ok`);
3. open a PR and merge it with **"Create a merge commit"** (not squash or
   rebase);
4. delete the branch.

If your change isn't live ~5 minutes after merging, the server rejected it.
The old version is still up. Tell Junaid, since the logs live on the server.

**Something broke on the live site?** Open the merged PR on GitHub, click
**Revert**, and merge the revert. The previous version is back in about 2
minutes.

## Database & migrations

Postgres 17, through Prisma 7. Your local one runs inside
`docker compose up`. The server has its own, and it's backed up nightly and
before every migration.

**Adding or changing tables for your feature:**
1. Edit **your** schema file, `prisma/schema/<feature>.prisma`, or create it.
2. Create the migration:
   `docker compose exec app npx prisma migrate dev --name add_saved_rooms`.
3. Commit the schema file **and** the new folder under `prisma/migrations/`.
4. Use the database in `src/api/<feature>.js` via
   `import { prisma } from '../db.js'`.

**On your laptop, anything goes.** Add tables, change your mind, remove
them again. Your local database is yours, and `docker compose down -v`
wipes it if it gets messy.

**What lands on `main` must only add things. The server enforces this.** A
merge that breaks these rules is **not deployed at all**, and the site keeps
the previous version:
- **Allowed:**
  - new tables, indexes and enums;
  - new columns that are optional or have a constant `DEFAULT`;
  - new foreign keys;
  - new enum values.
- **Rejected:**
  - dropping, renaming or retyping anything;
  - `NOT NULL` without a default;
  - a `UNIQUE` index on a table that already exists;
  - `INSERT`/`UPDATE`/`DELETE`;
  - SQL functions, triggers and views.
- **Seed data** (like the campus data) lives in the repo as files, not in
  migrations.
- **Never edit or delete a migration that's already on `main`.** Make a new
  one.
- **Why:** if a deploy ever rolls back, the old code must still work against
  the new schema.
- **Need something destructive** (like removing a column)? Ask Junaid. It
  takes two steps, and he approves the second one on the server.

**Before shipping, collapse your experiments into one migration.** If you
added a table and later removed it, your branch has two migrations, and the
"remove" one would be rejected. Claude does this for you in the ship flow.
By hand:
1. delete your branch's unmerged migration folders;
2. `docker compose exec app npx prisma migrate reset --force`;
3. `docker compose exec app npx prisma migrate dev --name what_my_feature_adds`.

This also puts your migration after any new ones from `main`.

**Check it yourself** (the same checker the server uses):
`sh scripts/check-migrations.sh --against origin/main`

**If a rejected migration already got merged,** every later deploy is
blocked until it's fixed. Ship a new commit that deletes that unmerged
migration folder (it never reached the database), or replaces it with an
additive version.
- **Store what users create,** like reports and saved rooms. Campus data
  (buildings, rooms, routes) stays in the repo as JS/JSON files, so changes
  to it show up in PRs.
- **No personal data** (names, emails) without a group decision.

## External APIs (Google Maps etc.)

The server has **no internet access**, so call external APIs **from the
browser**, in your view's JS. The Google Maps JavaScript API, including
walking directions, works fine this way.

A browser API key is visible to anyone who opens the page, so it must be
**restricted** in Google Cloud Console:
- HTTP referrers: `ultimate-finder.junaidarshad.com/*` and
  `localhost:3000/*`;
- APIs: only the Maps APIs we use.

It lives in one shared file, `public/js/config.js`. Adding it is a shared
change, so expect to be asked.

## Photos

- Put them in `public/img/<feature>/`, resized to about 1200 px wide and
  under ~300 KB.
- No identifiable people. The repo is public.

## Things the server enforces

The full table is in `CLAUDE.md` → "The deploy contract":
- port **3000**, and `/healthz` returns 200, which includes the database
  being reachable;
- migrations must apply cleanly (`prisma migrate deploy`);
- a **read-only filesystem**: store data in the database, not files;
- **no outbound internet** from the server;
- no `VOLUME`, and no `LABEL` other than `org.opencontainers.image.*`, in
  the `Dockerfile`.

Need one of these changed? Raise it in the group chat before building
around it. It needs a change on the server side.
