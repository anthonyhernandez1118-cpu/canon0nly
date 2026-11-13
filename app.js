let DATA = [], UPDATED = '';
const TYPES = {M:'Manga canon',A:'Anime canon',X:'Mixed canon/filler',F:'Filler'};
const $ = s => document.querySelector(s);
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const safe = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '_');
const poster = s => `posters/${safe(s.s)}.webp`;
const img = (s, cls='') => `<img src="${poster(s)}" alt="" loading="lazy" ${cls} onerror="this.style.visibility='hidden'">`;
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function prep(d){ DATA = d.shows; UPDATED = d.updated; DATA.forEach(s => { s.k = norm(s.n + ' ' + s.s.replace(/-/g,' ')); s.f = s.e.filter(e => e[2]==='F').length; }); }
const store = { get(k,d){ try{ const v = localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch{return d} }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} } };
let inc = store.get('inc', {A:true, X:true});
let cur = null, limit = 150, hideDone = false;

function search(q){
  const n = norm(q); if(!n) return [];
  const words = n.split(' ');
  return DATA.map(s => {
    if(!words.every(w => s.k.includes(w))) return null;
    let sc = s.k.startsWith(n) ? 0 : (' '+s.k).includes(' '+n) ? 1 : 2;
    return [sc, -s.e.length, s];
  }).filter(Boolean).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).slice(0,8).map(x=>x[2]);
}
const q = $('#q'), sugg = $('#sugg'); let hits = [], sel = 0;
function drawSugg(){
  if(!q.value.trim()){ sugg.hidden = true; return; }
  hits = search(q.value); sel = 0;
  sugg.innerHTML = hits.length ? hits.map((s,i)=>`<button type="button" role="option" data-i="${i}" aria-selected="${i===sel}"><span class="nm">${img(s)}<span>${esc(s.n)}</span></span><span>${s.e.length} eps · ${s.f} filler</span></button>`).join('') : `<div class="none">No match for “${esc(q.value)}”. Try the Japanese or English title.</div>`;
  sugg.hidden = false;
}
function mark(){ sugg.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected', i===sel)); }
q.addEventListener('input', drawSugg);
q.addEventListener('focus', drawSugg);
q.addEventListener('keydown', e => {
  if(e.key==='ArrowDown'){ sel = Math.min(sel+1, hits.length-1); mark(); e.preventDefault(); }
  else if(e.key==='ArrowUp'){ sel = Math.max(sel-1, 0); mark(); e.preventDefault(); }
  else if(e.key==='Enter'){ if(hits[sel]) pick(hits[sel]); }
  else if(e.key==='Escape'){ sugg.hidden = true; }
});
sugg.addEventListener('mousedown', e => { const b = e.target.closest('button'); if(b){ e.preventDefault(); pick(hits[+b.dataset.i]); } });
document.addEventListener('click', e => { if(!e.target.closest('.search')) sugg.hidden = true; });

function pick(s){
  cur = s; limit = 150; q.value = ''; sugg.hidden = true; q.blur();
  if(/^[a-z0-9-]+$/.test(s.s)) history.replaceState(null,'','#'+s.s);
  render();
  window.scrollTo({top: 0});
}
const keep = e => e[2]==='M' || (e[2]==='A' && inc.A) || (e[2]==='X' && inc.X);

function ranges(eps){
  const out = []; let start = null, prev = null;
  eps.forEach((e,i) => {
    if(keep(e)){ if(start===null) start = e; prev = e; }
    else if(start!==null){ out.push([start[0], prev[0]]); start = null; }
  });
  if(start!==null) out.push([start[0], prev[0]]);
  return out;
}
function render(){
  const s = cur, el = $('#show');
  if(!s){ el.innerHTML = ''; return; }
  document.querySelectorAll('#quick button').forEach(b => b.setAttribute('aria-current', b.dataset.s===s.s));
  const eps = s.e, watch = eps.filter(keep), cnt = {M:0,A:0,X:0,F:0};
  eps.forEach(e => cnt[e[2]]++);
  const skip = eps.length - watch.length, hrs = Math.round(skip*23/60);
  const done = new Set(store.get('w:'+s.s, []));
  const rg = ranges(eps);
  const rtxt = rg.map(([a,b]) => a===b ? a : a+'–'+b);
  const chip = (t, on, locked) => `<button class="chip${t==='F'?' no':''}" data-t="${t}" aria-pressed="${on}" ${locked?'disabled':''} title="${locked ? (t==='F'?'Filler is never included':'Always included') : 'Click to include or leave out'}"><span class="dot ${t}"></span>${TYPES[t]} <span class="ct">${cnt[t]}</span></button>`;
  const step = Math.max(1, Math.round(eps.length/6));
  const ticks = [eps[0][0]]; for(let i=step;i<eps.length-step/2;i+=step) ticks.push(eps[i][0]); ticks.push(eps[eps.length-1][0]);
  let rows = '', shown = 0, last = -1;
  for(let i=0;i<eps.length && shown<limit;i++){
    const e = eps[i]; if(!keep(e)) continue;
    if(hideDone && done.has(e[0])) { last = i; continue; }
    const gap = eps.slice(last+1, i).filter(x=>!keep(x)).length;
    if(gap) rows += `<li class="gap"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>${gap} filler episode${gap>1?'s':''} cut</li>`;
    rows += `<li class="${done.has(e[0])?'done':''}"><input type="checkbox" class="ck" id="w-${esc(e[0])}" data-n="${esc(e[0])}" ${done.has(e[0])?'checked':''} aria-label="Watched episode ${esc(e[0])}"><span class="n">${esc(e[0])}</span><span class="t">${esc(e[1])}</span><span class="tag"><span class="dot ${e[2]}"></span><span class="lbl">${TYPES[e[2]]}</span></span></li>`;
    shown++; last = i;
  }
  const remaining = watch.filter(e=>!hideDone || !done.has(e[0])).length - shown;
  const nextEp = watch.find(e => !done.has(e[0]));
  const watchedN = watch.filter(e => done.has(e[0])).length;
  const bd = $('#backdrop'); if(bd) bd.style.backgroundImage = `url("${poster(s)}")`;
  const isNew = el.dataset.s !== s.s; el.dataset.s = s.s;
  el.classList.toggle('enter', isNew);
  el.innerHTML = `
    <div class="head">
      <img class="cover" src="${poster(s)}" alt="${esc(s.n)} poster" onerror="this.style.visibility='hidden'">
      <div class="meta">
        <span class="kicker">${eps.length} episodes · ${cnt.F} filler</span>
        <h2>${esc(s.n)}</h2>
      </div>
      <div class="stats">
        <div class="stat"><b>${watch.length}</b><span>To watch</span></div>
        <div class="stat"><b>${skip}</b><span>Skipped</span></div>
        <div class="stat"><b>~${hrs}h</b><span>Time saved</span></div>
        <div class="stat"><b>${watchedN}<small style="font-size:.55em;opacity:.6">/${watch.length}</small></b><span>Watched</span></div>
      </div>
    </div>
    ${nextEp ? `<div class="panel next">
        <div class="ep"><small>UP NEXT</small>${esc(nextEp[0])}</div>
        <div class="tt"><p class="label">${TYPES[nextEp[2]]}</p>${esc(nextEp[1])}</div>
        <button class="btn" id="next-done" data-n="${esc(nextEp[0])}">Watched it</button>
      </div>` : watch.length ? `<div class="panel next done-all"><div class="tt"><p class="label">All caught up</p>You have watched every canon episode of ${esc(s.n)}.</div></div>` : ''}
    <div class="strip-wrap">
      <p class="label">The whole series</p>
      <div class="strip" style="gap:${eps.length>200?0:1}px" aria-label="Every episode in order, colored by type">${eps.map(e=>`<i class="${e[2]}${keep(e)?'':' off'}${done.has(e[0])?' w':''}" title="Ep ${esc(e[0])}: ${TYPES[e[2]]}"></i>`).join('')}</div>
      <div class="axis">${ticks.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    </div>
    <div class="legend">${chip('M',true,true)}${chip('A',inc.A,false)}${chip('X',inc.X,false)}${chip('F',false,true)}</div>
    <div class="panel plan">
      <div class="plan-head"><p class="label">Watch order · ${rg.length} stretch${rg.length===1?'':'es'}</p><button class="btn" id="copy">Copy episode list</button></div>
      <p class="ranges" id="ranges">${rtxt.map(r=>`<span class="r">${esc(r)}</span>`).join('<i class="cut" title="filler skipped"></i>') || 'Nothing left to watch with these settings.'}</p>
    </div>
    <div class="list">
      <div class="list-head"><p class="label">Episodes</p><label><input type="checkbox" class="ck" id="hide" ${hideDone?'checked':''}> Hide watched</label></div>
      ${rows ? `<ol class="eps panel">${rows}</ol>` : `<div class="empty panel">${hideDone?'You have watched every canon episode.':'No episodes to show.'}</div>`}
      ${remaining>0 ? `<button class="btn ghost more" id="more">Show ${Math.min(remaining,300)} more of ${remaining}</button>` : ''}
    </div>`;
  el.querySelectorAll('.chip:not([disabled])').forEach(b => b.onclick = () => { inc[b.dataset.t] = !inc[b.dataset.t]; store.set('inc', inc); render(); });
  const copy = $('#copy');
  copy.onclick = () => {
    const txt = `${s.n}, canon episodes: ${rtxt.join(', ')}`;
    const ok = () => { copy.textContent = 'Copied'; setTimeout(()=>copy.textContent='Copy episode list',1600); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#ranges')); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); copy.textContent = 'Press Ctrl+C to copy'; };
    try { navigator.clipboard.writeText(txt).then(ok, fallback); } catch { fallback(); }
  };
  $('#hide').onchange = e => { hideDone = e.target.checked; render(); };
  const more = $('#more'); if(more) more.onclick = () => { limit += 300; render(); };
  const setWatched = (n, on) => {
    const set = new Set(store.get('w:'+s.s, []));
    on ? set.add(n) : set.delete(n);
    store.set('w:'+s.s, [...set]);
    const y = scrollY; render(); scrollTo(0, y);
  };
  el.querySelectorAll('ol.eps input').forEach(c => c.onchange = () => setWatched(c.dataset.n, c.checked));
  const nd = $('#next-done'); if(nd) nd.onclick = () => setWatched(nd.dataset.n, true);
}
const POP = ['naruto-shippuden','one-piece','bleach','naruto','fairy-tail','black-clover','boruto-naruto-next-generations','dragon-ball-z','detective-conan','dragon-ball-super','fullmetal-alchemist-brotherhood','jujutsu-kaisen','demon-slayer-kimetsu-no-yaiba','my-hero-academia','hunter-x-hunter'];
function fmtDate(iso){ try { return new Date(iso+'T12:00:00').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); } catch { return iso; } }
function boot(d){
  prep(d);
  $('#q').placeholder = innerWidth < 520 ? `Search ${DATA.length} anime` : `Search ${DATA.length} anime, e.g. Naruto, One Piece, Bleach`;
  $('#updated').textContent = UPDATED ? `Lists updated ${fmtDate(UPDATED)}.` : '';
  $('#quick').innerHTML = POP.map(sl => DATA.find(s=>s.s===sl)).filter(Boolean).map(s=>`<button data-s="${esc(s.s)}">${img(s)}<span>${esc(s.n)}</span></button>`).join('');
  const prev = cur && DATA.find(s => s.s === cur.s);
  if(prev){ cur = prev; render(); }
  else if(!fromHash()){ cur = DATA.find(s=>s.s==='naruto-shippuden') || DATA[0]; render(); }
}
$('#quick').onclick = e => { const b = e.target.closest('button'); if(b) pick(DATA.find(s=>s.s===b.dataset.s)); };
function fromHash(){ const h = decodeURIComponent(location.hash.slice(1)); const s = DATA.find(x=>x.s===h); if(s){ cur = s; render(); return true; } return false; }
window.addEventListener('hashchange', fromHash);
async function load(fresh){
  const r = await fetch('data.json', fresh ? {cache:'reload'} : {});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
load(false).then(boot).catch(() => { $('#show').innerHTML = '<p class="loading">The episode lists did not load. Check your connection and reload the page.</p>'; });

// Installed app only (not inside Claude): offline support and a button that pulls the newest lists.
if(!window.claude && document.querySelector('link[rel="manifest"]')){
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  const area = $('#refresh-area');
  area.innerHTML = '<button class="btn ghost" id="refresh">Check for new episodes</button>';
  const btn = $('#refresh');
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      const before = UPDATED, d = await load(true);
      boot(d);
      btn.textContent = d.updated === before ? 'Already up to date' : `Updated to ${fmtDate(d.updated)}`;
    } catch { btn.textContent = 'Offline. Try again later'; }
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Check for new episodes'; }, 2500);
  };
}
