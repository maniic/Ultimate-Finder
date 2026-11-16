// Hash router. Each view is a folder under /views/<name>/ with:
//   view.js   exports `render(root, params, nav)` (and optionally `title`)
//   view.css  styles scoped under `.view-<name>`
// Views talk to each other ONLY through URL params (e.g.
// #/preview?b=OI&r=10-210&stepfree=1), never shared globals, so each can be
// built on its own branch. Adding a view = add its folder + its name below.

const VIEWS = ['search', 'preview', 'floorplan', 'navigate', 'recover', 'facilities'];
const DEFAULT_VIEW = 'search';
// Which bottom tab is highlighted for each view.
const TAB_FOR = { facilities: 'facilities' };

const root = document.getElementById('view');

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, query = ''] = raw.split('?');
  return { name: VIEWS.includes(name) ? name : DEFAULT_VIEW, params: Object.fromEntries(new URLSearchParams(query)) };
}

// nav.go('preview', { b: 'OI', r: '10-210' })  -> #/preview?b=OI&r=10-210
export const nav = {
  href(name, params = {}) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const q = new URLSearchParams(clean).toString();
    return `#/${name}${q ? `?${q}` : ''}`;
  },
  go(name, params) { location.hash = nav.href(name, params); },
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
  const tab = TAB_FOR[name] || 'search';
  document.querySelectorAll('[data-tab]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === tab));
  mod.render(root, params, nav);
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
