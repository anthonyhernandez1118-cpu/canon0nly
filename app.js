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
const TYPE = {M:'Manga canon', A:'Anime canon', X:'Mixed', F:'Filler'};

const GUIDES = {
  core:   {label:'Core Story',   note:'The full main story, with every filler episode cut.'},
  purist: {label:'Manga Purist', note:'Only episodes adapted straight from the manga.'},
};
let guide = store.get('guide', 'core');
if (!GUIDES[guide]) guide = 'core';
const keep = (s, e) => e[2] === 'M' || (guide === 'core' && (e[2] === 'A' || e[2] === 'X'));

let cur = null, limit = 120, hideDone = store.get('hideDone', false);

/* ---------- search ---------- */
function prep(d){
  DATA = d.shows; UPDATED = d.updated;
  DATA.forEach(s => { s.k = norm(s.n + ' ' + s.s.replace(/-/g,' ')); s.f = s.e.filter(e => e[2]==='F').length; });
}
function search(q){
  const n = norm(q); if (!n) return [];
  const words = n.split(' ');
  return DATA.map(s => {
    if (!words.every(w => s.k.includes(w))) return null;
    const sc = s.k.startsWith(n) ? 0 : (' '+s.k).includes(' '+n) ? 1 : 2;
    return [sc, -s.e.length, s];
  }).filter(Boolean).sort((a,b) => a[0]-b[0] || a[1]-b[1]).slice(0, 8).map(x => x[2]);
}
const q = $('#q'), sugg = $('#sugg'); let hits = [], sel = 0;
function drawSugg(){
  if (!q.value.trim()) { sugg.hidden = true; return; }
  hits = search(q.value); sel = 0;
  sugg.innerHTML = hits.length
    ? hits.map((s,i) => `<button type="button" role="option" data-i="${i}" aria-selected="${i===sel}">${img(s)}<span class="txt"><span class="nm">${esc(s.n)}</span><span class="sub">${s.e.length} episodes · ${s.f} filler</span></span></button>`).join('')
    : `<div class="none">No results for “${esc(q.value)}”. Try the English or Japanese title.</div>`;
  sugg.hidden = false;
}
const mark = () => sugg.querySelectorAll('button').forEach((b,i) => b.setAttribute('aria-selected', i===sel));
q.addEventListener('input', drawSugg);
q.addEventListener('focus', drawSugg);
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { sel = Math.min(sel+1, hits.length-1); mark(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sel = Math.max(sel-1, 0); mark(); e.preventDefault(); }
  else if (e.key === 'Enter') { if (hits[sel]) pick(hits[sel]); }
  else if (e.key === 'Escape') { sugg.hidden = true; q.blur(); }
});
sugg.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); pick(hits[+b.dataset.i]); } });
document.addEventListener('click', e => { if (!e.target.closest('.search')) sugg.hidden = true; });
addEventListener('scroll', () => $('#bar').classList.toggle('scrolled', scrollY > 4), {passive:true});

