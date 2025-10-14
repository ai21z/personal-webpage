/* ━━━ Necrography — Vissarion Zounarakis ━━━
 * Smart Navigation Node Placement System
 * - Static fungal mycelium background image
 * - Non-overlapping anchor-based node placement
 * - Automatic collision avoidance with content
 * - Branch-reveal highlight effect on hover
 * - Full accessibility support
 */

// ━━━ A11y: Insert current year in footer ━━━
const yearElement = document.getElementById('yr');
if (yearElement) yearElement.textContent = new Date().getFullYear();

// ━━━ PRM Gate: Detect user preference ━━━
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ━━━ Background Geometry (Image Space) ━━━
const BG_NATURAL_W = 1920;
const BG_NATURAL_H = 1080;

let cover = { s: 1, dx: 0, dy: 0 };

function computeCoverTransform() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.max(vw / BG_NATURAL_W, vh / BG_NATURAL_H);
  const dx = (vw - BG_NATURAL_W * s) * 0.5;
  const dy = (vh - BG_NATURAL_H * s) * 0.5;
  cover.s = s;
  cover.dx = dx;
  cover.dy = dy;
}

function toViewportCover(x, y) {
  return [x * cover.s + cover.dx, y * cover.s + cover.dy];
}

// ━━━ Mycelium Geometry System (Exported from Python) ━━━
let MYC_MAP = null; // {seed, width, height, paths, junctions}

/**
 * Load exported geometry JSON and preload background image.
 */
async function loadMycelium() {
  try {
    const response = await fetch('artifacts/network.json');
    MYC_MAP = await response.json();
    console.log(`✅ Loaded ${MYC_MAP.paths.length} paths, ${MYC_MAP.junctions.length} junctions`);
  } catch (err) {
    console.error('❌ Failed to load mycelium geometry:', err);
  }
}

/* ━━━ Image-Space Graph + Pathfinding ━━━ */
let GRAPH = null; // { nodes: Array<{x,y}>, neighbors(id)->id[], nearestId(x,y) }
const PATH_CACHE = new Map(); // "fromId->toId" => [{x,y}, …]

function buildGraphFromPaths(paths) {
  const QUANT = 3;
  const key = (x, y) => `${Math.round(x / QUANT)},${Math.round(y / QUANT)}`;

  const nodes = [];
  const keyToId = new Map();
  const adj = [];

  const addNode = (x, y) => {
    const k = key(x, y);
    if (!keyToId.has(k)) {
      keyToId.set(k, nodes.length);
      nodes.push({ x, y });
    }
    return keyToId.get(k);
  };

  const link = (a, b) => {
    if (a === b) return;
    (adj[a] ??= new Set()).add(b);
    (adj[b] ??= new Set()).add(a);
  };

  for (const poly of paths) {
    if (!poly || poly.length === 0) continue;
    let prev = addNode(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      const cur = addNode(poly[i][0], poly[i][1]);
      link(prev, cur);
      prev = cur;
    }
  }

  const neighborCache = new Map();
  const neighbors = (id) => {
    if (!neighborCache.has(id)) neighborCache.set(id, Array.from(adj[id] ?? []));
    return neighborCache.get(id);
  };

  const nearestId = (x, y, radius = 80, step = 24) => {
    let best = -1;
    let bestD2 = Infinity;

    const tryPoint = (px, py) => {
      const id = keyToId.get(key(px, py));
      if (id != null) {
        const dx = nodes[id].x - x;
        const dy = nodes[id].y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          best = id;
          bestD2 = d2;
        }
      }
    };

    for (let r = 0; r <= radius; r += step) {
      for (let dx = -r; dx <= r; dx += step) {
        tryPoint(x + dx, y - r);
        tryPoint(x + dx, y + r);
      }
      for (let dy = -r + step; dy <= r - step; dy += step) {
        tryPoint(x - r, y + dy);
        tryPoint(x + r, y + dy);
      }
    }
    return best;
  };

  return { nodes, neighbors, nearestId };
}

