'use strict';

/*
  Dran – welche Übung ist heute dran?
  Alle Daten liegen lokal im Browser (localStorage). Kein Backend.
*/

const STORE_KEY = 'dran.data';
const DATA_VERSION = 1;
const $app = document.getElementById('app');

/* ================= Datum ================= */

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayStr() { return toDateStr(new Date()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); }
function daysBetween(a, b) {
  const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((utc(b) - utc(a)) / 86400000);
}
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MON_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function fmtShort(s) { const d = parseDate(s); return `${WD[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`; }
function fmtLong(s) { const d = parseDate(s); return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MON_LONG[d.getMonth()]}`; }

/* ================= Helfer ================= */

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function plural(n, one, many) { return n === 1 ? one : many; }
function unitShort(ex) { return ex.unit === 'secs' ? 's' : 'Wdh'; }
function stepSize(ex) { return ex.unit === 'secs' ? 5 : 1; }

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2400);
}

/* ================= Daten ================= */

function seedData() {
  const t = todayStr();
  const ex = (name, unit, cadence, cooldown, defaultSets, extra = {}) =>
    ({ id: uid(), name, unit, cadence, cooldown, defaultSets, paused: false, note: '', createdAt: Date.now(), ...extra });
  const w = (exercise, daysAgo, values, feels, variant = '', note = '') => ({
    id: uid(), exerciseId: exercise.id, date: addDays(t, -daysAgo), variant, note, createdAt: Date.now() - daysAgo * 86400000,
    sets: values.map((v, i) => ({ value: v, feel: feels[i] || null })),
  });

  const klimm = ex('Klimmzüge', 'reps', 3, 2, [5, 5, 5], { note: 'Griff breiter fühlt sich besser an.' });
  const hocke = ex('Tiefe Hocke', 'secs', 1, 0, [60, 60], { note: 'Fersen bleiben unten, Gewicht nach vorn.' });
  const squat = ex('Kniebeugen', 'reps', 4, 2, [15, 15, 15]);
  const push = ex('Liegestütze', 'reps', 5, 2, [10, 10, 8]);
  const row = ex('Rudern an der Stange', 'reps', 4, 2, [10, 10, 10]);
  const hang = ex('Dead Hang', 'secs', 2, 1, [30, 30]);
  const hand = ex('Handstand an der Wand', 'secs', 3, 1, [20, 20], { paused: true });

  return {
    version: DATA_VERSION,
    exercises: [klimm, hocke, squat, push, row, hang, hand],
    workouts: [
      w(klimm, 11, [5, 5, 4], ['easy', 'hard', 'hard'], 'schulterbreit, Schaukelstange'),
      w(klimm, 8, [5, 5, 5], ['easy', 'easy', 'hard'], 'schulterbreit, Schaukelstange'),
      w(klimm, 4, [6, 6, 5], ['easy', 'easy', 'easy'], 'schulterbreit, Schaukelstange'),
      w(hocke, 3, [45, 45], ['easy', 'hard']),
      w(hocke, 1, [60, 60], ['easy', 'easy']),
      w(squat, 6, [15, 15, 15], ['easy', 'easy', 'hard']),
      w(squat, 2, [15, 15, 15], ['easy', 'easy', 'hard']),
      w(push, 3, [12, 10, 8], ['easy', 'hard', 'hard']),
      w(row, 1, [10, 10, 10], ['easy', 'easy', 'hard'], 'Füße am Boden'),
      w(hang, 0, [30, 30], ['easy', 'hard']),
      w(hand, 20, [20, 15], ['hard', 'hard']),
    ],
    lastExport: null,
  };
}

function num(v, min, fallback) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, n) : fallback; }

function normalize(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.exercises) || !Array.isArray(d.workouts)) throw new Error('Ungültiges Format');
  const exercises = d.exercises.filter((x) => x && x.id && x.name).map((x) => ({
    id: String(x.id),
    name: String(x.name),
    unit: x.unit === 'secs' ? 'secs' : 'reps',
    cadence: num(x.cadence, 1, 3),
    cooldown: num(x.cooldown, 0, 1),
    defaultSets: Array.isArray(x.defaultSets) && x.defaultSets.length ? x.defaultSets.map((v) => num(v, 1, 5)) : [5, 5, 5],
    paused: !!x.paused,
    note: String(x.note || ''),
    createdAt: Number(x.createdAt) || Date.now(),
  }));
  const ids = new Set(exercises.map((x) => x.id));
  const workouts = d.workouts.filter((w) => w && ids.has(String(w.exerciseId)) && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && Array.isArray(w.sets)).map((w) => ({
    id: String(w.id || uid()),
    exerciseId: String(w.exerciseId),
    date: w.date,
    variant: String(w.variant || ''),
    note: String(w.note || ''),
    createdAt: Number(w.createdAt) || Date.now(),
    sets: w.sets.map((s) => ({ value: num(s && s.value, 0, 0), feel: s && (s.feel === 'easy' || s.feel === 'hard') ? s.feel : null })),
  }));
  return { version: DATA_VERSION, exercises, workouts, lastExport: d.lastExport || null };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Daten konnten nicht gelesen werden', e); }
  const d = seedData();
  save(d);
  return d;
}

function save(d = db) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); }
  catch (e) { alert('Speichern hat nicht geklappt: ' + e.message); }
}

let db = load();

function getEx(id) { return db.exercises.find((x) => x.id === id); }
function workoutsFor(id) {
  return db.workouts.filter((w) => w.exerciseId === id)
    .sort((a, b) => (b.date === a.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1));
}
function lastWorkout(id) { return workoutsFor(id)[0] || null; }
function allEasy(w) { return !!w && w.sets.length > 0 && w.sets.every((s) => s.feel === 'easy'); }

/* Status: rest (Cool-Down läuft) · ok (möglich) · due (fällig) */
function status(ex, t = todayStr()) {
  const last = lastWorkout(ex.id);
  if (!last) return { kind: 'due', days: null, over: 1e9 };
  const days = Math.max(0, daysBetween(last.date, t));
  if (days < ex.cooldown) return { kind: 'rest', days, remaining: ex.cooldown - days, over: days - ex.cadence };
  if (days >= ex.cadence) return { kind: 'due', days, over: days - ex.cadence };
  return { kind: 'ok', days, over: days - ex.cadence };
}

function rhythmText(ex) {
  const parts = [ex.cadence === 1 ? 'täglich' : `alle ${ex.cadence} T`];
  if (ex.cooldown > 0) parts.push(`Pause ${ex.cooldown} T`);
  if (ex.unit === 'secs') parts.push('Sek');
  return parts.join(' · ');
}
function agoText(st) {
  if (st.days === null) return 'noch nie gemacht';
  if (st.days === 0) return 'heute gemacht';
  if (st.days === 1) return 'gestern';
  return `vor ${st.days} Tagen`;
}
function statusLabel(st) {
  if (st.kind === 'due') return 'fällig';
  if (st.kind === 'ok') return 'möglich';
  return `Pause noch ${st.remaining} ${plural(st.remaining, 'Tag', 'Tage')}`;
}

/* ================= Zustand (nur im Speicher) ================= */

const drafts = {};   // exerciseId -> { sets: [..], variant }
let session = null;  // laufendes Workout
let form = null;     // neue Übung

function getDraft(ex) {
  if (!drafts[ex.id]) {
    const last = lastWorkout(ex.id);
    drafts[ex.id] = {
      sets: last && last.sets.length ? last.sets.map((s) => Math.max(1, s.value)) : ex.defaultSets.slice(),
      variant: last ? last.variant : '',
    };
  }
  return drafts[ex.id];
}

/* ================= Bausteine ================= */

const chevron = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

function stepper(target, value, label, extra = '') {
  return `<div class="stepper">
    <button type="button" data-action="step" data-target="${target}" data-d="-1" ${extra} aria-label="${esc(label)} verringern">−</button>
    <span class="stepper__val">${value}</span>
    <button type="button" data-action="step" data-target="${target}" data-d="1" ${extra} aria-label="${esc(label)} erhöhen">+</button>
  </div>`;
}
function seg(action, current, options) {
  return `<div class="seg" role="group">${options.map(([val, label]) =>
    `<button type="button" data-action="${action}" data-v="${val}" aria-pressed="${current === val}">${label}</button>`).join('')}</div>`;
}
function feelText(f) { return f === 'easy' ? 'leicht' : f === 'hard' ? 'schwer' : '–'; }

/* ================= Screens ================= */

function viewList() {
  const t = todayStr();
  const active = db.exercises.filter((x) => !x.paused).map((ex) => ({ ex, st: status(ex, t) }));
  const due = active.filter((a) => a.st.kind === 'due').sort((a, b) => b.st.over - a.st.over);
  const ok = active.filter((a) => a.st.kind === 'ok').sort((a, b) => b.st.over - a.st.over);
  const rest = active.filter((a) => a.st.kind === 'rest').sort((a, b) => a.st.remaining - b.st.remaining);
  const paused = db.exercises.filter((x) => x.paused);

  const row = ({ ex, st }) => {
    const hint = st.kind !== 'rest' && allEasy(lastWorkout(ex.id));
    const sub = st.kind === 'rest' ? `noch ${st.remaining} ${plural(st.remaining, 'Tag', 'Tage')} Pause` : rhythmText(ex);
    const big = st.days === null ? 'neu' : st.days === 0 ? 'heute' : `${st.days} T`;
    const her = st.days === null || st.days === 0 ? '' : 'her';
    return `<a class="row row--${st.kind}" href="#/ex/${ex.id}">
      <div class="row__main">
        <span class="row__name">${esc(ex.name)}</span>
        <span class="row__sub">${sub}</span>
        ${hint ? '<span class="row__hint">↑ zuletzt alles leicht</span>' : ''}
      </div>
      <div class="row__ago"><span class="row__days">${big}</span>${her ? `<span class="row__her">${her}</span>` : ''}</div>
    </a>`;
  };
  const section = (kind, label, items) => items.length
    ? `<section class="sec sec--${kind}"><h2 class="sec__label">${label}</h2>${items.map(row).join('')}</section>` : '';

  let backupLine = '';
  if (db.workouts.length) {
    if (!db.lastExport) backupLine = 'Noch kein Backup gemacht';
    else {
      const d = daysBetween(db.lastExport.slice(0, 10), t);
      if (d >= 30) backupLine = `Letztes Backup vor ${d} Tagen`;
    }
  }

  return `
    <header>
      <p class="date">${fmtLong(t)}</p>
      <h1>Heute</h1>
    </header>
    ${active.length === 0 && paused.length === 0 ? `<div class="empty"><p>Noch keine Übungen.</p></div>` : ''}
    ${section('due', 'Fällig', due)}
    ${section('ok', 'Möglich', ok)}
    ${section('rest', 'Pause', rest)}
    <div class="foot">
      ${paused.length ? `<p>Pausiert: ${paused.map((x) => `<a class="u" href="#/ex/${x.id}">${esc(x.name)}</a>`).join(', ')}</p>` : ''}
      <a class="btn btn--dashed" href="#/new">+ Übung hinzufügen</a>
      <div class="foot__links">
        <a class="u" href="#/data" style="min-height:44px;display:inline-flex;align-items:center">Daten &amp; Backup</a>
        ${backupLine ? `<span>${backupLine}</span>` : ''}
      </div>
    </div>`;
}

function viewExercise(id) {
  const ex = getEx(id);
  if (!ex) return null;
  const st = status(ex);
  const last = lastWorkout(ex.id);
  const draft = getDraft(ex);
  const history = workoutsFor(ex.id).slice(0, 12);
  const u = unitShort(ex);

  const lastCard = last ? `
    <section class="card">
      <div class="card__head"><h2>Letztes Mal</h2><span class="small">${fmtShort(last.date)}</span></div>
      <div class="sets-table">
        ${last.sets.map((s, i) => `<div class="sets-table__row"><span>Satz ${i + 1}</span><span>${s.value} ${u}</span><span class="feel feel--${s.feel || 'none'}">${feelText(s.feel)}</span></div>`).join('')}
      </div>
      ${last.variant ? `<p class="small">Variante: ${esc(last.variant)}</p>` : ''}
      ${last.note ? `<p class="small">Notiz: ${esc(last.note)}</p>` : ''}
      ${allEasy(last) ? '<p class="hint">Alle Sätze leicht. Du könntest steigern.</p>' : ''}
    </section>` : `<p class="muted">Noch kein Workout eingetragen.</p>`;

  return `
    <a class="back" href="#/">${chevron}Heute</a>
    <header>
      <h1 data-title>${esc(ex.name)}</h1>
      <p class="meta">${agoText(st)}${ex.paused ? ' · <span class="st--rest">pausiert</span>' : ` · <span class="st--${st.kind}">${statusLabel(st)}</span>`}</p>
    </header>
    ${ex.note ? `<p class="small">${esc(ex.note)}</p>` : ''}
    ${lastCard}

    <section class="stack">
      <h2>Heute</h2>
      ${draft.sets.map((v, i) => `<div class="line"><span class="line__label">Satz ${i + 1}</span>${stepper('draft', `${v}<small>${u}</small>`, `Satz ${i + 1}`, `data-i="${i}"`)}</div>`).join('')}
      <div class="two">
        <button type="button" class="btn btn--dashed" data-action="add-set">+ Satz</button>
        <button type="button" class="btn btn--dashed" data-action="remove-set" ${draft.sets.length <= 1 ? 'disabled' : ''}>− Satz</button>
      </div>
      <label class="field">Variante
        <input type="text" data-input="draft-variant" value="${esc(draft.variant)}" placeholder="z. B. breiter Griff, Schaukelstange" autocomplete="off">
      </label>
    </section>

    <button type="button" class="btn btn--primary" data-action="start">Workout starten</button>

    ${history.length ? `
    <section class="stack" style="gap:8px">
      <h2>Verlauf</h2>
      <ul class="hist">
        ${history.map((w) => `<li>
          <span class="hist__date">${fmtShort(w.date)}</span>
          <span class="hist__vals">${w.sets.map((s) => `<span class="v--${s.feel || 'none'}" title="${feelText(s.feel)}">${s.value}</span>`).join('')}${w.variant ? `<span class="small">${esc(w.variant)}</span>` : ''}</span>
          <button type="button" class="x" data-action="del-workout" data-wid="${w.id}" aria-label="Eintrag vom ${fmtShort(w.date)} löschen">×</button>
        </li>`).join('')}
      </ul>
      <p class="small"><span class="v--easy">grün</span> = leicht, <span class="v--hard">orange</span> = schwer</p>
    </section>` : ''}

    <section class="settings">
      <h2>Einstellungen</h2>
      <label class="field">Name
        <input type="text" data-input="ex-name" value="${esc(ex.name)}" autocomplete="off">
      </label>
      <div class="line"><span class="line__label">Mindestens alle</span>${stepper('cadence', `${ex.cadence}<small>${plural(ex.cadence, 'Tag', 'Tage')}</small>`, 'Rhythmus')}</div>
      <div class="line"><span class="line__label">Pause mindestens</span>${stepper('cooldown', `${ex.cooldown}<small>${plural(ex.cooldown, 'Tag', 'Tage')}</small>`, 'Pause')}</div>
      <div class="line"><span class="line__label">Zählen in</span>${seg('ex-unit', ex.unit, [['reps', 'Wdh'], ['secs', 'Sek']])}</div>
      <label class="field">Notiz zur Übung
        <textarea data-input="ex-note" placeholder="Technik, Körpergefühl, Ideen …">${esc(ex.note)}</textarea>
      </label>
      <div class="two">
        <button type="button" class="btn" data-action="toggle-pause">${ex.paused ? 'Fortsetzen' : 'Pausieren'}</button>
        <button type="button" class="btn btn--danger" data-action="delete-ex">Löschen</button>
      </div>
    </section>`;
}

function viewWorkout(id) {
  const ex = getEx(id);
  if (!ex) return null;
  if (!session || session.exerciseId !== id) return null;
  const u = unitShort(ex);
  return `
    <a class="back" href="#/ex/${ex.id}">${chevron}Abbrechen</a>
    <header>
      <h1>${esc(ex.name)}</h1>
      ${session.variant ? `<p class="meta">${esc(session.variant)}</p>` : ''}
    </header>
    <div class="stack">
      ${session.sets.map((s, i) => `
        <div class="wcard">
          <div class="line"><span class="line__label">Satz ${i + 1}</span>${stepper('session', `${s.value}<small>${u}</small>`, `Satz ${i + 1}`, `data-i="${i}"`)}</div>
          <div class="two">
            <button type="button" class="feelbtn feelbtn--easy" data-action="feel" data-i="${i}" data-v="easy" aria-pressed="${s.feel === 'easy'}">leicht</button>
            <button type="button" class="feelbtn feelbtn--hard" data-action="feel" data-i="${i}" data-v="hard" aria-pressed="${s.feel === 'hard'}">schwer</button>
          </div>
        </div>`).join('')}
    </div>
    <label class="field">Notiz (optional)
      <input type="text" data-input="session-note" value="${esc(session.note)}" placeholder="z. B. linke Schulter zwickt" autocomplete="off">
    </label>
    <label class="field">Datum
      <input type="date" data-change="session-date" value="${session.date}" max="${todayStr()}">
    </label>
    <button type="button" class="btn btn--primary" data-action="finish" style="margin-top:auto">Fertig</button>`;
}

function viewNew() {
  if (!form) form = { name: '', unit: 'reps', count: 3, value: 8, cadence: 3, cooldown: 1 };
  const u = form.unit === 'secs' ? 's' : 'Wdh';
  return `
    <a class="back" href="#/">${chevron}Heute</a>
    <h1>Neue Übung</h1>
    <section class="stack">
      <label class="field">Name
        <input type="text" data-input="form-name" value="${esc(form.name)}" placeholder="z. B. Klimmzüge" autocomplete="off">
      </label>
      <div class="line"><span class="line__label">Zählen in</span>${seg('form-unit', form.unit, [['reps', 'Wdh'], ['secs', 'Sek']])}</div>
      <div class="line"><span class="line__label">Sätze</span>${stepper('form-count', form.count, 'Sätze')}</div>
      <div class="line"><span class="line__label">Pro Satz</span>${stepper('form-value', `${form.value}<small>${u}</small>`, 'Wert pro Satz')}</div>
      <div class="line"><span class="line__label">Mindestens alle</span>${stepper('form-cadence', `${form.cadence}<small>${plural(form.cadence, 'Tag', 'Tage')}</small>`, 'Rhythmus')}</div>
      <div class="line"><span class="line__label">Pause mindestens</span>${stepper('form-cooldown', `${form.cooldown}<small>${plural(form.cooldown, 'Tag', 'Tage')}</small>`, 'Pause')}</div>
      <p class="small">„Mindestens alle“: ab dann ist die Übung grün (fällig). „Pause“: so lange ist sie gesperrt. Dazwischen ist sie orange (möglich).</p>
    </section>
    <button type="button" class="btn btn--primary" data-action="create" style="margin-top:auto">Übung anlegen</button>`;
}

function viewData() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  return `
    <a class="back" href="#/">${chevron}Heute</a>
    <h1>Daten &amp; Backup</h1>
    <p class="muted">Alles liegt nur auf diesem Gerät. Es gibt keinen Server und keinen Account.</p>
    ${standalone ? '' : `<p class="hint" style="color:var(--ink2);background:#ECEAE4">Tipp: Installiere Dran auf dem Home-Bildschirm (iPhone: Teilen → „Zum Home-Bildschirm“, Android: Menü → „App installieren“). Dann bleiben die Daten zuverlässig erhalten.</p>`}
    <section class="stack">
      <h2>Backup</h2>
      <p class="small">${db.lastExport ? `Letzter Export: ${fmtShort(db.lastExport.slice(0, 10))}` : 'Noch kein Export.'} · ${db.exercises.length} Übungen, ${db.workouts.length} Workouts</p>
      <button type="button" class="btn" data-action="export">Daten exportieren</button>
      <label class="btn" style="position:relative">Backup importieren
        <input type="file" accept="application/json,.json" data-change="import" style="position:absolute;inset:0;opacity:0;cursor:pointer">
      </label>
      <p class="small">Import ersetzt alle aktuellen Daten.</p>
    </section>
    <section class="settings">
      <h2>Zurücksetzen</h2>
      <button type="button" class="btn" data-action="seed">Beispieldaten laden</button>
      <button type="button" class="btn btn--danger" data-action="wipe">Alle Daten löschen</button>
    </section>`;
}

/* ================= Routing ================= */

function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  return { name: parts[0] || 'list', id: parts[1] };
}

function render() {
  const r = route();
  let html = null;
  if (r.name === 'list') html = viewList();
  else if (r.name === 'ex') html = viewExercise(r.id);
  else if (r.name === 'workout') html = viewWorkout(r.id);
  else if (r.name === 'new') html = viewNew();
  else if (r.name === 'data') html = viewData();
  if (html === null) {
    if (r.name === 'workout' && getEx(r.id)) { location.replace('#/ex/' + r.id); return; }
    location.replace('#/');
    return;
  }
  $app.innerHTML = html;
}

/* ================= Aktionen ================= */

function currentEx() { const r = route(); return r.id ? getEx(r.id) : null; }

const actions = {
  step(ds) {
    const d = Number(ds.d);
    const i = Number(ds.i);
    const ex = currentEx();
    switch (ds.target) {
      case 'draft': { const dr = getDraft(ex); dr.sets[i] = Math.max(1, dr.sets[i] + d * stepSize(ex)); break; }
      case 'session': { const s = session.sets[i]; s.value = Math.max(0, s.value + d * stepSize(ex)); break; }
      case 'cadence': ex.cadence = Math.max(1, ex.cadence + d); save(); break;
      case 'cooldown': ex.cooldown = Math.max(0, ex.cooldown + d); save(); break;
      case 'form-count': form.count = Math.max(1, Math.min(10, form.count + d)); break;
      case 'form-value': form.value = Math.max(1, form.value + d * (form.unit === 'secs' ? 5 : 1)); break;
      case 'form-cadence': form.cadence = Math.max(1, form.cadence + d); break;
      case 'form-cooldown': form.cooldown = Math.max(0, form.cooldown + d); break;
    }
    render();
  },
  'add-set'() { const dr = getDraft(currentEx()); dr.sets.push(dr.sets[dr.sets.length - 1] || 5); render(); },
  'remove-set'() { const dr = getDraft(currentEx()); if (dr.sets.length > 1) dr.sets.pop(); render(); },
  start() {
    const ex = currentEx();
    const dr = getDraft(ex);
    session = { exerciseId: ex.id, date: todayStr(), variant: dr.variant.trim(), note: '', sets: dr.sets.map((v) => ({ value: v, feel: null })) };
    location.hash = '#/workout/' + ex.id;
  },
  feel(ds) {
    const s = session.sets[Number(ds.i)];
    s.feel = s.feel === ds.v ? null : ds.v;
    render();
  },
  finish() {
    const ex = currentEx();
    db.workouts.push({
      id: uid(), exerciseId: ex.id, date: session.date || todayStr(), variant: session.variant, note: session.note.trim(),
      createdAt: Date.now(), sets: session.sets.map((s) => ({ value: s.value, feel: s.feel })),
    });
    ex.defaultSets = session.sets.map((s) => Math.max(1, s.value));
    save();
    delete drafts[ex.id];
    session = null;
    toast(`${ex.name} eingetragen`);
    location.hash = '#/';
  },
  'del-workout'(ds) {
    const w = db.workouts.find((x) => x.id === ds.wid);
    if (!w || !confirm(`Eintrag vom ${fmtShort(w.date)} löschen?`)) return;
    db.workouts = db.workouts.filter((x) => x.id !== ds.wid);
    save();
    delete drafts[w.exerciseId];
    render();
  },
  'ex-unit'(ds) { const ex = currentEx(); ex.unit = ds.v; save(); render(); },
  'toggle-pause'() { const ex = currentEx(); ex.paused = !ex.paused; save(); render(); },
  'delete-ex'() {
    const ex = currentEx();
    const n = db.workouts.filter((w) => w.exerciseId === ex.id).length;
    if (!confirm(`„${ex.name}“ löschen?${n ? ` Auch ${n} ${plural(n, 'Workout', 'Workouts')} im Verlauf werden gelöscht.` : ''}`)) return;
    db.exercises = db.exercises.filter((x) => x.id !== ex.id);
    db.workouts = db.workouts.filter((w) => w.exerciseId !== ex.id);
    delete drafts[ex.id];
    save();
    toast(`${ex.name} gelöscht`);
    location.hash = '#/';
  },
  'form-unit'(ds) {
    form.unit = ds.v;
    form.value = ds.v === 'secs' ? 30 : 8;
    render();
  },
  create() {
    const name = form.name.trim();
    if (!name) { toast('Bitte einen Namen eingeben'); const el = document.querySelector('[data-input="form-name"]'); if (el) el.focus(); return; }
    const ex = {
      id: uid(), name, unit: form.unit, cadence: form.cadence, cooldown: form.cooldown,
      defaultSets: Array(form.count).fill(form.value), paused: false, note: '', createdAt: Date.now(),
    };
    db.exercises.push(ex);
    save();
    form = null;
    location.hash = '#/ex/' + ex.id;
  },
  async export() {
    const data = JSON.stringify(db, null, 2);
    const name = `dran-backup-${todayStr()}.json`;
    const file = new File([data], name, { type: 'application/json' });
    const done = () => { db.lastExport = new Date().toISOString(); save(); render(); };
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Dran Backup' });
        done();
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    done();
  },
  seed() {
    if (!confirm('Alle aktuellen Daten durch Beispieldaten ersetzen?')) return;
    db = seedData(); save();
    Object.keys(drafts).forEach((k) => delete drafts[k]);
    toast('Beispieldaten geladen');
    location.hash = '#/';
  },
  wipe() {
    if (!confirm('Wirklich alle Übungen und Workouts löschen? Das lässt sich nicht rückgängig machen.')) return;
    db = { version: DATA_VERSION, exercises: [], workouts: [], lastExport: null }; save();
    Object.keys(drafts).forEach((k) => delete drafts[k]);
    toast('Alles gelöscht');
    location.hash = '#/';
  },
};

const inputs = {
  'draft-variant'(v) { getDraft(currentEx()).variant = v; },
  'session-note'(v) { if (session) session.note = v; },
  'ex-name'(v) {
    const ex = currentEx();
    if (!v.trim()) return;
    ex.name = v.trim(); save();
    const t = document.querySelector('[data-title]'); if (t) t.textContent = ex.name;
  },
  'ex-note'(v) { const ex = currentEx(); ex.note = v; save(); },
  'form-name'(v) { form.name = v; },
};

const changes = {
  'session-date'(v) { if (session && /^\d{4}-\d{2}-\d{2}$/.test(v)) session.date = v > todayStr() ? todayStr() : v; },
  async import(_, el) {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!confirm(`Backup mit ${data.exercises.length} Übungen und ${data.workouts.length} Workouts importieren? Die aktuellen Daten werden ersetzt.`)) { el.value = ''; return; }
      db = data; save();
      Object.keys(drafts).forEach((k) => delete drafts[k]);
      toast('Backup importiert');
      location.hash = '#/';
    } catch (e) {
      alert('Die Datei konnte nicht gelesen werden. Ist es ein Dran-Backup (.json)?');
      el.value = '';
    }
  },
};

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
$app.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el.value, el.dataset, el);
});
$app.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changes[el.dataset.change]) changes[el.dataset.change](el.value, el);
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
// Beim Zurückkehren in die App (z. B. am nächsten Tag) neu berechnen
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  render();
});

render();

/* ================= PWA ================= */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker nicht registriert', e));
  });
}
// Browser bitten, die Daten nicht automatisch zu löschen
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist(); }).catch(() => {});
}
