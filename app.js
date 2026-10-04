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

/* Zeitwerte: unter 1 min in Sekunden, glatte Minuten als "min", sonst m:ss */
function fmtTime(sec) {
  if (sec < 60) return `${sec} s`;
  if (sec % 60 === 0) return `${sec / 60} min`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`;
}
function fmtClock(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function valText(unit, v) { return unit === 'secs' ? fmtTime(v) : `${v} Wdh`; }
function valHtml(unit, v) { const t = valText(unit, v); const i = t.lastIndexOf(' '); return `${t.slice(0, i)}<small>${t.slice(i + 1)}</small>`; }
/* Schritte wachsen mit: bis 1 min 5 s, bis 5 min 30 s, darüber 5 min */
function stepValue(unit, v, d, min = 1) {
  if (unit !== 'secs') return Math.max(min, v + d);
  if (d > 0) {
    if (v < 60) return Math.floor(v / 5) * 5 + 5;
    if (v < 300) return Math.floor(v / 30) * 30 + 30;
    return Math.floor(v / 300) * 300 + 300;
  }
  if (v > 300) return Math.ceil(v / 300) * 300 - 300;
  if (v > 60) return Math.ceil(v / 30) * 30 - 30;
  return Math.max(5, Math.ceil(v / 5) * 5 - 5);
}

let toastTimer = null;
function toast(msg, undo) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" class="toast__undo">Rückgängig</button>' : ''}`;
  if (undo) el.querySelector('.toast__undo').addEventListener('click', () => { el.remove(); undo(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), undo ? 5000 : 2400);
}

/* ================= Daten ================= */

function seedData() {
  const t = todayStr();
  const ex = (name, unit, cadence, cooldown, defaultSets, extra = {}) =>
    ({ id: uid(), name, unit, cadence, cooldown, defaultSets, paused: false, optional: false, countdown: 3, note: '', createdAt: Date.now(), ...extra });
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
  const bridge = ex('Brücke', 'secs', 3, 1, [20, 20, 20], { optional: true });
  const balance = ex('Balancieren auf dem Balken', 'secs', 3, 1, [60], { optional: true });
  const yin = ex('Yin Yoga', 'secs', 7, 0, [1800], { optional: true, countdown: 0 });

  return {
    version: DATA_VERSION,
    exercises: [klimm, hocke, squat, push, row, hang, bridge, balance, yin, hand],
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
      w(bridge, 3, [20, 20, 20], ['easy', 'easy', 'hard']),
      w(balance, 0, [60], ['easy']),
      w(yin, 2, [1800], ['easy']),
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
    optional: !!x.optional,
    countdown: [0, 3, 5, 10].includes(Number(x.countdown)) ? Number(x.countdown) : 3,
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
  if (!last) return ex.optional ? { kind: 'ok', optional: true, days: null, over: -1e9 } : { kind: 'due', days: null, over: 1e9 };
  const days = Math.max(0, daysBetween(last.date, t));
  if (days < ex.cooldown) return { kind: 'rest', days, remaining: ex.cooldown - days, over: days - ex.cadence };
  // Optionale Übungen werden nie fällig, nur möglich (und stehen dort ganz unten)
  if (ex.optional) return { kind: 'ok', optional: true, days, over: -1e9 };
  if (days >= ex.cadence) return { kind: 'due', days, over: days - ex.cadence };
  return { kind: 'ok', days, over: days - ex.cadence };
}

function rhythmText(ex) {
  const parts = [ex.optional ? 'optional' : ex.cadence === 1 ? 'täglich' : `alle ${ex.cadence} T`];
  if (ex.cooldown > 0) parts.push(`Pause ${ex.cooldown} T`);
  if (ex.unit === 'secs') parts.push('Zeit');
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
  if (st.kind === 'ok') return st.optional ? 'optional' : 'möglich';
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

const check = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

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

const playIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
const bellIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
const bellButton = `<button type="button" class="bell" data-action="bell-test" aria-label="Probe-Klingeln">${bellIcon}</button>`;

/* ================= Klang ================= */

let audioCtx = null;
function getAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    // iOS: Ton soll kurz über andere Audio-Apps gelegt werden
    try { if (navigator.audioSession) navigator.audioSession.type = 'transient'; } catch (e) { /* egal */ }
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
// Muss in einem Tap passieren, sonst bleibt der Ton später stumm (iOS)
function unlockAudio() {
  const ctx = getAudio();
  if (!ctx) return;
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start(0);
}
// Klangschalen-artiger Ton aus mehreren abklingenden Sinus-Teiltönen
function strike(ctx, out, t0, base, dur, vol) {
  [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([ratio, amp], k) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = base * ratio;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol * amp, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (1 - k * 0.18));
    osc.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
  });
}
function bell(kind) {
  const ctx = getAudio();
  if (!ctx) return;
  const comp = ctx.createDynamicsCompressor();
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(comp); comp.connect(ctx.destination);
  const t = ctx.currentTime + 0.03;
  if (kind === 'start') {
    strike(ctx, master, t, 880, 1.4, 0.9);
    if (navigator.vibrate) navigator.vibrate(200);
  } else {
    strike(ctx, master, t, 660, 2.6, 0.9);
    strike(ctx, master, t + 0.7, 660, 2.6, 0.9);
    strike(ctx, master, t + 1.4, 660, 3.2, 0.9);
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }
}

/* ================= Timer ================= */

let timer = null;
let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* nicht unterstützt: dann eben ohne */ }
}

