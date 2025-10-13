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

// ━━━ Mycelium Geometry System (Exported from Python) ━━━
let MYC_MAP = null;     // {seed, width, height, paths, junctions}
let BG_IMG = null;      // Preloaded background image

/**
 * Map (mx,my) in network space → viewport pixels under object-fit: cover
 * Uses simple cover math - no transform tracking needed!
 */
function toViewportCover(mx, my) {
  if (!MYC_MAP) return [0, 0];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.max(vw / MYC_MAP.width, vh / MYC_MAP.height);
  const dx = (vw - MYC_MAP.width * s) * 0.5;
  const dy = (vh - MYC_MAP.height * s) * 0.5;
  // Snap to pixel centers for crisp label rendering
  const x = Math.round(mx * s + dx) + 0.5;
  const y = Math.round(my * s + dy) + 0.5;
  return [x, y];
}

/**
 * Load exported geometry JSON and preload background image.
 */
async function loadMycelium() {
  try {
    const response = await fetch('artifacts/network.json');
    MYC_MAP = await response.json();
    console.log(`✅ Loaded ${MYC_MAP.paths.length} paths, ${MYC_MAP.junctions.length} junctions`);
    console.log(`✅ Strategic nodes:`, MYC_MAP.strategic);
    
    BG_IMG = new Image();
    await new Promise((resolve, reject) => {
      BG_IMG.onload = resolve;
      BG_IMG.onerror = reject;
      BG_IMG.src = 'artifacts/bg_base.png';
    });
    
    console.log('✅ Mycelium geometry loaded successfully');
  } catch (err) {
    console.error('❌ Failed to load mycelium geometry:', err);
  }
}

/* ━━━ Image-Space Graph + Pathfinding ━━━ */
let GRAPH = null;          // { nodes: Map(key->id), pos: Array<{x,y}>, adj: Map(id -> number[]) }
const PATH_CACHE = new Map(); // "fromId->toId" => [{x,y}, ...]
const QUANT = 1;           // quantize to integer pixels for node identity

function keyOf(x, y) {
  return `${Math.round(x / QUANT) * QUANT}|${Math.round(y / QUANT) * QUANT}`;
}

function buildGraphFromPaths(paths) {
  const pos = [];
  const nodes = new Map();
  const adj = new Map();

  function ensureNode(x, y) {
    const k = keyOf(x, y);
    let id = nodes.get(k);
    if (id === undefined) {
      id = pos.length;
      nodes.set(k, id);
      pos.push({ x, y });
      adj.set(id, new Set());
    }
    return id;
  }

  for (const poly of paths) {
    if (!poly || poly.length < 2) continue;
    let prev = ensureNode(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      const cur = ensureNode(poly[i][0], poly[i][1]);
      adj.get(prev).add(cur);
      adj.get(cur).add(prev);
      prev = cur;
    }
  }

  const adjArr = new Map();
  for (const [id, set] of adj.entries()) adjArr.set(id, [...set]);
  return { nodes, pos, adj: adjArr };
}

function nearestNodeId({ x, y }) {
  if (!GRAPH) return -1;
  const k = keyOf(x, y);
  if (GRAPH.nodes.has(k)) return GRAPH.nodes.get(k);

  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < GRAPH.pos.length; i++) {
    const p = GRAPH.pos[i];
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      best = i;
      bestD2 = d2;
    }
  }
  return best;
}

function aStarPath(idA, idB) {
  if (idA === -1 || idB === -1 || !GRAPH) return [];
  const cacheKey = `${idA}->${idB}`;
  if (PATH_CACHE.has(cacheKey)) return PATH_CACHE.get(cacheKey);

  const pos = GRAPH.pos;
  const adj = GRAPH.adj;

  const open = new Set([idA]);
  const came = new Map();
  const g = new Map([[idA, 0]]);
  const f = new Map([[idA, 0]]);
  const pq = [{ id: idA, f: 0 }];

  const heuristic = (a, b) => Math.hypot(pos[a].x - pos[b].x, pos[a].y - pos[b].y);

  while (pq.length) {
    pq.sort((lhs, rhs) => lhs.f - rhs.f);
    const { id: current } = pq.shift();
    if (current === idB) {
      let cur = current;
      const out = [pos[cur]];
      while (came.has(cur)) {
        cur = came.get(cur);
        out.push(pos[cur]);
      }
      out.reverse();
      PATH_CACHE.set(cacheKey, out);
      return out;
    }
    open.delete(current);

    for (const nb of adj.get(current) || []) {
      const tentative = (g.get(current) ?? Infinity) + heuristic(current, nb);
      if (tentative < (g.get(nb) ?? Infinity)) {
        came.set(nb, current);
        g.set(nb, tentative);
        const score = tentative + heuristic(nb, idB);
        f.set(nb, score);
        if (!open.has(nb)) {
          open.add(nb);
          pq.push({ id: nb, f: score });
        }
      }
    }
  }

  return [];
}

