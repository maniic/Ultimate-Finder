# Ultimate Finder

Wayfinding inside U of T St. George buildings, built for CSC318. It follows
the interactive floor-plan design (with photo step cards) from our
prototyping report in `submitted_docs/`.

**Live:** <https://ultimate-finder.junaidarshad.com>. Every merge to `main`
deploys automatically within ~2 min, so read `CLAUDE.md` → "`main` is
production" before you merge anything.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000, restarts when you edit server code
```

The frontend is plain HTML/CSS/JS modules in `public/`, with no build step.
Edit a file and refresh the browser.

## How the app is organised

```
public/
├── index.html            app shell: header, <main id="view">, bottom tabs
├── css/base.css          shared design tokens + components (buttons, cards, chips…)
├── js/app.js             hash router: #/<view>?param=value
├── js/ui.js              h() element helper, append(), photo placeholders
├── js/data.js            MOCK campus data (buildings, rooms, routes, facilities)
├── js/floorplan.js       shared SVG floor-plan renderer + legend
└── views/<name>/
    ├── view.js           export function render(root, params, nav)
    └── view.css          styles, scoped under .view-<name>
```

Views only talk to each other through the URL. For example, search sends
you to `#/preview?b=OI&r=10-210`. To work on a view, open its URL directly;
you don't have to click through the earlier screens.

## The six views: one each

Each view is a working starting point built from the paper prototype, with a
`TODO` list at the top of its `view.js` drawn from our think-aloud and
heuristic-evaluation findings.

| View | Folder | Try it | Prototype ref |
|---|---|---|---|
| Search (building name/code + room) | `views/search` | `#/search` | Fig. 2a–b |
| Route preview (entrance, walk time, step-free) | `views/preview` | `#/preview?b=OI&r=10-210` | Fig. 2c |
| Floor plan (floors, highlighted room, legend) | `views/floorplan` | `#/floorplan?b=OI&f=10&r=10-210` | Fig. 2c, concept 3 |
| Step-by-step directions | `views/navigate` | `#/navigate?b=OI&r=10-210&step=1` | Fig. 3, concept 2 |
| "This isn't what I see" recovery | `views/recover` | `#/recover?b=OI&r=10-210&step=3` | Fig. 4 |
| Facilities (nearest by type, status) | `views/facilities` | `#/facilities` | Fig. 5 |

Claim a view by putting your name on the `// Owner:` line at the top of its
`view.js`. Each claim then edits a different file, so claims never conflict.

## Working on your view

**Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before your first PR.** It covers
claiming a view, branch names, keeping your branch up to date, what's safe
to change in shared files, the pre-merge checklist and how to undo a bad
deploy.

The short version: `git checkout -b view/<name>`, then work inside
`public/views/<name>/`. When you're happy with it, tell Claude Code you're
done. It reviews the change, asks for your OK, then merges it to `main`,
which deploys it.

All data is mock data in `public/js/data.js`, based on the prototype's
OISE 10-210 scenario. None of it has been verified on site.