function stopTimer() {
  if (!timer) return;
  clearInterval(timer.iv);
  timer = null;
  keepAwake(false);
}

// Alles aus Zeitstempeln berechnet, damit es auch nach Sperrbildschirm stimmt
function timerState() {
  const now = timer.pausedAt || Date.now();
  const elapsedMs = now - timer.createdAt - timer.pausedTotal - timer.countdown * 1000;
  const targetMs = timer.target * 1000;
  if (elapsedMs < 0) {
    return { phase: 'pre', elapsedMs, big: String(Math.ceil(-elapsedMs / 1000)), sub: 'Gleich geht’s los', pct: 0 };
  }
  if (elapsedMs < targetMs) {
    return { phase: 'run', elapsedMs, big: fmtClock(Math.ceil((targetMs - elapsedMs) / 1000)), sub: `Ziel ${fmtTime(timer.target)}`, pct: (elapsedMs / targetMs) * 100 };
  }
  return { phase: 'over', elapsedMs, big: '+' + fmtClock(Math.floor((elapsedMs - targetMs) / 1000)), sub: `Ziel ${fmtTime(timer.target)} geschafft · läuft weiter`, pct: 100 };
}

function tick() {
  if (!timer) return;
  const st = timerState();
  if (!timer.pausedAt) {
    if (timer.countdown > 0 && !timer.rangStart && st.elapsedMs >= 0) {
      timer.rangStart = true;
      if (st.elapsedMs < 2000) bell('start');
    }
    if (!timer.rangEnd && st.elapsedMs >= timer.target * 1000) {
      timer.rangEnd = true;
      // Nur klingeln, wenn wir pünktlich sind (nicht erst nach dem Entsperren)
      if (st.elapsedMs - timer.target * 1000 < 3000) bell('end');
    }
  }
  const root = document.querySelector('[data-timer]');
  if (!root) return;
  root.className = `timer timer--${st.phase}${timer.pausedAt ? ' timer--paused' : ''}`;
  root.querySelector('[data-tbig]').textContent = st.big;
  root.querySelector('[data-tsub]').textContent = timer.pausedAt ? 'Pausiert' : st.sub;
  root.querySelector('[data-tbar]').style.width = st.pct + '%';
}

