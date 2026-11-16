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

```bash
git checkout main && git pull
git checkout -b view/<name>        # e.g. view/facilities
# ...edit public/views/<name>/...
git push -u origin view/<name>     # then open a PR into main
```

- **Stay inside your view's folder** where you can. Then branches never
  conflict.
- **Mock data that only your view uses** goes in `views/<name>/data.js`,
  not the shared `js/data.js`. Six people appending to the same arrays
  would conflict.
- **Shared files** (`js/data.js`, `js/ui.js`, `js/floorplan.js`,
  `css/base.css`, `js/app.js`): *adding* things is fine. Renaming or
  reshaping something another view uses needs its own small PR, and a heads-up
  in the group chat.
- **Links and images:** build in-app links with `nav.href(...)`. Never put
  URL params or user input straight into an `href`/`src`.
- **Before you merge:** pull `main` into your branch, run it locally, click
  through your view, and check `/healthz`. Merging deploys.
- **New view?** Add a folder under `public/views/` and its name to `VIEWS`
  in `public/js/app.js`.
- **Real photos:** the striped boxes are placeholders, and their captions
  say what to photograph. Put images in `public/img/` and pass the path as
  the second argument to `photo(caption, src)`.

All data is mock data in `public/js/data.js`, based on the prototype's
OISE 10-210 scenario. None of it has been verified on site.
