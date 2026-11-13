let DATA = [], UPDATED = '';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const safe = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '_');
const poster = s => `posters/${safe(s.s)}.webp`;
const img = s => `<img src="${poster(s)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const store = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch{return d} },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
};
const CHEV = '<svg class="chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m1.5 1.5 5 5.5-5 5.5"/></svg>';

const GUIDES = {
  core:   {label:'Core Story',   note:'The full main story, with every filler episode cut.'},
  purist: {label:'Manga Purist', note:'Only episodes adapted straight from the manga.'},
};
let guide = store.get('guide', 'core');
if (!GUIDES[guide]) guide = 'core';
const keep = (s, e) => e[2] === 'M' || (guide === 'core' && (e[2] === 'A' || e[2] === 'X'));

let cur = null, limit = 120, hideDone = store.get('hideDone', false);
let tab = 'home', depth = 0;
const scrollMem = {};

/* ---------- data helpers ---------- */
function prep(d){
  DATA = d.shows; UPDATED = d.updated;
  DATA.forEach((s, i) => { s.i = i; s.k = norm(s.n + ' ' + s.s.replace(/-/g,' ')); s.f = s.e.filter(e => e[2]==='F').length; });
}
const doneSet = s => new Set(store.get('w:' + s.s, []));
const nextOf = s => { const d = doneSet(s); return s.e.find(e => keep(s, e) && !d.has(e[0])); };
function started(){
  const act = store.get('activity', {});
  return DATA.filter(s => doneSet(s).size > 0).sort((a, b) => (act[b.s] || 0) - (act[a.s] || 0));
}
function search(q){
  const n = norm(q); if (!n) return [];
  const words = n.split(' ');
  return DATA.map(s => {
    if (!words.every(w => s.k.includes(w))) return null;
    const sc = s.k.startsWith(n) ? 0 : (' '+s.k).includes(' '+n) ? 1 : 2;
    return [sc, -s.e.length, s];
  }).filter(Boolean).sort((a,b) => a[0]-b[0] || a[1]-b[1]).slice(0, 40).map(x => x[2]);
}
const cleanName = s => s.n.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
const services = s => {
  const qn = encodeURIComponent(cleanName(s));
  return [
    ['Crunchyroll', `https://www.crunchyroll.com/search?q=${qn}`],
    ['Netflix', `https://www.netflix.com/search?q=${qn}`],
    ['Hulu', `https://www.hulu.com/search?q=${qn}`],
  ];
};
const badge = e => e[2] === 'X' ? `<span class="badge X">Mixed</span>` : e[2] === 'A' ? `<span class="badge A">Anime canon</span>` : '';
let toastT;
function toast(msg, action){
  const t = $('#toast');
  t.innerHTML = esc(msg) + (action ? ` <button class="toast-act">${esc(action.label)}</button>` : '');
  t.classList.toggle('has-act', !!action); t.classList.add('show');
  if (action) t.querySelector('.toast-act').onclick = () => { t.classList.remove('show'); action.fn(); };
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 5000 : 1800);
}
// Remove a show from Continue Watching / Watching by clearing its progress, with Undo.
function removeShow(s){
  const saved = store.get('w:' + s.s, []), act = store.get('activity', {}), when = act[s.s];
  store.set('w:' + s.s, []); delete act[s.s]; store.set('activity', act);
  refreshLists();
  toast(`Removed ${s.n}`, {label: 'Undo', fn: () => {
    store.set('w:' + s.s, saved);
    const a = store.get('activity', {}); if (when) a[s.s] = when; store.set('activity', a);
    refreshLists();
  }});
}
function refreshLists(){
  if (!$('#v-home').hidden) renderHome();
  if (!$('#v-watching').hidden) renderWatching();
}
function ranges(s){
  const out = []; let a = null, b = null;
  for (const e of s.e) {
    if (keep(s, e)) { if (a === null) a = e[0]; b = e[0]; }
    else if (a !== null) { out.push(a === b ? a : a + '–' + b); a = null; }
  }
  if (a !== null) out.push(a === b ? a : a + '–' + b);
  return out;
}
const rowList = (list, subFn) => `<div class="group"><ul class="rows">${list.map(s =>
  `<li><button data-open="${s.i}">${img(s)}<span class="txt"><span class="tt"><span class="nm">${esc(s.n)}</span><span class="sub">${esc(subFn(s))}</span></span>${CHEV}</span></button></li>`).join('')}</ul></div>`;