function viewTimer(ex) {
  const st = timerState();
  const n = session.sets.length;
  return `
    <div class="timer timer--${st.phase}${timer.pausedAt ? ' timer--paused' : ''}" data-timer>
      <div class="timer__inner">
        <div class="timer__top">
          <button type="button" class="linkbtn" data-action="timer-cancel">${chevron}Abbrechen</button>
          ${bellButton}
        </div>
        <div class="timer__mid">
          <p class="timer__label">${esc(ex.name)} · Satz ${timer.i + 1} von ${n}</p>
          <p class="timer__big" data-tbig>${st.big}</p>
          <p class="timer__sub" data-tsub>${timer.pausedAt ? 'Pausiert' : st.sub}</p>
          <div class="timer__bar"><span data-tbar style="width:${st.pct}%"></span></div>
        </div>
        <div class="timer__actions">
          <button type="button" class="btn btn--primary" data-action="timer-stop">Stopp &amp; übernehmen</button>
          <button type="button" class="btn" data-action="timer-pause">${timer.pausedAt ? 'Weiter' : 'Pause'}</button>
        </div>
      </div>
    </div>`;
}

/* ================= Screens ================= */

function viewList() {
  const t = todayStr();
  const active = db.exercises.filter((x) => !x.paused).map((ex) => ({ ex, st: status(ex, t) }));
  const due = active.filter((a) => a.st.kind === 'due').sort((a, b) => b.st.over - a.st.over);
  const ok = active.filter((a) => a.st.kind === 'ok')
    .sort((a, b) => (b.st.over - a.st.over) || ((b.st.days ?? 1e9) - (a.st.days ?? 1e9)));
  const rest = active.filter((a) => a.st.kind === 'rest').sort((a, b) => a.st.remaining - b.st.remaining);
  const paused = db.exercises.filter((x) => x.paused);

  const row = ({ ex, st }) => {
    const hint = st.kind !== 'rest' && allEasy(lastWorkout(ex.id));
    const sub = st.kind === 'rest' ? `noch ${st.remaining} ${plural(st.remaining, 'Tag', 'Tage')} Pause` : rhythmText(ex);
    const big = st.days === null ? 'neu' : st.days === 0 ? 'heute' : `${st.days} T`;
    const her = st.days === null || st.days === 0 ? '' : 'her';
    const cls = st.optional ? 'opt' : st.kind;
    return `<div class="row row--${cls}">
      <a class="row__link" href="#/ex/${ex.id}">
        <div class="row__main">
          <span class="row__name">${esc(ex.name)}</span>
          <span class="row__sub">${sub}</span>
          ${hint ? '<span class="row__hint">↑ zuletzt alles leicht</span>' : ''}
        </div>
        <div class="row__ago"><span class="row__days">${big}</span>${her ? `<span class="row__her">${her}</span>` : ''}</div>
      </a>
      ${st.kind !== 'rest' ? `<button type="button" class="row__done" data-action="quick" data-id="${ex.id}" aria-label="${esc(ex.name)} wie geplant eintragen">${check}</button>` : ''}
    </div>`;
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
  const lastCard = last ? `
    <section class="card">
      <div class="card__head"><h2>Letztes Mal</h2><span class="small">${fmtShort(last.date)}</span></div>
      <div class="sets-table">
        ${last.sets.map((s, i) => `<div class="sets-table__row"><span>Satz ${i + 1}</span><span>${valText(ex.unit, s.value)}</span><span class="feel feel--${s.feel || 'none'}">${feelText(s.feel)}</span></div>`).join('')}
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
      ${draft.sets.map((v, i) => `<div class="line"><span class="line__label">Satz ${i + 1}</span>${stepper('draft', valHtml(ex.unit, v), `Satz ${i + 1}`, `data-i="${i}"`)}</div>`).join('')}
      <div class="two">
        <button type="button" class="btn btn--dashed" data-action="add-set">+ Satz</button>
        <button type="button" class="btn btn--dashed" data-action="remove-set" ${draft.sets.length <= 1 ? 'disabled' : ''}>− Satz</button>
      </div>
      <label class="field">Variante
        <input type="text" data-input="draft-variant" value="${esc(draft.variant)}" placeholder="z. B. breiter Griff, Schaukelstange" autocomplete="off">
      </label>
    </section>

    <div class="stack" style="gap:8px">
      <button type="button" class="btn btn--primary" data-action="start">Workout starten</button>
      <button type="button" class="btn" data-action="quick">Direkt eintragen, ohne Bewertung</button>
    </div>

    ${history.length ? `
    <section class="stack" style="gap:8px">
      <h2>Verlauf</h2>
      <ul class="hist">
        ${history.map((w) => `<li>
          <span class="hist__date">${fmtShort(w.date)}</span>
          <span class="hist__vals">${w.sets.map((s) => `<span class="v--${s.feel || 'none'}" title="${feelText(s.feel)}">${ex.unit === 'secs' ? fmtTime(s.value) : s.value}</span>`).join('')}${w.variant ? `<span class="small">${esc(w.variant)}</span>` : ''}</span>
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
      <div class="line"><span class="line__label">Optional</span>${seg('ex-optional', ex.optional ? 'yes' : 'no', [['no', 'Nein'], ['yes', 'Ja']])}</div>
      ${ex.optional ? '<p class="small" style="margin-top:-6px">Wird nie fällig. Nach der Pause steht sie hellblau unten bei „Möglich“.</p>' : `<div class="line"><span class="line__label">Mindestens alle</span>${stepper('cadence', `${ex.cadence}<small>${plural(ex.cadence, 'Tag', 'Tage')}</small>`, 'Rhythmus')}</div>`}
      <div class="line"><span class="line__label">Pause mindestens</span>${stepper('cooldown', `${ex.cooldown}<small>${plural(ex.cooldown, 'Tag', 'Tage')}</small>`, 'Pause')}</div>
      <div class="line"><span class="line__label">Zählen in</span>${seg('ex-unit', ex.unit, [['reps', 'Wdh'], ['secs', 'Zeit']])}</div>
      ${ex.unit === 'secs' ? `<div class="line"><span class="line__label">Timer-Vorlauf</span>${seg('ex-countdown', String(ex.countdown), [['0', 'Aus'], ['3', '3 s'], ['5', '5 s'], ['10', '10 s']])}</div>` : ''}
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
  if (timer && timer.exerciseId === id) return viewTimer(ex);
  const timed = ex.unit === 'secs';
  return `
    <a class="back" href="#/ex/${ex.id}">${chevron}Abbrechen</a>
    <header>
      <div class="titlebar"><h1>${esc(ex.name)}</h1>${timed ? bellButton : ''}</div>
      ${session.variant ? `<p class="meta">${esc(session.variant)}</p>` : ''}
    </header>
    <div class="stack">
      ${session.sets.map((s, i) => `
        <div class="wcard">
          <div class="line"><span class="line__label">Satz ${i + 1}</span>${stepper('session', valHtml(ex.unit, s.value), `Satz ${i + 1}`, `data-i="${i}"`)}</div>
          ${timed ? `<button type="button" class="btn btn--timer" data-action="timer-start" data-i="${i}">${playIcon}Timer ${fmtClock(s.value)}</button>` : ''}
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
  if (!form) form = { name: '', unit: 'reps', count: 3, value: 8, cadence: 3, cooldown: 1, optional: false };
  return `
    <a class="back" href="#/">${chevron}Heute</a>
    <h1>Neue Übung</h1>
    <section class="stack">
      <label class="field">Name
        <input type="text" data-input="form-name" value="${esc(form.name)}" placeholder="z. B. Klimmzüge" autocomplete="off">
      </label>
      <div class="line"><span class="line__label">Zählen in</span>${seg('form-unit', form.unit, [['reps', 'Wdh'], ['secs', 'Zeit']])}</div>
      <div class="line"><span class="line__label">Sätze</span>${stepper('form-count', form.count, 'Sätze')}</div>
      <div class="line"><span class="line__label">Pro Satz</span>${stepper('form-value', valHtml(form.unit, form.value), 'Wert pro Satz')}</div>
      <div class="line"><span class="line__label">Optional</span>${seg('form-optional', form.optional ? 'yes' : 'no', [['no', 'Nein'], ['yes', 'Ja']])}</div>
      ${form.optional ? '' : `<div class="line"><span class="line__label">Mindestens alle</span>${stepper('form-cadence', `${form.cadence}<small>${plural(form.cadence, 'Tag', 'Tage')}</small>`, 'Rhythmus')}</div>`}
      <div class="line"><span class="line__label">Pause mindestens</span>${stepper('form-cooldown', `${form.cooldown}<small>${plural(form.cooldown, 'Tag', 'Tage')}</small>`, 'Pause')}</div>
      <p class="small">„Mindestens alle“: ab dann ist die Übung grün (fällig). „Pause“: so lange ist sie gesperrt. Dazwischen ist sie orange (möglich). Optionale Übungen werden nie fällig, sie stehen nach der Pause hellblau unten bei „Möglich“.</p>
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
      case 'draft': { const dr = getDraft(ex); dr.sets[i] = stepValue(ex.unit, dr.sets[i], d, 1); break; }
      case 'session': { const s = session.sets[i]; s.value = stepValue(ex.unit, s.value, d, 0); break; }
      case 'cadence': ex.cadence = Math.max(1, ex.cadence + d); save(); break;
      case 'cooldown': ex.cooldown = Math.max(0, ex.cooldown + d); save(); break;
      case 'form-count': form.count = Math.max(1, Math.min(10, form.count + d)); break;
      case 'form-value': form.value = stepValue(form.unit, form.value, d, 1); break;
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
    stopTimer();
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
  quick(ds) {
    const ex = ds.id ? getEx(ds.id) : currentEx();
    if (!ex) return;
    const dr = getDraft(ex);
    const w = {
      id: uid(), exerciseId: ex.id, date: todayStr(), variant: dr.variant.trim(), note: '',
      createdAt: Date.now(), sets: dr.sets.map((v) => ({ value: v, feel: null })),
    };
    db.workouts.push(w);
    save();
    delete drafts[ex.id];
    render();
    toast(`${ex.name} eingetragen`, () => {
      db.workouts = db.workouts.filter((x) => x.id !== w.id);
      save();
      delete drafts[ex.id];
      render();
    });
  },
  'ex-optional'(ds) { const ex = currentEx(); ex.optional = ds.v === 'yes'; save(); render(); },
  'form-optional'(ds) { form.optional = ds.v === 'yes'; render(); },
  'ex-countdown'(ds) { const ex = currentEx(); ex.countdown = Number(ds.v); save(); render(); },
  'bell-test'() {
    bell('end');
    toast('Nichts gehört? Lautstärke hoch, Stummschalter prüfen.');
  },
  'timer-start'(ds) {
    const ex = currentEx();
    const i = Number(ds.i);
    unlockAudio();
    timer = {
      exerciseId: ex.id, i, target: Math.max(1, session.sets[i].value), countdown: ex.countdown || 0,
      createdAt: Date.now(), pausedAt: null, pausedTotal: 0, rangStart: false, rangEnd: false, iv: null,
    };
    timer.iv = setInterval(tick, 200);
    keepAwake(true);
    render();
    window.scrollTo(0, 0);
  },
  'timer-pause'() {
    if (!timer) return;
    const now = Date.now();
    if (timer.pausedAt) { timer.pausedTotal += now - timer.pausedAt; timer.pausedAt = null; keepAwake(true); }
    else timer.pausedAt = now;
    render();
  },
  'timer-stop'() {
    if (!timer) return;
    const { i, elapsedMs } = { i: timer.i, elapsedMs: timerState().elapsedMs };
    stopTimer();
    if (elapsedMs > 0 && session) {
      const sec = Math.max(1, Math.round(elapsedMs / 1000));
      session.sets[i].value = sec;
      toast(`Satz ${i + 1}: ${fmtTime(sec)}`);
    }
    render();
  },
  'timer-cancel'() { stopTimer(); render(); },
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
      defaultSets: Array(form.count).fill(form.value), paused: false, optional: form.optional, countdown: 3, note: '', createdAt: Date.now(),
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
  if (timer && !timer.pausedAt) keepAwake(true);
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
  // Neue Version aktiv: auf der Startliste gleich neu laden, sonst beim nächsten Öffnen
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    const a = document.activeElement;
    if (route().name === 'list' && !session && !(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'))) location.reload();
  });
}
// Browser bitten, die Daten nicht automatisch zu löschen
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist(); }).catch(() => {});
}