function aStarPath(idA, idB) {
  if (!GRAPH || idA < 0 || idB < 0) return null;
  const cacheKey = `${idA}->${idB}`;
  if (PATH_CACHE.has(cacheKey)) return PATH_CACHE.get(cacheKey);

  const nodes = GRAPH.nodes;
  const neighbors = GRAPH.neighbors;

  const open = new Set([idA]);
  const came = new Map();
  const g = new Map([[idA, 0]]);
  const f = new Map([[idA, 0]]);

  const h = (id) => {
    const A = nodes[id];
    const B = nodes[idB];
    const dx = A.x - B.x;
    const dy = A.y - B.y;
    return dx * dx + dy * dy;
  };

  while (open.size) {
    let current = null;
    let best = Infinity;
    for (const id of open) {
      const fi = f.get(id) ?? Infinity;
      if (fi < best) {
        best = fi;
        current = id;
      }
    }

    if (current === idB) {
      const out = [];
      for (let c = current; c != null; c = came.get(c)) out.push(nodes[c]);
      out.reverse();
      PATH_CACHE.set(cacheKey, out);
      return out;
    }

    open.delete(current);

    for (const nb of neighbors(current)) {
      const tentative = (g.get(current) ?? Infinity) + 1;
      if (tentative < (g.get(nb) ?? Infinity)) {
        came.set(nb, current);
        g.set(nb, tentative);
        f.set(nb, tentative + h(nb));
        open.add(nb);
      }
    }
  }

  return null;
}

/* ━━━ Fixed Navigation Anchors (image space 1920×1080) ━━━ */
const NAV_COORDS = {
  intro:    { x: 1643, y: 163 },
  about:    { x: 1465, y: 181 },
  work:     { x: 1464, y: 275 },
  projects: { x: 1345, y: 370 },
  contact:  { x: 1523, y: 412 },
  blog:     { x: 1507, y: 690 },
  resume:   { x: 1432,  y: 638 },
  skills:   { x: 1119,  y: 241 }
};

const NODE_IDS = {}; // id -> graph node index

function showSection(sectionName) {
  const sections = document.querySelectorAll('.stage');
  sections.forEach(s => s.classList.toggle('active-section', s.dataset.section === sectionName));
  
  document.querySelectorAll('.network-node-label').forEach(label =>
    label.classList.toggle('active', label.dataset.section === sectionName)
  );
}
 
const NAV_ORDER = ['intro', 'about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills'];

function createNavLabel(id) {
  const label = document.createElement('a');
  label.dataset.node = id;
  label.dataset.section = id;
  label.className = 'network-node-label';
  const anchorId = id === 'intro' ? 'main' : id;
  label.href = `#${anchorId}`;
  label.innerHTML = `<span class="node-label">${id}</span>`;
  label.setAttribute('aria-label', `Navigate to ${id}`);
  label.addEventListener('click', (event) => {
    const targetStage = document.querySelector(`.stage[data-section="${id}"]`);
    if (targetStage) {
      event.preventDefault();
      showSection(id);
      targetStage.focus?.({ preventScroll: false });
    }
  });
  return label;
}

function placeNavLabels() {
  const nav = document.getElementById('network-nav');
  if (!nav || !MYC_MAP) return;

  if (nav.children.length === 0) {
    const frag = document.createDocumentFragment();
    for (const id of NAV_ORDER) {
      frag.appendChild(createNavLabel(id));
    }
    nav.appendChild(frag);
  }

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    const el = nav.querySelector(`[data-node="${id}"]`);
    if (!el) continue;
    const [x, y] = toViewportCover(pt.x, pt.y);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
}

// ━━━ Spark Animation State ━━━
const sparkCanvas = document.getElementById('reveal-canvas');
const sporeCanvas = document.getElementById('spore-canvas');
const sparkCtx = sparkCanvas ? sparkCanvas.getContext('2d') : null;
let sporeCtx = sporeCanvas ? sporeCanvas.getContext('2d') : null;
let spores = [];
let lastSporeFrame = 0;

let lastSparkTs = performance.now();
let ACTIVE_ANIMS = [];

function sizeCanvas(canvas) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function projectXY(points) {
  return points.map((p) => toViewportCover(p.x, p.y));
}

function cumulativeLengths(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return cum;
}

function pointAt(pts, cum, s) {
  const total = cum[cum.length - 1];
  if (s <= 0) return pts[0];
  if (s >= total) return pts[pts.length - 1];

  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < s) lo = mid + 1; else hi = mid;
  }

  const i = Math.max(1, lo);
  const segStart = cum[i - 1];
  const segLen = cum[i] - segStart;
  const t = segLen ? (s - segStart) / segLen : 0;
  const ax = pts[i - 1][0];
  const ay = pts[i - 1][1];
  const bx = pts[i][0];
  const by = pts[i][1];
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