const nextLabel = s => { const n = nextOf(s); return n ? `Next: Episode ${n[0]}` : 'All caught up'; };

/* ---------- navigation ---------- */
const hashFor = s => /^[a-z0-9-]+$/.test(s.s) && !['home','watching','search'].includes(s.s) ? s.s : 's-' + s.i;
function showFromHash(h){
  if (/^s-\d+$/.test(h)) return DATA[+h.slice(2)] || null;
  return DATA.find(x => x.s === h) || null;
}
function setView(name){
  document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'v-' + name);
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  $('#back').hidden = name !== 'show';
  updateNavAct(name);
  $('#ttl').textContent = name === 'show' ? (cur ? cur.n : '') : ({home:'Canon Only', watching:'Watching', search:'Search'})[name];
  onScroll();
}
function route(){
  const h = decodeURIComponent(location.hash.slice(1));
  const s = h && showFromHash(h);
  const prev = document.querySelector('.view:not([hidden])')?.id;
  if (prev && prev !== 'v-show') scrollMem[prev] = scrollY;
  if (s) {
    if (cur !== s) limit = 120;
    cur = s; renderShow(); setView('show'); scrollTo(0, 0);
    return;
  }
  tab = ['watching','search'].includes(h) ? h : 'home';
  if (tab === 'home') renderHome();
  if (tab === 'watching') renderWatching();
  if (tab === 'search') renderResults();
  setView(tab);
  scrollTo(0, scrollMem['v-' + tab] || 0);
}
function openShow(s){ depth++; location.hash = hashFor(s); }
function goTab(t){
  const vis = document.querySelector('.view:not([hidden])')?.id;
  if (t === tab && vis === 'v-' + t) { scrollTo({top: 0, behavior: 'smooth'}); if (t === 'search') $('#q').focus(); return; }
  depth = 0;
  const target = t === 'home' ? '' : t;
  if (location.hash.slice(1) === target) route();
  else if (target) location.hash = target;
  else history.pushState(null, '', location.pathname + location.search), route();
}
addEventListener('hashchange', route);
$('#back').onclick = () => { if (depth > 0) { depth--; history.back(); } else goTab(tab); };
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => goTab(b.dataset.tab));
document.addEventListener('click', e => {
  const r = e.target.closest('[data-remove]');
  if (r) { e.preventDefault(); e.stopPropagation(); removeShow(DATA[+r.dataset.remove]); return; }
  const open = e.target.closest('li.sw.open');
  if (open && !editWatching) { open.classList.remove('open'); return; }
  const b = e.target.closest('[data-open]');
  if (b) openShow(DATA[+b.dataset.open]);
});
function onScroll(){
  $('#nav').classList.toggle('scrolled', scrollY > 4);
  const showing = !$('#v-show').hidden;
  $('#nav').classList.toggle('compact', showing ? scrollY > 120 : scrollY > 40);
}
addEventListener('scroll', onScroll, {passive:true});

/* ---------- home ---------- */
let editCont = false;
function renderHome(){
  const cont = started().slice(0, 12);
  if (!cont.length) editCont = false;
  $('#continue').innerHTML = cont.length ? `<p class="sec">Continue Watching <button class="link" id="cw-edit">${editCont ? 'Done' : 'Edit'}</button></p><div class="rail${editCont ? ' editing' : ''}">${cont.map(s => {
    const n = nextOf(s);
    return `<button data-open="${s.i}">${img(s)}${editCont ? `<span class="x" data-remove="${s.i}" role="button" aria-label="Remove ${esc(s.n)}">×</span>` : ''}<span>${esc(s.n)}</span><small>${n ? 'Episode ' + esc(n[0]) : 'Caught up'}</small></button>`;
  }).join('')}</div>` : '';
  const ce = $('#cw-edit'); if (ce) ce.onclick = () => { editCont = !editCont; renderHome(); };
}
$('#home-search').onclick = () => { goTab('search'); setTimeout(() => $('#q').focus(), 50); };