/* ━━━ Fixed Navigation Anchors (image space 1920×1080) ━━━ */
const NAV_COORDS = {
  intro:   { x: 1632, y: 162 },
  about:   { x: 1412, y: 182 },
  work:    { x: 1496, y: 262 },
  projects:{ x: 1142, y: 332 },
  contact: { x: 1276, y: 456 },
  blog:    { x: 1338, y: 438 },
  resume:  { x:  932, y: 742 },
  skills:  { x: 1188, y: 148 }
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
const sporeCanvas  = document.getElementById('spore-canvas');
const revealCanvas = document.getElementById('reveal-canvas');
const revealCtx = revealCanvas ? revealCanvas.getContext('2d') : null;

let SPARK_RAF = 0;
let LAST_SPARK_TS = 0;
let ACTIVE_ANIMS = [];

function resizeCanvases() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (sporeCanvas) {
    sporeCanvas.width = w;
    sporeCanvas.height = h;
  }
  if (revealCanvas) {
    revealCanvas.width = w;
    revealCanvas.height = h;
  }

  ACTIVE_ANIMS = ACTIVE_ANIMS.map(anim => {
    const projected = projectPath(anim.points);
    const arc = buildCumulative(projected);
    return {
      ...anim,
      projected,
      cumulative: arc.cumulative,
      length: arc.total
    };
  });
}

function projectPath(points) {
  return points.map(p => {
    const [x, y] = toViewportCover(p.x, p.y);
    return { x, y };
  });
}

function buildCumulative(pts) {
  const cumulative = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cumulative[i] = cumulative[i - 1] + Math.hypot(dx, dy);
  }
  return { cumulative, total: cumulative[cumulative.length - 1] ?? 0 };
}