const loggedPathFailures = new Set();

function startSpark(fromKey, toKey, speedPxPerSec = 650, direction = +1) {
  if (prefersReducedMotion || !GRAPH) return;
  const fromAnchor = NAV_COORDS[fromKey];
  const toAnchor = NAV_COORDS[toKey];
  if (!fromAnchor || !toAnchor) return;

  const idA = GRAPH.nearestId(fromAnchor.x, fromAnchor.y, 96, 24);
  const idB = GRAPH.nearestId(toAnchor.x, toAnchor.y, 96, 24);
  if (idA < 0 || idB < 0) {
    const key = `${fromKey}->${toKey}`;
    if (!loggedPathFailures.has(key)) {
      console.warn('nearestId failed for spark path', key, { idA, idB });
      loggedPathFailures.add(key);
    }
    return;
  }

  const solved = aStarPath(idA, idB);
  if (!solved || solved.length < 2) {
    const key = `${fromKey}->${toKey}`;
    if (!loggedPathFailures.has(key)) {
      console.warn('A* path missing for spark', key);
      loggedPathFailures.add(key);
    }
    return;
  }

  const pathImg = solved.map((pt) => ({ x: pt.x, y: pt.y }));
  pathImg[0] = { x: fromAnchor.x, y: fromAnchor.y };
  pathImg[pathImg.length - 1] = { x: toAnchor.x, y: toAnchor.y };

  const proj = projectXY(pathImg);
  const cum = cumulativeLengths(proj);
  const len = cum[cum.length - 1];
  if (!len) return;

  ACTIVE_ANIMS.push({
    imgPts: pathImg,
    projPts: proj,
    cum,
    len,
    s: direction > 0 ? 0 : len,
    v: speedPxPerSec,
    dir: direction > 0 ? 1 : -1
  });
}

function drawSparks(dt) {
  if (!sparkCtx || !sparkCanvas) return;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  sparkCtx.clearRect(0, 0, cssW, cssH);

  const trailLen = 60;
  const survivors = [];

  for (const anim of ACTIVE_ANIMS) {
    anim.s += anim.dir * anim.v * dt;
    if (anim.s < 0 || anim.s > anim.len) continue;

    const head = pointAt(anim.projPts, anim.cum, anim.s);
    const tail = pointAt(anim.projPts, anim.cum, Math.max(0, anim.s - trailLen));

    sparkCtx.save();
    sparkCtx.lineCap = 'round';
    sparkCtx.lineJoin = 'round';

    sparkCtx.strokeStyle = 'rgba(122,174,138,0.25)';
    sparkCtx.lineWidth = 6;
    sparkCtx.shadowBlur = 16;
    sparkCtx.shadowColor = 'rgba(122,174,138,0.6)';
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    sparkCtx.strokeStyle = 'rgba(240,255,245,0.9)';
    sparkCtx.lineWidth = 2;
    sparkCtx.shadowBlur = 8;
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    sparkCtx.fillStyle = 'rgba(200,255,220,0.95)';
    sparkCtx.shadowBlur = 12;
    sparkCtx.beginPath();
    sparkCtx.arc(head[0], head[1], 2.4, 0, Math.PI * 2);
    sparkCtx.fill();

    sparkCtx.restore();
    survivors.push(anim);
  }

  ACTIVE_ANIMS = survivors;
}

function sparkLoop(ts) {
  const dt = Math.min(0.05, (ts - lastSparkTs) / 1000);
  lastSparkTs = ts;
  drawSparks(dt);
  requestAnimationFrame(sparkLoop);
}

function resizeAll() {
  computeCoverTransform();
  sizeCanvas(sparkCanvas);
  sizeCanvas(sporeCanvas);
  placeNavLabels();

  ACTIVE_ANIMS = ACTIVE_ANIMS.map((anim) => {
    const projPts = projectXY(anim.imgPts);
    const cum = cumulativeLengths(projPts);
    const len = cum[cum.length - 1];
    if (!len) return null;
    const ratio = anim.len ? anim.s / anim.len : (anim.dir > 0 ? 0 : 1);
    const s = Math.max(0, Math.min(len, ratio * len));
    return { ...anim, projPts, cum, len, s };
  }).filter(Boolean);

  if (sporeCtx) createSpores();
}

