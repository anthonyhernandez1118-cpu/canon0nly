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
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800);
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
function renderHome(){
  const cont = started().slice(0, 12);
  $('#continue').innerHTML = cont.length ? `<p class="sec">Continue Watching</p><div class="rail">${cont.map(s => {
    const n = nextOf(s);
    return `<button data-open="${s.i}">${img(s)}<span>${esc(s.n)}</span><small>${n ? 'Episode ' + esc(n[0]) : 'Caught up'}</small></button>`;
  }).join('')}</div>` : '';
}
$('#home-search').onclick = () => { goTab('search'); setTimeout(() => $('#q').focus(), 50); };

/* ---------- watching ---------- */
function renderWatching(){
  const list = started();
  $('#watching-list').innerHTML = list.length
    ? `<div style="margin-top:16px">${rowList(list, s => { const d = doneSet(s); const w = s.e.filter(e => keep(s, e)); return `${nextLabel(s)} · ${w.filter(e => d.has(e[0])).length} of ${w.length} watched`; })}</div>`
    : `<div class="empty-state"><b>Nothing here yet</b>Mark an episode as watched and the show will appear here so you can pick up where you left off.</div>`;
}

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
function renderShow(){
  const s = cur, el = $('#show');
  if (!s) return;
  const eps = s.e, watch = eps.filter(e => keep(s, e));
  const done = doneSet(s);
  const next = watch.find(e => !done.has(e[0]));
  const gi = Object.keys(GUIDES).indexOf(guide);

  let rows = '', shown = 0, last = -1;
  for (let i = 0; i < eps.length && shown < limit; i++) {
    const e = eps[i]; if (!keep(s, e)) continue;
    if (hideDone && done.has(e[0])) { last = i; continue; }
    const gap = eps.slice(last + 1, i).filter(x => !keep(s, x)).length;
    if (gap) rows += `<li class="gap"><span class="body">${gap} filler episode${gap > 1 ? 's' : ''} skipped</span></li>`;
    rows += `<li class="${done.has(e[0]) ? 'done' : ''}"><input type="checkbox" class="ck" id="w-${esc(e[0])}" data-n="${esc(e[0])}" ${done.has(e[0]) ? 'checked' : ''} aria-label="Watched episode ${esc(e[0])}"><label class="body" for="w-${esc(e[0])}"><span class="n">${esc(e[0])}</span><span class="t">${esc(e[1])}${badge(e) ? `<span class="bdg">${badge(e)}</span>` : ''}</span></label></li>`;
    shown++; last = i;
  }
  const remaining = watch.filter(e => !hideDone || !done.has(e[0])).length - shown;

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
      <span class="eyebrow">Episode ${esc(next[0])}</span>
      <h3>${esc(next[1])}</h3>
      ${badge(next) ? `<div class="badges">${badge(next)}</div>` : ''}
      ${next[2] === 'X' ? `<p class="foot-note" style="padding:0;margin-top:8px">Part canon, part filler. Watch the whole episode.</p>` : ''}
      <div class="acts">
        <button class="btn" id="next-done" data-n="${esc(next[0])}">Mark Watched</button>
        <a class="btn tint" href="${services(s)[0][1]}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Crunchyroll</a>
      </div>
    </div>` : watch.length ? `
    <p class="sec">Up next</p>
    <div class="group next"><h3>All caught up</h3><p class="foot-note" style="padding:0">You have watched every episode in this guide.</p></div>` : ''}

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
load(false).then(boot).catch(() => { $('#continue').innerHTML = '<p class="empty-state">Couldn’t load the episode lists. Check your connection and try again.</p>'; });

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
