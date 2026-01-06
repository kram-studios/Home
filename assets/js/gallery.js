let PHOTOS = [];
let currentIndex = 0;

const INITIAL_VISIBLE = 18;
const LOAD_BATCH = 18;


const ratioCache = new Map(); // key: src or thumb, value: aspect ratio (w/h)

function getKey(p){ return (p.thumb || p.src || "").toLowerCase(); }

function loadRatio(p){
  return new Promise((resolve) => {
    const key = getKey(p);
    if (ratioCache.has(key)) return resolve(ratioCache.get(key));

    const img = new Image();
    img.onload = () => {
      const r = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 1.5;
      ratioCache.set(key, r);
      resolve(r);
    };
    img.onerror = () => {
      ratioCache.set(key, 1.5);
      resolve(1.5);
    };
    img.src = p.thumb || p.src;
  });
}

async function ensureRatios(items){
  await Promise.all(items.map(loadRatio));
}

function buildJustified(container, items, onClickIndex){
  // Classic "justified" rows: constant row height, widths scaled to fill container.
  const gap = 14;
  const containerWidth = container.clientWidth || 1000;

  // Base target heights
  const targetH = window.matchMedia("(max-width: 520px)").matches ? 220 :
                  window.matchMedia("(max-width: 920px)").matches ? 200 : 260;

  container.innerHTML = "";

  let row = [];
  let rowAR = 0;

  function flushRow(isLast=false){
    if (!row.length) return;

    const gapsTotal = gap * (row.length - 1);
    const available = Math.max(10, containerWidth - gapsTotal);

    // Choose height:
    // - normal rows: stretch to fill width exactly
    // - last row: don't blow up; keep targetH and center the row
    let h = targetH;
    let stretch = !isLast;

    if (stretch){
      h = available / rowAR;
    }

    const rowEl = document.createElement("div");
    rowEl.className = "j-row";
    if (isLast) rowEl.style.justifyContent = "center";

    // Compute widths with exact-fit correction for stretched rows
    let widths = [];
    if (stretch){
      // float widths
      const floats = row.map(x => h * x.ar);
      // floor all but last
      let sum = 0;
      for (let i=0; i<floats.length; i++){
        let w = (i === floats.length - 1) ? 0 : Math.max(1, Math.floor(floats[i]));
        widths.push(w);
        sum += w;
      }
      // last gets remaining pixels
      const lastW = Math.max(1, Math.round(available - sum));
      widths[widths.length - 1] = lastW;
    } else {
      widths = row.map(x => Math.max(1, Math.round(h * x.ar)));
    }

    row.forEach(({p, idx}, i) => {
      const wrap = document.createElement("div");
      wrap.className = "j-item";
      wrap.style.width = widths[i] + "px";
      wrap.style.height = Math.round(h) + "px";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = p.thumb || p.src;
      img.alt = p.alt || "";

      wrap.appendChild(img);
      wrap.addEventListener("click", () => onClickIndex(idx));
      rowEl.appendChild(wrap);
    });

    container.appendChild(rowEl);
    row = [];
    rowAR = 0;
  }

  items.forEach(({p, idx}) => {
    const ar = ratioCache.get(getKey(p)) || 1.5;
    row.push({p, idx, ar});
    rowAR += ar;

    const gapsTotal = gap * (row.length - 1);
    const available = Math.max(10, containerWidth - gapsTotal);

    // If the row at targetH would exceed available width, flush (stretch)
    if ((rowAR * targetH) >= available && row.length >= 2){
      flushRow(false);
    }
  });

  flushRow(true);
}

// Rebuild justified layout on resize (debounced)
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // gallery.js stores last render state, trigger by clicking load more or re-render
    if (typeof window.__rerenderPortfolio === "function") window.__rerenderPortfolio();
  }, 120);
});

function qs(sel, el=document){ return el.querySelector(sel); }
function qsa(sel, el=document){ return [...el.querySelectorAll(sel)]; }

function normalizeLine(s){ return (s||"").trim(); }
function isCommentOrEmpty(s){ return !s || s.startsWith("#") || s.startsWith("//"); }
function basename(p){ return (p||"").split("/").pop(); }

function classifyFrame(imgEl, wrapEl){
  // Classify based on natural aspect ratio
  const w = imgEl.naturalWidth || 0;
  const h = imgEl.naturalHeight || 0;
  if (!w || !h) return;

  const r = w / h;
  // "close to square" window
  let cls = "square";
  if (r < 0.90) cls = "portrait";
  else if (r > 1.10) cls = "landscape";

  wrapEl.classList.remove("portrait","landscape","square");
  wrapEl.classList.add(cls);
}


function buildBasenameMap(photos){
  const m = new Map();
  photos.forEach(p => {
    const src = p?.src;
    if (!src) return;
    const b = basename(src).toLowerCase();
    if (!m.has(b)) m.set(b, src);
  });
  return m;
}

async function readLines(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const txt = await res.text();
  return txt.split(/\r?\n/).map(normalizeLine).filter(s => !isCommentOrEmpty(s));
}

