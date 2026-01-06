/**
 * Hero Carousel v7 (Wheel/Coverflow)
 * - Reads carousel.txt (one filename or path per line); auto-count = number of lines
 * - If a line is just a filename, it is matched against gallery.json by basename
 * - Main image is large; prev/next are small with ~50% transparency
 */
function $(sel, el=document){ return el.querySelector(sel); }

function normalizeLine(s){
  return (s || "").trim();
}
function isCommentOrEmpty(s){
  return !s || s.startsWith("#") || s.startsWith("//");
}
function basename(p){
  return (p || "").split("/").pop();
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

async function initHeroWheel(){
  const wheel = $("#heroWheel");
  if (!wheel) return;

  // Load gallery.json (for mapping filename -> src)
  let gallery;
  try {
    const res = await fetch("gallery.json", { cache: "no-store" });
    gallery = await res.json();
  } catch (e) {
    console.warn("Could not load gallery.json", e);
    return;
  }
  const photos = (gallery?.categories?.[0]?.photos || []);
  const bmap = buildBasenameMap(photos);

  // Load carousel list (preferred)
  let lines = [];
  try {
    lines = await readLines("carousel.txt");
  } catch (e) {
    lines = photos.slice(0, 7).map(p => p.src);
  }

  // Resolve lines to src paths
  const picks = [];
  lines.forEach(line => {
    if (line.includes("/")) {
      picks.push(line);
    } else {
      const resolved = bmap.get(line.toLowerCase());
      if (resolved) picks.push(resolved);
      else console.warn("carousel.txt item not found in gallery.json:", line);
    }
  });

  if (!picks.length) return;

  let active = 0;

  function mod(n, m){ return ((n % m) + m) % m; }

  function render(){
    wheel.innerHTML = "";

    const n = picks.length;
    const idxActive = active;
    const idxPrev = mod(active - 1, n);
    const idxNext = mod(active + 1, n);
    const idxPrev2 = mod(active - 2, n);
    const idxNext2 = mod(active + 2, n);

    function addCard(i, cls){
      const d = document.createElement("div");
      d.className = `hero-card ${cls}`;
      d.innerHTML = `<img src="${picks[i]}" alt="Kram Studios carousel ${i+1}" loading="${cls==='is-active'?'eager':'lazy'}">`;
      d.addEventListener("click", () => {
        active = i;
        render();
      });
      wheel.appendChild(d);
    }

    addCard(idxPrev2, "is-prev2");
    addCard(idxNext2, "is-next2");
    addCard(idxPrev, "is-prev");
    addCard(idxNext, "is-next");
    addCard(idxActive, "is-active");
  }

  function prev(){
    active = mod(active - 1, picks.length);
    render();
  }
  function next(){
    active = mod(active + 1, picks.length);
    render();
  }

  $("[data-hero-prev]")?.addEventListener("click", prev);
  $("[data-hero-next]")?.addEventListener("click", next);

  wheel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  // autoplay; stops after user interaction
  let autoplay = true;
  setInterval(() => { if (autoplay) next(); }, 3000);

  ["mousedown","touchstart","wheel"].forEach(evt => {
    wheel.addEventListener(evt, () => { autoplay = false; }, { passive: true });
  });

  // swipe support
  let startX = null;
  wheel.addEventListener("touchstart", (e) => { startX = e.touches?.[0]?.clientX ?? null; }, { passive: true });
  wheel.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const endX = e.changedTouches?.[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) > 36){
      autoplay = false;
      if (dx > 0) prev(); else next();
    }
    startX = null;
  }, { passive: true });

  render();
}

document.addEventListener("DOMContentLoaded", initHeroWheel);