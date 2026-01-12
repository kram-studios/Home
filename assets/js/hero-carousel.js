/**
 * Hero Carousel v7 (Wheel/Coverflow)
 * - Reads carousel.txt (one filename or path per line); auto-count = number of lines
 * - If a line is just a filename, it is matched against gallery.json by basename
 * - Main image is large; prev/next are small with ~50% transparency
 * - Exposes window.KRAM_HERO_LIST = [{src, thumb, alt}] so Home can build Showcase (9)
 */
function $(sel, el = document) { return el.querySelector(sel); }

function normalizeLine(s){ return (s || "").trim(); }
function isCommentOrEmpty(s){ return !s || s.startsWith("#") || s.startsWith("//"); }
function basename(p){ return (p || "").split("/").pop(); }

function buildBasenameMap(photos){
  const m = new Map();
  photos.forEach(p => {
    const src = p?.src;
    if (!src) return;
    const b = basename(src).toLowerCase();
    if (!m.has(b)) m.set(b, p);
  });
  return m; // basename -> photo object {src, thumb, alt,...}
}

async function readLines(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const txt = await res.text();
  return txt.split(/\r?\n/).map(normalizeLine).filter(s => !isCommentOrEmpty(s));
}

function toPhotoObjFromResolved(resolved){
  // resolved can be either a string path or a photo object
  if (!resolved) return null;
  if (typeof resolved === "string"){
    const src = resolved;
    // best-effort thumb inference if it’s under assets/gallery/full/
    const file = basename(src);
    const thumb = src.includes("/gallery/full/")
      ? src.replace("/gallery/full/", "/gallery/thumb/")
      : src;
    return { src, thumb, alt: "Kram Studios" };
  }
  // photo object from gallery.json
  return {
    src: resolved.src,
    thumb: resolved.thumb || resolved.src,
    alt: resolved.alt || "Kram Studios"
  };
}

async function initHeroWheel(){
  const wheel = $("#heroWheel");
  if (!wheel) return;

  // Load gallery.json (for mapping filename -> src/thumb)
  let gallery;
  try {
    const res = await fetch("gallery.json", { cache: "no-store" });
    gallery = await res.json();
  } catch (e) {
    console.warn("Could not load gallery.json", e);
    return;
  }

  // Combine all photos across categories for lookup safety
  const allPhotos = [];
  (gallery?.categories || []).forEach(cat => {
    (cat?.photos || []).forEach(p => allPhotos.push(p));
  });

  // Fallback: first category photos
  const fallbackPhotos = (gallery?.categories?.[0]?.photos || []);
  const bmap = buildBasenameMap(allPhotos.length ? allPhotos : fallbackPhotos);

  // Load carousel list (preferred)
  let lines = [];
  try {
    lines = await readLines("carousel.txt");
  } catch (e) {
    // fallback to some gallery photos if carousel.txt missing
    lines = (fallbackPhotos.slice(0, 7).map(p => p?.src)).filter(Boolean);
  }

  // Resolve lines to photo objects
  const picksObj = [];
  lines.forEach(line => {
    if (line.includes("/")) {
      // treat as a direct path
      picksObj.push(toPhotoObjFromResolved(line));
    } else {
      const resolved = bmap.get(line.toLowerCase()); // photo obj
      if (resolved) picksObj.push(toPhotoObjFromResolved(resolved));
      else console.warn("carousel.txt item not found in gallery.json:", line);
    }
  });

  const picks = picksObj.filter(Boolean);
  if (!picks.length) return;

  // Expose for Home Showcase (uses thumb for speed)
  window.KRAM_HERO_LIST = picks;

  let active = 0;
  const n = picks.length;

  function mod(x, m){ return ((x % m) + m) % m; }

  function render(){
    wheel.innerHTML = "";

    const idxActive = active;
    const idxPrev   = mod(active - 1, n);
    const idxNext   = mod(active + 1, n);
    const idxPrev2  = mod(active - 2, n);
    const idxNext2  = mod(active + 2, n);

    function addCard(i, cls){
      const p = picks[i];
      const d = document.createElement("div");
      d.className = `hero-card ${cls}`;
      d.innerHTML = `<img src="${p.src}" alt="${p.alt || `Kram Studios carousel ${i+1}`}" loading="${cls==='is-active'?'eager':'lazy'}">`;
      d.addEventListener("click", () => {
        active = i;
        render();
      });
      wheel.appendChild(d);
    }

    addCard(idxPrev2, "is-prev2");
    addCard(idxNext2, "is-next2");
    addCard(idxPrev,  "is-prev");
    addCard(idxNext,  "is-next");
    addCard(idxActive,"is-active");
  }

  function prev(){ active = mod(active - 1, n); render(); }
  function next(){ active = mod(active + 1, n); render(); }

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
  wheel.addEventListener("touchstart", (e) => {
    startX = e.touches?.[0]?.clientX ?? null;
  }, { passive: true });

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