function sampleAlong(pts, cumulative, ratio) {
  if (!pts.length) return { x: 0, y: 0 };
  if (pts.length === 1 || !cumulative?.length) return { ...pts[0] };

  const total = cumulative[cumulative.length - 1] || 0;
  if (!total) return { ...pts[0] };

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const target = clampedRatio * total;

  let idx = 1;
  while (idx < cumulative.length && cumulative[idx] < target) idx++;

  const hi = Math.min(idx, pts.length - 1);
  const lo = Math.max(0, hi - 1);
  const segLen = cumulative[hi] - cumulative[lo];
  const segStart = cumulative[lo];
  const t = segLen ? (target - segStart) / segLen : 0;
  const a = pts[lo];
  const b = pts[hi];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function startSpark(fromId, toId, options = {}) {
  if (prefersReducedMotion || !GRAPH) return;

  const fromNode = NODE_IDS[fromId];
  const toNode = NODE_IDS[toId];
  if (fromNode === undefined || toNode === undefined) return;
  if (fromNode < 0 || toNode < 0) return;

  const path = aStarPath(fromNode, toNode);
  if (!path.length) return;

  const animPoints = path.map(p => ({ x: p.x, y: p.y }));
  const startAnchor = NAV_COORDS[fromId];
  const endAnchor = NAV_COORDS[toId];
  if (startAnchor) animPoints[0] = { x: startAnchor.x, y: startAnchor.y };
  if (endAnchor) animPoints[animPoints.length - 1] = { x: endAnchor.x, y: endAnchor.y };
  const projected = projectPath(animPoints);
  const arc = buildCumulative(projected);
  if (!arc.total) return;

  ACTIVE_ANIMS.push({
    points: animPoints,
    projected,
    cumulative: arc.cumulative,
    length: arc.total,
    t: options.reverse ? 1 : 0,
    dir: options.reverse ? -1 : 1,
    speed: options.speed ?? 420,
    size: options.size ?? 3.0,
    hue: options.hue ?? '122,174,138'
  });

  if (!SPARK_RAF) {
    LAST_SPARK_TS = performance.now();
    SPARK_RAF = requestAnimationFrame(loopSparks);
  }
}

function stopSparks() {
  ACTIVE_ANIMS = [];
  if (SPARK_RAF) {
    cancelAnimationFrame(SPARK_RAF);
    SPARK_RAF = 0;
  }
  if (revealCtx && revealCanvas) {
    revealCtx.clearRect(0, 0, revealCanvas.width, revealCanvas.height);
  }
}

function loopSparks(ts) {
  if (!revealCtx || !revealCanvas) return;

  const delta = Math.max(0, ts - LAST_SPARK_TS) / 1000;
  LAST_SPARK_TS = ts;

  revealCtx.clearRect(0, 0, revealCanvas.width, revealCanvas.height);

  const stillActive = [];

  for (const anim of ACTIVE_ANIMS) {
    const projected = anim.projected;
    if (projected.length < 2 || !anim.length) continue;

    anim.t += (anim.speed / anim.length) * delta * anim.dir;

    if ((anim.dir > 0 && anim.t >= 1) || (anim.dir < 0 && anim.t <= 0)) {
      continue;
    }

    const point = sampleAlong(projected, anim.cumulative, anim.t);

    revealCtx.save();
    revealCtx.globalCompositeOperation = 'lighter';

    revealCtx.beginPath();
    revealCtx.arc(point.x, point.y, anim.size * 4, 0, Math.PI * 2);
    revealCtx.fillStyle = `rgba(${anim.hue}, 0.18)`;
    revealCtx.fill();

    revealCtx.beginPath();
    revealCtx.arc(point.x, point.y, anim.size * 2.2, 0, Math.PI * 2);
    revealCtx.fillStyle = `rgba(${anim.hue}, 0.35)`;
    revealCtx.fill();

    revealCtx.beginPath();
    revealCtx.arc(point.x, point.y, anim.size, 0, Math.PI * 2);
    revealCtx.fillStyle = 'rgba(240,255,245,0.9)';
    revealCtx.shadowBlur = 8;
    revealCtx.shadowColor = `rgba(${anim.hue},0.85)`;
    revealCtx.fill();

    revealCtx.restore();

    stillActive.push(anim);
  }

  ACTIVE_ANIMS = stillActive;

  if (ACTIVE_ANIMS.length) {
    SPARK_RAF = requestAnimationFrame(loopSparks);
  } else {
    SPARK_RAF = 0;
  }
}

// ━━━ Navigation Hover State ━━━
let currentNavHover = null;

function handleNavEnter(id, el) {
  if (currentNavHover === id) return;
  currentNavHover = id;

  stopSparks();

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
      if (NODE_IDS[dest] === undefined || NODE_IDS[dest] < 0) continue;
      startSpark('intro', dest, { speed: 520, size: 3.2 });
    }
  } else if (NODE_IDS.intro !== undefined && NODE_IDS.intro >= 0 && NODE_IDS[id] !== undefined && NODE_IDS[id] >= 0) {
    startSpark(id, 'intro', { speed: 460, size: 3.0 });
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

  stopSparks();
}

// ━━━ Spores Layer (ambient) ━━━
let sporeCtx = null;
let spores = [];
let lastSporeFrame = 0;

function createSpores() {
  if (!sporeCanvas || !sporeCtx) return;
  const count = window.innerWidth < 768 ? 30 : 50;
  spores = new Array(count).fill(0).map(() => ({
    x: Math.random() * sporeCanvas.width,
    y: Math.random() * sporeCanvas.height,
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
  const w = sporeCanvas.width;
  const h = sporeCanvas.height;
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
  sporeCtx = sporeCanvas.getContext('2d');
  if (!sporeCtx) return;
  createSpores();

  function loop(ts) {
    drawSpores(ts);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

resizeCanvases();
startSpores();

window.addEventListener('resize', () => {
  resizeCanvases();
  placeNavLabels();
  createSpores();
}, { passive: true });

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