resizeAll();
requestAnimationFrame(sparkLoop);
startSpores();

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeAll, 80);
}, { passive: true });

// ━━━ Navigation Hover State ━━━
let currentNavHover = null;

function handleNavEnter(id, el) {
  if (currentNavHover === id) return;
  currentNavHover = id;

  if (prefersReducedMotion) {
    document.querySelectorAll('.network-node-label.motion-highlight').forEach(node => node.classList.remove('motion-highlight'));
    el.classList.add('motion-highlight');
    if (id !== 'intro') {
      const introEl = document.querySelector('.network-node-label[data-node="intro"]');
      introEl?.classList.add('motion-highlight');
    }
    return;
  }

  if (id === 'intro') {
    for (const dest of NAV_ORDER) {
      if (dest === 'intro') continue;
      startSpark('intro', dest, 650, +1);
      startSpark(dest, 'intro', 650, -1);
    }
  } else {
    startSpark('intro', id, 650, +1);
    startSpark(id, 'intro', 650, -1);
  }
}

function handleNavLeave(id, el) {
  if (currentNavHover !== id) return;
  currentNavHover = null;

  if (prefersReducedMotion) {
    el.classList.remove('motion-highlight');
    if (id !== 'intro') {
      const introEl = document.querySelector('.network-node-label[data-node="intro"]');
      introEl?.classList.remove('motion-highlight');
    }
  }
}

// ━━━ Spores Layer (ambient) ━━━

function createSpores() {
  if (!sporeCanvas || !sporeCtx) return;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const count = cssW < 768 ? 30 : 50;
  spores = new Array(count).fill(0).map(() => ({
    x: Math.random() * cssW,
    y: Math.random() * cssH,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    r: 1 + Math.random() * 3,
    p: Math.random() * Math.PI * 2,
    a: 0.1 + Math.random() * 0.25,
    scalePhase: Math.random() * Math.PI * 2
  }));
  lastSporeFrame = 0;
}

function drawSpores(ts) {
  if (!sporeCtx || !sporeCanvas) return;
  if (ts - lastSporeFrame < 33) return;
  lastSporeFrame = ts;

  const c = sporeCtx;
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.clearRect(0, 0, w, h);

  for (const s of spores) {
    s.x = (s.x + s.vx + w) % w;
    s.y = (s.y + s.vy + h) % h;

    const pulse = (Math.sin(ts * 0.001 + s.p) + 1) / 2;
    const scalePulse = 0.8 + 0.4 * (Math.sin(ts * 0.0015 + s.scalePhase) + 1) / 2;
    const radius = s.r * scalePulse;

    c.shadowBlur = 8;
    c.shadowColor = `rgba(122,174,138,${s.a * pulse * 0.6})`;
    c.fillStyle = `rgba(122,174,138,${s.a * pulse})`;
    c.beginPath();
    c.arc(s.x, s.y, radius, 0, Math.PI * 2);
    c.fill();

    c.shadowBlur = 0;
    c.fillStyle = `rgba(200,255,220,${s.a * pulse * 0.8})`;
    c.beginPath();
    c.arc(s.x, s.y, radius * 0.4, 0, Math.PI * 2);
    c.fill();
  }
}

function startSpores() {
  if (!sporeCanvas || prefersReducedMotion) return;
  sporeCtx = sporeCtx || sporeCanvas.getContext('2d');
  if (!sporeCtx) return;
  createSpores();

  function loop(ts) {
    drawSpores(ts);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function nearestNodeId(pt) {
  if (!GRAPH) return -1;
  return GRAPH.nearestId(pt.x, pt.y, 96, 24);
}

// ━━━ Initialization ━━━
async function initNetworkAndNav() {
  if (!MYC_MAP) return;

  GRAPH = buildGraphFromPaths(MYC_MAP.paths);
  PATH_CACHE.clear();

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    NODE_IDS[id] = nearestNodeId(pt);
  }

  const introId = NODE_IDS.intro;
  if (introId !== undefined) {
    for (const [id, node] of Object.entries(NODE_IDS)) {
      if (id === 'intro' || node === undefined) continue;
      aStarPath(introId, node);
      aStarPath(node, introId);
    }
  }

  placeNavLabels();
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadMycelium();
  await initNetworkAndNav();

  const nav = document.getElementById('network-nav');
  if (nav) {
    nav.querySelectorAll('.network-node-label').forEach(el => {
      const id = el.dataset.node;
      el.addEventListener('pointerenter', () => handleNavEnter(id, el));
      el.addEventListener('pointerleave', () => handleNavLeave(id, el));
      el.addEventListener('focus', () => handleNavEnter(id, el));
      el.addEventListener('blur', () => handleNavLeave(id, el));
    });
  }

  placeNavLabels();
  showSection('intro');
  resizeAll();
});