/* ---------- watching ---------- */
let editWatching = false;
function updateNavAct(name){
  const b = $('#nav-act');
  const show = name === 'watching' && started().length > 0;
  if (!show) editWatching = false;
  b.hidden = !show; b.textContent = editWatching ? 'Done' : 'Edit';
}
function renderWatching(){
  const list = started();
  if (!list.length) editWatching = false;
  $('#watching-list').innerHTML = list.length
    ? `<div style="margin-top:16px"><div class="group"><ul class="rows watching${editWatching ? ' editing' : ''}">${list.map(s => {
        const d = doneSet(s), w = s.e.filter(e => keep(s, e));
        const sub = `${nextLabel(s)} · ${w.filter(e => d.has(e[0])).length} of ${w.length} watched`;
        return `<li class="sw${editWatching ? ' open' : ''}"><button data-open="${s.i}">${img(s)}<span class="txt"><span class="tt"><span class="nm">${esc(s.n)}</span><span class="sub">${esc(sub)}</span></span>${CHEV}</span></button><button class="del" data-remove="${s.i}" aria-label="Remove ${esc(s.n)}">Remove</button></li>`;
      }).join('')}</ul></div></div>
      <p class="foot-note">Swipe left on a show, or tap Edit, to remove it. Removing a show clears its watched episodes.</p>`
    : `<div class="empty-state"><b>Nothing here yet</b>Mark an episode as watched and the show will appear here so you can pick up where you left off.</div>`;
  updateNavAct('watching');
}
$('#nav-act').onclick = () => { editWatching = !editWatching; renderWatching(); };
// swipe left on a Watching row to reveal Remove
let sw = null;
$('#watching-list').addEventListener('touchstart', e => {
  const li = e.target.closest('li.sw'); if (!li || editWatching) return;
  sw = {li, x: e.touches[0].clientX, y: e.touches[0].clientY, dir: 0};
}, {passive: true});
$('#watching-list').addEventListener('touchmove', e => {
  if (!sw) return;
  const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
  if (!sw.dir) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) sw.dir = 1; else if (Math.abs(dy) > 10) { sw = null; return; } }
  if (sw.dir) {
    if (dx < -30) { document.querySelectorAll('li.sw.open').forEach(o => o !== sw.li && o.classList.remove('open')); sw.li.classList.add('open'); }
    if (dx > 30) sw.li.classList.remove('open');
  }
}, {passive: true});
$('#watching-list').addEventListener('touchend', () => { sw = null; }, {passive: true});

/* ---------- search ---------- */
const q = $('#q');
function renderResults(){
  const v = q.value.trim(), el = $('#results');
  if (v) {
    const hits = search(v);
    el.innerHTML = hits.length
      ? `<div style="margin-top:16px">${rowList(hits, s => `${s.e.length} episodes · ${s.f} filler`)}</div>`
      : `<div class="empty-state"><b>No results</b>Nothing matches “${esc(v)}”. Try the English or Japanese title.</div>`;
    return;
  }
  if (el.dataset.az) return;
  const groups = {};
  [...DATA].sort((a, b) => a.n.localeCompare(b.n)).forEach(s => {
    const L = /[a-z]/i.test(s.n[0]) ? s.n[0].toUpperCase() : '#';
    (groups[L] = groups[L] || []).push(s);
  });
  el.innerHTML = Object.keys(groups).sort((a, b) => a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b))
    .map(L => `<p class="letter">${L}</p>${rowList(groups[L], s => `${s.e.length} episodes · ${s.f} filler`)}`).join('');
  el.dataset.az = '1';
}
q.addEventListener('input', () => { delete $('#results').dataset.az; renderResults(); });
q.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('#results [data-open]'); if (b && q.value.trim()) { q.blur(); b.click(); } } });