function pick(s){
  cur = s; limit = 120; q.value = ''; sugg.hidden = true; q.blur();
  if (/^[a-z0-9-]+$/.test(s.s)) history.replaceState(null, '', '#' + s.s);
  render();
  const top = $('#show').getBoundingClientRect().top + scrollY - 70;
  scrollTo({top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}

/* ---------- helpers ---------- */
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
const cleanName = s => s.n.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
const services = s => {
  const qn = encodeURIComponent(cleanName(s));
  return [
    ['Crunchyroll', `https://www.crunchyroll.com/search?q=${qn}`],
    ['Netflix', `https://www.netflix.com/search?q=${qn}`],
    ['Hulu', `https://www.hulu.com/search?q=${qn}`],
  ];
};
const badge = (s, e) => {
  if (e[2] === 'X') return `<span class="badge X">Mixed</span>`;
  if (e[2] === 'A') return `<span class="badge A">Anime canon</span>`;
  return '';
};

/* ---------- render ---------- */
function render(){
  const s = cur, el = $('#show');
  if (!s) { el.innerHTML = ''; return; }
  document.querySelectorAll('#quick button').forEach(b => b.setAttribute('aria-current', b.dataset.s === s.s));
  const eps = s.e, watch = eps.filter(e => keep(s, e));
  const done = new Set(store.get('w:' + s.s, []));
  const skip = eps.length - watch.length;
  const next = watch.find(e => !done.has(e[0]));
  const gi = Object.keys(GUIDES).indexOf(guide);

  let rows = '', shown = 0, last = -1;
  for (let i = 0; i < eps.length && shown < limit; i++) {
    const e = eps[i]; if (!keep(s, e)) continue;
    if (hideDone && done.has(e[0])) { last = i; continue; }
    const gap = eps.slice(last + 1, i).filter(x => !keep(s, x)).length;
    if (gap) rows += `<li class="gap"><span class="body">${gap} filler episode${gap > 1 ? 's' : ''} skipped</span></li>`;
    rows += `<li class="${done.has(e[0]) ? 'done' : ''}"><input type="checkbox" class="ck" id="w-${esc(e[0])}" data-n="${esc(e[0])}" ${done.has(e[0]) ? 'checked' : ''} aria-label="Watched episode ${esc(e[0])}"><label class="body" for="w-${esc(e[0])}"><span class="n">${esc(e[0])}</span><span class="t">${esc(e[1])}${badge(s, e) ? `<span class="bdg">${badge(s, e)}</span>` : ''}</span></label></li>`;
    shown++; last = i;
  }
  const remaining = watch.filter(e => !hideDone || !done.has(e[0])).length - shown;

  const guideNote = `${watch.length} of ${eps.length} episodes. ${GUIDES[guide].note}`;

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
    <p class="guide-note">${esc(guideNote)}</p>

    ${next ? `
    <p class="sec">Up next</p>
    <div class="group next">
      <span class="eyebrow">Episode ${esc(next[0])}</span>
      <h3>${esc(next[1])}</h3>
      ${badge(s, next) ? `<div class="badges">${badge(s, next)}</div>` : ''}
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

  el.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
    guide = b.dataset.g; store.set('guide', guide); limit = 120;
    const y = scrollY; render(); scrollTo(0, y);
  });
  $('#copy').onclick = () => {
    const txt = `${s.n} (${GUIDES[guide].label}): ${ranges(s).join(', ')}`;
    const fallback = () => toast('Copy is not available here');
    try { navigator.clipboard.writeText(txt).then(() => toast('Episode list copied'), fallback); } catch { fallback(); }
  };
  $('#hide').onchange = e => { hideDone = e.target.checked; store.set('hideDone', hideDone); const y = scrollY; render(); scrollTo(0, y); };
  const more = $('#more'); if (more) more.onclick = () => { limit += 300; const y = scrollY; render(); scrollTo(0, y); };
  const setWatched = (n, on) => {
    const set = new Set(store.get('w:' + s.s, []));
    on ? set.add(n) : set.delete(n);
    store.set('w:' + s.s, [...set]);
    const y = scrollY; render(); scrollTo(0, y);
  };
  el.querySelectorAll('ol.eps input').forEach(c => c.onchange = () => setWatched(c.dataset.n, c.checked));
  const nd = $('#next-done');
  if (nd) nd.onclick = () => { setWatched(nd.dataset.n, true); toast(`Episode ${nd.dataset.n} watched`); };
}

/* ---------- boot ---------- */
const POP = ['one-piece','naruto-shippuden','jujutsu-kaisen','bleach','demon-slayer-kimetsu-no-yaiba','naruto','my-hero-academia','dragon-ball-z','hunter-x-hunter','black-clover','fairy-tail','boruto-naruto-next-generations','dragon-ball-super','fullmetal-alchemist-brotherhood','detective-conan'];
function fmtDate(iso){ try { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}); } catch { return iso; } }
function fromHash(){ const h = decodeURIComponent(location.hash.slice(1)); const s = DATA.find(x => x.s === h); if (s) { cur = s; render(); return true; } return false; }
function boot(d){
  prep(d);
  q.placeholder = `Search ${DATA.length} anime`;
  $('#updated').textContent = UPDATED ? `Updated ${fmtDate(UPDATED)}.` : '';
  $('#quick').innerHTML = POP.map(sl => DATA.find(s => s.s === sl)).filter(Boolean).map(s => `<button data-s="${esc(s.s)}">${img(s)}<span>${esc(s.n)}</span></button>`).join('');
  const prev = cur && DATA.find(s => s.s === cur.s);
  if (prev) { cur = prev; render(); }
  else if (!fromHash()) { cur = DATA.find(s => s.s === 'one-piece') || DATA[0]; render(); }
}
$('#quick').onclick = e => { const b = e.target.closest('button'); if (b) pick(DATA.find(s => s.s === b.dataset.s)); };
addEventListener('hashchange', fromHash);
async function load(fresh){
  const r = await fetch('data.json', fresh ? {cache:'reload'} : {});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
load(false).then(boot).catch(() => { $('#show').innerHTML = '<p class="loading">Couldn’t load the episode lists. Check your connection and try again.</p>'; });

// Installed app only (not inside Claude): offline support and a manual refresh.
if (!window.claude && document.querySelector('link[rel="manifest"]')) {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  $('#refresh-area').innerHTML = '<button class="link" id="refresh" style="border:0;background:none;color:var(--blue);font-size:15px;cursor:pointer">Check for new episodes</button>';
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
