# Working on Ultimate Finder together

How the six of us build this without stepping on each other. The short
version: **one view each, your own branch, an AI review plus your OK, then
it merges and deploys.**

## The one rule that matters

**Merging into `main` publishes your change to
<https://ultimate-finder.junaidarshad.com> within about 2 minutes.** There's
no staging site and no "deploy" button: merging *is* deploying. So:

- Never push directly to `main`. Work on your own branch, and ship it
  through the review + approval flow ("Shipping your change" below).
- Only ship what you've run locally.
- Never force-push to `main` or rewrite its history.

If a merge breaks the build or the app won't start, the live site keeps
running the previous version, so a bad merge can't take it down. But your
change won't show up until someone merges a fix.

## Setup (once)

```bash
git clone https://github.com/maniic/Ultimate-Finder.git
cd Ultimate-Finder
npm install
npm run dev            # http://localhost:3000
```

You need **Node 24+** and nothing else. You don't need Docker. There's no
build step: edit a file in `public/` and refresh the browser.

You only ever work in **this repo**. The server side is set up separately,
and you never need access to it.

## Who does what

Each of us owns one view, and each view is its own folder under
`public/views/`:

| View | Folder | Open it at |
|---|---|---|
| Search | `views/search` | `/#/search` |
| Route preview | `views/preview` | `/#/preview?b=OI&r=10-210` |
| Floor plan | `views/floorplan` | `/#/floorplan?b=OI&f=10&r=10-210` |
| Step-by-step directions | `views/navigate` | `/#/navigate?b=OI&r=10-210&step=1` |
| "This isn't what I see" | `views/recover` | `/#/recover?b=OI&r=10-210&step=3` |
| Facilities | `views/facilities` | `/#/facilities` |

**To claim one,** say so in the group chat, then put your name on the
`// Owner:` line at the top of that view's `view.js` in your first PR. The
TODO list under it says what to build next. It's taken from our
think-aloud and heuristic-evaluation findings.

## The everyday loop

```bash
# 1. Start from the latest main
git checkout main
git pull

# 2. Make a branch for this change
git checkout -b view/facilities          # see "Branch names" below

# 3. Work, committing as you go
git add -A
git commit -m "Facilities: sort by distance, add last-checked dates"

# 4. Push your branch (a backup, and visible to the others; deploys nothing)
git push -u origin view/facilities
```

Push as often as you like. When you're happy with it, see
"Shipping your change" below.

### Branch names

| Kind of change | Branch name | Example |
|---|---|---|
| Your view | `view/<view>` | `view/navigate` |
| A follow-up on your view | `view/<view>-<topic>` | `view/navigate-audio` |
| Shared files (data, helpers, styles) | `shared/<topic>` | `shared/real-building-list` |
| Bug fix | `fix/<topic>` | `fix/search-did-you-mean` |
| Docs only | `docs/<topic>` | `docs/photo-guidelines` |

Keep branches short-lived. A few days is ideal. Small PRs get reviewed
and merged; giant ones rot.

### Keeping your branch up to date

When `main` moves on (someone else merged), bring it into your branch:

```bash
git checkout view/facilities
git fetch origin
git merge origin/main        # merge, don't rebase, so you never need --force
git push
```

If there's a conflict, it's almost always in a shared file. Fix it, run
the app, commit, and push. If you're unsure, ask the person whose change
you collided with.

## Stay in your lane (that's how we avoid conflicts)

- **Your view's folder is yours.** Change anything in
  `public/views/<your-view>/` freely.
- **Mock data only your view uses** goes in
  `public/views/<your-view>/data.js`, not the shared `public/js/data.js`.
- **Shared files are add-only:**
  - `public/js/data.js`
  - `public/js/ui.js`
  - `public/js/floorplan.js`
  - `public/js/app.js`
  - `public/css/base.css`

  Adding a new helper, field or style is fine. **Renaming or changing
  something another view already uses** needs its own small `shared/…` PR,
  plus a heads-up in the group chat.