/* ---------- show detail ---------- */
// Extra data (story arcs, manga chapters) for shows that have it, loaded on demand.
const EXTRA = {}; let EXTRA_INDEX = [];
async function loadExtra(s){
  if (!EXTRA_INDEX.includes(s.s) || EXTRA[s.s] !== undefined) return;
  EXTRA[s.s] = null;
  try { const r = await fetch(`extras/${s.s}.json`); if (r.ok) EXTRA[s.s] = await r.json(); } catch {}
  if (cur === s && !$('#v-show').hidden) { const y = scrollY; renderShow(); scrollTo(0, y); }
}
let pace = store.get('pace', 3);
const chText = c => c ? (c[0] === c[1] ? `Ch. ${c[0]}` : `Ch. ${c[0]}${c[0] < 0 || c[1] < 0 ? ' to ' : '–'}${c[1]}`) : '';
function arcChapters(x, a){
  let lo = Infinity, hi = -Infinity;
  for (let n = a.start; n <= a.end; n++) { const c = x.ch[n]; if (c) { lo = Math.min(lo, c[0]); hi = Math.max(hi, c[1]); } }
  return lo === Infinity ? null : [lo, hi];
}
function fmtDuration(min){
  const h = Math.round(min / 60);
  return h < 1 ? `${min} minutes` : h === 1 ? 'about 1 hour' : `about ${h.toLocaleString()} hours`;
}