// ━━━ Glitch Text Effect Setup ━━━
const glitchElements = document.querySelectorAll('.glitch-text');
glitchElements.forEach(el => {
  el.setAttribute('data-text', el.textContent);
});

// ━━━ Sigil Interaction: Simple Rotation + Particle Effect ━━━
const sigilWrap = document.querySelector('.sigil-wrap');
const sigilImg  = document.getElementById('sigil');
let flipped = false;

// Debug: Check if elements are found
console.log('Sigil elements found:', { sigilWrap: !!sigilWrap, sigilImg: !!sigilImg });

/**
 * Simple Particle Effect
 * Creates ~12 lightweight particles that fly outward and fade
 */
function simpleParticles(x, y) {
  if (prefersReducedMotion) return;
  
  const layer = document.createElement('div');
  Object.assign(layer.style, {
    position:'absolute', 
    inset:0, 
    overflow:'hidden', 
    pointerEvents:'none',
    zIndex:999
  });
  document.body.appendChild(layer);
  
  const count = 12;
  for (let i=0; i<count; i++){
    const particle = document.createElement('span');
    const angle = (Math.PI * 2) * (i / count);
    const distance = 50 + Math.random() * 30;
    const size = 3;
    
    Object.assign(particle.style, {
      position:'absolute',
      left: x + 'px', 
      top: y + 'px',
      width: size + 'px', 
      height: size + 'px',
      borderRadius:'50%',
      background:'rgba(230,227,216,.7)',
      transform:'translate(-50%,-50%)',
      transition:'transform .5s ease-out, opacity .5s ease-out'
    });
    
    layer.appendChild(particle);
    
    // Animate in next frame
    requestAnimationFrame(() => {
      particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
      particle.style.opacity = '0';
    });
  }
  
  // Clean up after animation
  setTimeout(() => layer.remove(), 600);
}

/**
 * Sigil Activation Handler
 * Simple rotation + particle effect
 */
function onActivate(e) {
  e.preventDefault();
  
  // Get sigil center for particles
  const rect = sigilImg.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  // Toggle rotation state
  flipped = !flipped;
  const rotation = flipped ? 180 : 0;
  console.log('Rotating sigil to:', rotation, 'degrees');
  sigilImg.style.transform = `rotate(${rotation}deg)`;
  console.log('Transform applied:', sigilImg.style.transform);

  // Simple particle effect
  simpleParticles(cx, cy);

  // A11y: Announce state change to screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = flipped 
    ? 'Sigil rotated 180 degrees.' 
    : 'Sigil restored to original position.';
  
  // Visually hidden but accessible to screen readers
  Object.assign(announcement.style, {
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden'
  });
  
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

// Click handler
if (sigilWrap && sigilImg) {
  sigilWrap.addEventListener('click', onActivate);

  // Keyboard handler (Enter or Space)
  sigilWrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onActivate(e);
    }
  });
}

/* ━━━ NOTES ━━━
 * Navigation:
 * - NAV_COORDS provides fixed 1920×1080 anchors; toViewportCover() keeps them glued to the artwork.
 * - GRAPH is an A* graph derived from artifacts/network.json so sparks hug real mycelium branches.
 *
 * Motion:
 * - Sparks animate as lightweight dots with additive glow; PATH_CACHE prevents redundant routing.
 * - prefers-reduced-motion skips animation and applies motion-highlight styling instead.
 * - Ambient spores pause when reduced motion is requested.
 *
 * Accessibility:
 * - Labels remain keyboard focusable with focus-visible styling and click handlers.
 * - showSection() keeps content panes in sync with nav state.
 */