- **Views talk only through the URL.** Example: `nav.go('preview', { b: 'OI', r: '10-210' })`.
  Don't import another person's view or use global variables.
- **Photos:** go in `public/img/<your-view>/`.
  - Resize them to about 1200 px wide and under ~300 KB. Every file makes
    each deploy slower.
  - No identifiable people in shots. The repo is public.

## Before you ship: checklist

The AI review covers this too, but it's worth knowing what it checks.


- [ ] `main` is merged into your branch, and it still runs: `npm run dev`
- [ ] You clicked through your view, including the empty and error cases
      (bad room number, unknown building and so on)
- [ ] <http://localhost:3000/healthz> says `ok`
- [ ] Nothing changed outside your folder, unless that was the point of the PR
- [ ] No passwords, API keys or personal data. The repo is public.
- [ ] Only if you have Docker and changed `package.json` or the `Dockerfile`
      (not required): run
      `docker build -t uf . && docker run --rm --read-only --tmpfs /tmp -p 3000:3000 uf`.
      That's exactly how the server runs it.

## Shipping your change

There are no teammate reviews. You decide when your work is ready, and an
AI review checks it first:

1. **Work on your branch** until you're happy with it. Pushing your branch
   is always safe: it deploys nothing.
2. **Tell Claude Code you're done** (for example, "I'm done with this, review
   it for shipping"). The repo's `CLAUDE.md` makes it:
   - bring in the latest `main`;
   - run a **fresh, independent review** of your changes: does it work,
     does the server still start, did you stay in your folder, no secrets;
   - go through each finding with you, fixing it or agreeing to skip it.
3. **Approve it** ("ship it"). Only then does it push, open a PR, merge it
   into `main` with a merge commit, and check that the live site updated
   (~2 min).

Not using Claude Code? Go through the checklist above yourself, open a PR,
and merge it with **"Create a merge commit"** (not squash or rebase).
Delete the branch afterwards.

If your change isn't live ~5 minutes after merging, the server rejected
it (it failed to build or start), and the old version is still up. Tell
Junaid, since the logs live on the server.

### Something broke on the live site?

Open the merged PR on GitHub, click **Revert**, and merge the revert PR it
creates. That deploys the previous code. Then fix it calmly on a new branch.

## Using AI assistants (Claude Code, Copilot, etc.)

That's welcome. Claude Code reads `CLAUDE.md` in this repo automatically and
follows the ship flow above: it never touches `main` directly, and it
merges only after its independent review **and** your explicit approval.
Read what it wrote before you say "ship it". You're the one approving.

## External APIs (Google Maps etc.)

Call them **from the browser** (in your view's JS), never from
`src/server.js`. The server has no internet access, but visitors' browsers
do. The Google Maps JavaScript API, including walking directions, works
fine this way.

A browser API key is visible to anyone who opens the page, so before
committing one, **restrict it** in Google Cloud Console:
- HTTP referrers: `ultimate-finder.junaidarshad.com/*` and
  `localhost:3000/*` only;
- APIs: only the Maps APIs you use.

Put it in one place (for example `public/js/config.js`), not scattered
through views.

## Things the server enforces

The server rejects or rolls back a deploy that breaks any of these. Details
are in `CLAUDE.md` → "The deploy contract".

- The app listens on port **3000**, and `GET /healthz` returns 200.
- It has **no persistent storage**: the app's filesystem is read-only, apart
  from a temporary `/tmp`.
- The server has **no outbound internet access**. Calls from the browser,
  such as map tiles, are fine.
- The `Dockerfile` has no `VOLUME`, and no `LABEL` other than
  `org.opencontainers.image.*`.

Need one of these to change, for example a database or a server-side API
call? Raise it in your PR or the group chat before building around it. It
needs a change on the server side.