async function loadGallery(){
  const res = await fetch('gallery.json', {cache:'no-store'});
  const data = await res.json();
  const cat = (data.categories && data.categories[0]) ? data.categories[0] : {photos:[]};
  PHOTOS = cat.photos || [];

  await loadFeaturedOverrides();
  render();
}

let featuredSrcs = [];
let featuredBasenames = new Set();
let visibleCount = INITIAL_VISIBLE;

async function loadFeaturedOverrides(){
  const bmap = buildBasenameMap(PHOTOS);
  featuredSrcs = [];
  featuredBasenames = new Set();

  try{
    const lines = await readLines("featured.txt");
    lines.forEach(line => {
      let src = "";
      if (line.includes("/")) src = line;
      else src = bmap.get(line.toLowerCase()) || "";
      if (src){
        featuredSrcs.push(src);
        featuredBasenames.add(basename(src).toLowerCase());
      } else {
        console.warn("featured.txt item not found in gallery.json:", line);
      }
    });
  }catch(e){
    const fallback = PHOTOS.slice(0, 6).map(p => p.src).filter(Boolean);
    featuredSrcs = fallback;
    fallback.forEach(s => featuredBasenames.add(basename(s).toLowerCase()));
  }
}

function render(){
  renderFeatured();
  renderGrid();
  updateLoadMore();
}

function renderFeatured(){
  const fg = qs('#featuredGrid');
  if(!fg) return;

  fg.innerHTML = '';
  featuredSrcs.forEach((src)=>{
    const idx = PHOTOS.findIndex(p => p.src === src);
    const wrap = document.createElement('div');
    wrap.className = 'm-item';
    wrap.innerHTML = `<img loading="lazy" src="${src}" alt="Kram Studios featured">`;
    wrap.addEventListener('click', ()=>openLightbox(idx >= 0 ? idx : 0));
    fg.appendChild(wrap);
  });
}

function renderGrid(){
  const grid = qs('#photoGrid');
  if(!grid) return;

  grid.innerHTML = '';

  // Exclude featured photos from the grid
  const remaining = PHOTOS.filter(p => !featuredBasenames.has(basename(p.src).toLowerCase()));
  const items = remaining.slice(0, visibleCount);

  items.forEach((p)=>{
    const idx = PHOTOS.findIndex(x => x.src === p.src);

    const wrap = document.createElement('div');
    wrap.className = 'm-item';
    wrap.innerHTML = `<img loading="lazy" src="${p.thumb || p.src}" alt="${p.alt || ''}">`;
    wrap.addEventListener('click', ()=>openLightbox(idx >= 0 ? idx : 0));
    grid.appendChild(wrap);
  });
}

function updateLoadMore(){
  const btn = qs('#loadMoreBtn');
  if(!btn) return;

  const remaining = PHOTOS.filter(p => !featuredBasenames.has(basename(p.src).toLowerCase()));
  const left = Math.max(0, remaining.length - visibleCount);
  btn.style.display = left > 0 ? 'inline-block' : 'none';
  btn.textContent = left > 0 ? 'Load more' : 'No more photos';
}

function openLightbox(idx){
  currentIndex = idx;
  const lb = qs('#lightbox');
  const img = qs('#lbImg');
  img.src = PHOTOS[currentIndex]?.src || '';
  img.alt = PHOTOS[currentIndex]?.alt || '';
  qs('#lbCount').textContent = `${currentIndex+1} / ${PHOTOS.length}`;
  lb.classList.add('open');
}

function closeLightbox(){
  qs('#lightbox').classList.remove('open');
  const img = qs('#lbImg');
  img.src = '';
}

function prevPhoto(){
  if(!PHOTOS.length) return;
  currentIndex = (currentIndex - 1 + PHOTOS.length) % PHOTOS.length;
  openLightbox(currentIndex);
}
function nextPhoto(){
  if(!PHOTOS.length) return;
  currentIndex = (currentIndex + 1) % PHOTOS.length;
  openLightbox(currentIndex);
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadGallery();

  const btn = qs('#loadMoreBtn');
  if(btn){
    btn.addEventListener('click', ()=>{
      visibleCount += LOAD_BATCH;
      renderGrid();
      updateLoadMore();
    });
  }

  const lb = qs('#lightbox');
  if(lb){
    lb.addEventListener('click', (e)=>{
      if(e.target.id === 'lightbox') closeLightbox();
    });
  }

  qsa('[data-lb-close]').forEach(b=>b.addEventListener('click', closeLightbox));
  qsa('[data-lb-prev]').forEach(b=>b.addEventListener('click', prevPhoto));
  qsa('[data-lb-next]').forEach(b=>b.addEventListener('click', nextPhoto));

  document.addEventListener('keydown', (e)=>{
    if(!qs('#lightbox')?.classList.contains('open')) return;
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowLeft') prevPhoto();
    if(e.key === 'ArrowRight') nextPhoto();
  });
});