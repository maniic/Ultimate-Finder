// Hash router. Each view is a folder under /views/<name>/ with:
//   view.js   exports `render(root, params, nav)` (and optionally `title`)
//   view.css  styles scoped under `.view-<name>`
// Views talk to each other ONLY through URL params (e.g.
// #/preview?b=OI&r=10-210&stepfree=1), never shared globals, so each can be
// built on its own branch. Adding a view = add its folder + its name below.

const VIEWS = ['search', 'preview', 'floorplan', 'navigate', 'recover', 'facilities'];
const DEFAULT_VIEW = 'search';

const root = document.getElementById('view');

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const name = q === -1 ? raw : raw.slice(0, q);
  const query = q === -1 ? '' : raw.slice(q + 1);
  return { name: VIEWS.includes(name) ? name : DEFAULT_VIEW, params: Object.fromEntries(new URLSearchParams(query)) };
}

// nav.go('preview', { b: 'OI', r: '10-210' })  -> #/preview?b=OI&r=10-210
export const nav = {
  href(name, params = {}) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const q = new URLSearchParams(clean).toString();
    return `#/${name}${q ? `?${q}` : ''}`;
  },
  go(name, params, { keepFocus } = {}) {
    if (keepFocus) root.dataset.keepFocus = keepFocus; // element id to refocus after re-render
    location.hash = nav.href(name, params);
  },
  back() { history.length > 1 ? history.back() : nav.go(DEFAULT_VIEW); },
};

function loadCss(name) {
  if (document.querySelector(`link[data-view="${name}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/views/${name}/view.css`;
  link.dataset.view = name;
  document.head.append(link);
}

let renderSeq = 0;
let lastView = null;
async function route() {
  const seq = ++renderSeq;
  const { name, params } = parseHash();
  loadCss(name);
  let mod;
  try {
    mod = await import(`/views/${name}/view.js`);
  } catch (err) {
    console.error(err);
    root.className = 'view';
    root.textContent = `Couldn't load the "${name}" view. Check the console.`;
    return;
  }
  if (seq !== renderSeq) return; // a newer navigation won the race
  root.replaceChildren();
  root.className = `view view-${name}`;
  document.title = mod.title ? `${mod.title} · Ultimate Finder` : 'Ultimate Finder';
  try {
    mod.render(root, params, nav);
  } catch (err) {
    console.error(err);
    root.replaceChildren(`Couldn't render the "${name}" view. Check the console.`);
    return;
  }
  // Same view, only params changed (e.g. a toggle): keep keyboard focus where it was.
  const sameView = name === lastView;
  lastView = name;
  const keep = root.dataset.keepFocus;
  delete root.dataset.keepFocus;
  if (sameView && keep) {
    document.getElementById(keep)?.focus();
    return;
  }
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