function renderShow(){
  const s = cur, el = $('#show');
  if (!s) return;
  loadExtra(s);
  const x = EXTRA[s.s] || null;
  const eps = s.e, watch = eps.filter(e => keep(s, e));
  const done = doneSet(s);
  const next = watch.find(e => !done.has(e[0]));
  const gi = Object.keys(GUIDES).indexOf(guide);
  const arcOf = n => x ? x.arcs.find(a => n >= a.start && n <= a.end) : null;

  // episode list, with arc headings and named filler gaps
  let rows = '', shown = 0, last = -1, lastArc = null;
  for (let i = 0; i < eps.length && shown < limit; i++) {
    const e = eps[i]; if (!keep(s, e)) continue;
    if (hideDone && done.has(e[0])) { last = i; continue; }
    const skipped = eps.slice(last + 1, i).filter(z => !keep(s, z));
    if (skipped.length) {
      const names = x ? [...new Set(skipped.map(z => arcOf(+z[0])).filter(a => a && a.filler).map(a => a.name))] : [];
      const lbl = names.length === 1 ? `${names[0]} arc skipped · ${skipped.length} episode${skipped.length > 1 ? 's' : ''}` : `${skipped.length} filler episode${skipped.length > 1 ? 's' : ''} skipped`;
      rows += `<li class="gap"><span class="body">${esc(lbl)}</span></li>`;
    }
    const a = arcOf(+e[0]);
    if (a && a !== lastArc && !a.filler) {
      rows += `<li class="arc" id="arc-${a.start}"><span class="body">${esc(a.name)}</span></li>`;
      lastArc = a;
    }
    const c = x && x.ch[e[0]];
    const meta = [badge(e), c ? `<span class="chap">${chText(c)}</span>` : ''].filter(Boolean).join('');
    rows += `<li class="${done.has(e[0]) ? 'done' : ''}"><input type="checkbox" class="ck" id="w-${esc(e[0])}" data-n="${esc(e[0])}" ${done.has(e[0]) ? 'checked' : ''} aria-label="Watched episode ${esc(e[0])}"><label class="body" for="w-${esc(e[0])}"><span class="n">${esc(e[0])}</span><span class="t">${esc(e[1])}${meta ? `<span class="bdg">${meta}</span>` : ''}</span></label></li>`;
    shown++; last = i;
  }
  const remaining = watch.filter(e => !hideDone || !done.has(e[0])).length - shown;

  // time to finish
  const left = watch.filter(e => !done.has(e[0])).length;
  const days = Math.ceil(left / pace);
  const finish = new Date(Date.now() + days * 864e5).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: days > 300 ? 'numeric' : undefined});
  const paceHtml = left ? `
    <p class="sec">Your pace</p>
    <div class="group">
      <div class="toggle-row"><span>Episodes a day</span>
        <span class="stepper"><button id="pace-dn" aria-label="Fewer episodes a day">−</button><b id="pace-v">${pace}</b><button id="pace-up" aria-label="More episodes a day">+</button></span>
      </div>
    </div>
    <p class="foot-note">${left === 1 ? 'One episode left' : `${left.toLocaleString()} episodes left`}, ${fmtDuration(left * 23)} of watching. At ${pace} a day you’ll finish ${days <= 1 ? 'today' : `in ${days.toLocaleString()} days, around ${finish}`}.</p>` : '';

  // manga reader jump-in
  const hasCh = x && Object.keys(x.ch).length;
  const mangaHtml = hasCh ? `
    <p class="sec">Read the manga?</p>
    <div class="group">
      <form class="toggle-row" id="manga-form"><label for="manga-ch">I’ve read up to chapter</label><input id="manga-ch" type="number" inputmode="numeric" min="1" placeholder="0" class="numin"></form>
      <div id="manga-out"></div>
    </div>` : '';

  // arcs list
  const arcList = x ? x.arcs.filter(a => !a.filler) : [];
  const showAllArcs = store.get('allArcs', false);
  const arcsHtml = arcList.length ? `
    <p class="sec">Story arcs</p>
    <div class="group"><ul class="rows arcs">${(showAllArcs ? arcList : arcList.slice(0, 6)).map(a => {
      const kept = eps.filter(e => +e[0] >= a.start && +e[0] <= a.end && keep(s, e));
      const fin = kept.length && kept.every(e => done.has(e[0]));
      const c = arcChapters(x, a);
      return `<li><button data-arc="${a.start}"><span class="txt"><span class="tt"><span class="nm">${esc(a.name)}</span><span class="sub">Episodes ${a.start === a.end ? a.start : a.start + '–' + a.end}${c ? ' · ' + chText(c).replace('Ch.', c[0] === c[1] ? 'Chapter' : 'Chapters') : ''}</span></span>${fin ? '<span class="tick" aria-label="Watched">✓</span>' : ''}${CHEV}</span></button></li>`;
    }).join('')}</ul>
    ${arcList.length > 6 ? `<button class="more" id="arcs-more">${showAllArcs ? 'Show fewer' : `Show all ${arcList.length} arcs`}</button>` : ''}</div>
    <p class="foot-note">Filler arcs are skipped and not listed. Arc and chapter info from ${esc(x.source.replace(/, CC BY-SA$/, ''))}, shared under CC BY-SA.</p>` : '';

  el.innerHTML = `
    <div class="show-card">
      <img src="${poster(s)}" alt="" onerror="this.style.visibility='hidden'">
      <div class="info">
        <h2>${esc(s.n)}</h2>
        <span class="sub">${eps.length} episodes · ${s.f} filler</span>
        <div class="find">${services(s).map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>
      </div>
    </div>

    <div class="seg" role="group" aria-label="Watch guide">
      <span class="thumb" style="transform:translateX(${gi * 100}%)"></span>
      ${Object.entries(GUIDES).map(([k, g]) => `<button data-g="${k}" aria-pressed="${k === guide}">${g.label}</button>`).join('')}
    </div>
    <p class="guide-note">${watch.length} of ${eps.length} episodes. ${GUIDES[guide].note}</p>

    ${next ? `
    <p class="sec">Up next</p>
    <div class="group next">
      <span class="eyebrow">Episode ${esc(next[0])}${arcOf(+next[0]) ? ' · ' + esc(arcOf(+next[0]).name.replace(' (continued)', '')) : ''}</span>
      <h3>${esc(next[1])}</h3>
      ${badge(next) || (x && x.ch[next[0]]) ? `<div class="badges">${badge(next)}${x && x.ch[next[0]] ? `<span class="chap">${chText(x.ch[next[0]])}</span>` : ''}</div>` : ''}
      ${next[2] === 'X' ? `<p class="foot-note" style="padding:0;margin-top:8px">Part canon, part filler. Watch the whole episode.</p>` : ''}
      <div class="acts">
        <button class="btn" id="next-done" data-n="${esc(next[0])}">Mark Watched</button>
        <a class="btn tint" href="${services(s)[0][1]}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Crunchyroll</a>
      </div>
    </div>` : watch.length ? `
    <p class="sec">Up next</p>
    <div class="group next"><h3>All caught up</h3><p class="foot-note" style="padding:0">You have watched every episode in this guide.</p></div>` : ''}

    ${paceHtml}
    ${mangaHtml}
    ${arcsHtml}

    <p class="sec">Episodes <button class="link" id="copy">Copy list</button></p>
    <div class="group">
      <div class="toggle-row"><label for="hide">Hide watched</label><input type="checkbox" class="switch" id="hide" ${hideDone ? 'checked' : ''}></div>
    </div>
    <div class="group" style="margin-top:12px">
      ${rows ? `<ol class="eps">${rows}</ol>` : `<div class="empty">${hideDone ? 'You have watched everything in this guide.' : 'No episodes in this guide.'}</div>`}
      ${remaining > 0 ? `<button class="more" id="more">Show ${Math.min(remaining, 300)} more</button>` : ''}
    </div>`;

  const rerender = () => { const y = scrollY; renderShow(); scrollTo(0, y); };
  el.querySelectorAll('.seg button').forEach(b => b.onclick = () => { guide = b.dataset.g; store.set('guide', guide); limit = 120; rerender(); });
  $('#copy').onclick = () => {
    const txt = `${s.n} (${GUIDES[guide].label}): ${ranges(s).join(', ')}`;
    const fallback = () => toast('Copy is not available here');
    try { navigator.clipboard.writeText(txt).then(() => toast('Episode list copied'), fallback); } catch { fallback(); }
  };
  $('#hide').onchange = e => { hideDone = e.target.checked; store.set('hideDone', hideDone); rerender(); };
  const more = $('#more'); if (more) more.onclick = () => { limit += 300; rerender(); };
  const markMany = list => {
    const set = doneSet(s); list.forEach(n => set.add(n));
    store.set('w:' + s.s, [...set]);
    const act = store.get('activity', {}); act[s.s] = Date.now(); store.set('activity', act);
  };
  const setWatched = (n, on) => {
    const set = doneSet(s);
    on ? set.add(n) : set.delete(n);
    store.set('w:' + s.s, [...set]);
    const act = store.get('activity', {}); act[s.s] = Date.now(); store.set('activity', act);
    rerender();
  };
  el.querySelectorAll('ol.eps input').forEach(c => c.onchange = () => setWatched(c.dataset.n, c.checked));
  const nd = $('#next-done');
  if (nd) nd.onclick = () => { setWatched(nd.dataset.n, true); toast(`Episode ${nd.dataset.n} watched`); };

  // pace stepper
  const setPace = v => { pace = Math.min(20, Math.max(1, v)); store.set('pace', pace); rerender(); };
  const pu = $('#pace-up'), pd = $('#pace-dn');
  if (pu) { pu.onclick = () => setPace(pace + 1); pd.onclick = () => setPace(pace - 1); }

  // arcs: tap to jump to that arc in the episode list
  el.querySelectorAll('[data-arc]').forEach(b => b.onclick = () => {
    const start = +b.dataset.arc;
    const idx = watch.findIndex(e => +e[0] >= start);
    if (idx >= limit) { limit = idx + 60; renderShow(); }
    const target = document.getElementById('arc-' + start) || document.getElementById('w-' + (watch[idx] || [])[0]);
    if (target) scrollTo({top: target.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth'});
  });
  const am = $('#arcs-more'); if (am) am.onclick = () => { store.set('allArcs', !store.get('allArcs', false)); rerender(); };

  // manga jump-in
  const mf = $('#manga-form');
  if (mf) mf.onsubmit = ev => {
    ev.preventDefault();
    const read = parseInt($('#manga-ch').value, 10), out = $('#manga-out');
    if (!read || read < 1) { out.innerHTML = `<p class="manga-res">Enter the last chapter you read.</p>`; return; }
    const start = watch.find(e => x.ch[e[0]] && x.ch[e[0]][1] > read);
    if (!start) { out.innerHTML = `<p class="manga-res">You’re ahead of the anime. Every canon episode so far covers chapters you’ve read.</p>`; return; }
    const before = watch.filter(e => +e[0] < +start[0]).map(e => e[0]);
    out.innerHTML = `<p class="manga-res">Start at <b>Episode ${esc(start[0])}</b>, which picks up at ${chText(x.ch[start[0]])}.</p>
      ${before.length ? `<div class="acts" style="padding:0 16px 14px;margin:0"><button class="btn tint" id="manga-mark">Mark ${before.length.toLocaleString()} earlier episodes watched</button></div>` : ''}`;
    const mm = $('#manga-mark');
    if (mm) mm.onclick = () => {
      if (!mm.dataset.sure) { mm.dataset.sure = '1'; mm.textContent = 'Tap again to confirm'; return; }
      markMany(before); toast(`${before.length.toLocaleString()} episodes marked watched`); rerender();
    };
  };
}

/* ---------- boot ---------- */
const POP = ['one-piece','naruto-shippuden','jujutsu-kaisen','bleach','demon-slayer-kimetsu-no-yaiba','naruto','my-hero-academia','dragon-ball-z','hunter-x-hunter','black-clover','fairy-tail','boruto-naruto-next-generations','dragon-ball-super','fullmetal-alchemist-brotherhood','detective-conan'];
function fmtDate(iso){ try { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}); } catch { return iso; } }
function boot(d){
  prep(d);
  $('#home-search').textContent = `Search ${DATA.length} anime`;
  $('#updated').textContent = UPDATED ? `Updated ${fmtDate(UPDATED)}.` : '';
  $('#quick').innerHTML = POP.map(sl => DATA.find(s => s.s === sl)).filter(Boolean)
    .map(s => `<button data-open="${s.i}">${img(s)}<span>${esc(s.n)}</span></button>`).join('');
  delete $('#results').dataset.az;
  if (cur) cur = DATA.find(s => s.s === cur.s) || null;
  route();
}
async function load(fresh){
  const r = await fetch('data.json', fresh ? {cache:'reload'} : {});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const extrasReady = fetch('extras/index.json').then(r => r.ok ? r.json() : []).then(l => { EXTRA_INDEX = l; }).catch(() => {});
Promise.all([load(false), extrasReady]).then(([d]) => boot(d)).catch(() => { $('#continue').innerHTML = '<p class="empty-state">Couldn’t load the episode lists. Check your connection and try again.</p>'; });

// Installed app only (not inside Claude): offline support and a manual refresh.
if (!window.claude && document.querySelector('link[rel="manifest"]')) {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  $('#refresh-area').innerHTML = '<button id="refresh" style="border:0;background:none;color:var(--blue);font-size:15px;cursor:pointer">Check for new episodes</button>';
  const btn = $('#refresh');
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      const before = UPDATED, d = await load(true);
      boot(d);
      toast(d.updated === before ? 'Already up to date' : 'Episode lists updated');
    } catch { toast('You’re offline. Try again later.'); }
    btn.disabled = false; btn.textContent = 'Check for new episodes';
  };
}
