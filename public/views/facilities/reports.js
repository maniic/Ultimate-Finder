// "Report a problem" for one facility, backed by the database through
// /api/facility-reports (src/api/facilities.js). It's the worked example of a
// view talking to the server: fetch JSON, build DOM with h(), and handle the
// loading and error states.

import { h, append } from '/js/ui.js';

const PROBLEMS = [
  ['not-working', 'Not working'],
  ['dirty', 'Dirty'],
  ['missing', "Can't find it"],
  ['other', 'Something else'],
];
const LABEL = Object.fromEntries(PROBLEMS);

function when(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function reportSection(facilityId) {
  const list = h('ul', { class: 'reports' });
  const status = h('p', { class: 'muted small', role: 'status' }, 'Loading recent reports…');

  async function load() {
    try {
      const res = await fetch(`/api/facility-reports?facilityId=${encodeURIComponent(facilityId)}`);
      if (!res.ok) throw new Error(res.status);
      const { reports } = await res.json();
      list.replaceChildren(...reports.map((r) =>
        h('li', null, h('strong', null, LABEL[r.problem] || r.problem), ` · ${when(r.createdAt)}`, r.note ? h('div', { class: 'small' }, r.note) : null)));
      status.textContent = reports.length ? 'Recent reports:' : 'No problems reported recently.';
    } catch {
      status.textContent = "Couldn't load reports right now.";
    }
  }

  const select = h('select', { id: 'problem', required: true },
    h('option', { value: '' }, 'Choose…'),
    PROBLEMS.map(([v, label]) => h('option', { value: v }, label)));
  const note = h('input', { type: 'text', id: 'note', maxlength: '500', placeholder: 'Optional details' });
  const msg = h('p', { class: 'small', role: 'status' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Send report');

  const form = h('form', {
    class: 'card report-form', hidden: true,
    onsubmit: async (e) => {
      e.preventDefault();
      if (!select.value) { msg.textContent = 'Pick what the problem is.'; return; }
      submit.disabled = true;
      msg.textContent = 'Sending…';
      try {
        const res = await fetch('/api/facility-reports', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ facilityId, problem: select.value, note: note.value || undefined }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'failed');
        msg.textContent = 'Thanks! Your report was sent.';
        form.reset();
        form.hidden = true;
        toggle.hidden = false;
        load();
      } catch (err) {
        msg.textContent = `Couldn't send: ${err.message}`;
      } finally {
        submit.disabled = false;
      }
    },
  },
  h('label', { class: 'field', for: 'problem' }, "What's wrong?"), select,
  h('label', { class: 'field', for: 'note' }, 'Details'), note,
  submit);

  const toggle = h('button', { type: 'button', class: 'btn', onclick: () => { form.hidden = false; toggle.hidden = true; select.focus(); } }, 'Report a problem');

  load();
  return append(h('section', { class: 'reports-section', 'aria-label': 'Problem reports' }), toggle, form, msg, status, list);
}
