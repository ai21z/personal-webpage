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

// ━━━ HUD Toggle ━━━
let hudEnabled = new URLSearchParams(window.location.search).has('hud');
let hudCanvas = null;
let hudCtx = null;

// ━━━ Background Geometry (Image Space) ━━━
const BG_NATURAL_W = 1920;
const BG_NATURAL_H = 1080;

let cover = { s: 1, dx: 0, dy: 0 };

function computeCoverTransform() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.max(vw / BG_NATURAL_W, vh / BG_NATURAL_H);
  cover.s = s;
  cover.dx = (vw - BG_NATURAL_W * s) * 0.5;
  cover.dy = (vh - BG_NATURAL_H * s) * 0.5;
}

function coverMap(x, y) {
  return [x * cover.s + cover.dx, y * cover.s + cover.dy];
}

function toViewportCover(x, y) {
  return coverMap(x, y);
}

// ━━━ Mycelium Geometry System (Exported from Python) ━━━
let MYC_MAP = null; // {seed, width, height, paths, junctions}

/**
 * Load exported geometry JSON and preload background image.
 */
async function loadMycelium() {
  const response = await fetch('artifacts/network.json');
  MYC_MAP = await response.json();
  console.log(`✅ Loaded ${MYC_MAP.paths.length} paths, ${MYC_MAP.junctions.length} junctions`);
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

/* --- DESIGN ANCHORS (1920×1080 reference) --- */
const NAV_COORDS = {
  intro:   { x: 1610, y: 177 },
  about:   { x: 1466, y: 179 },
  work:    { x: 1463, y: 275 },
  projects:{ x: 1170, y: 404 },
  contact: { x: 1524, y: 411 },
  blog:    { x: 1624, y: 429 },
  resume:  { x:  1432, y: 637 },
  skills:  { x:  1119, y: 240 }
};

const NAV_ORDER = ['intro','about','work','projects','contact','blog','resume','skills'];

const LABEL_OFFSET_PX = {
  intro: 34, about: 26, work: 24, projects: 22,
  contact: 24, blog: 26, resume: 20, skills: 24
};

const NODE_IDS = {}; // id -> graph node index
const NAV_OFFSETS = {}; // id -> {nx, ny} in image space

function computeNavOffsets(){
  if (!MYC_MAP || !MYC_MAP.paths) return;
  const cx = BG_NATURAL_W/2, cy = BG_NATURAL_H/2;

  for (const [id, {x:px, y:py}] of Object.entries(NAV_COORDS)){
    let bestD2 = Infinity, nx = 0, ny = 0;

    for (const path of MYC_MAP.paths){
      if (!path || path.length < 2) continue;
      for (let i=0;i<path.length-1;i++){
        const [ax,ay] = path[i], [bx,by] = path[i+1];
        const abx=bx-ax, aby=by-ay, ab2=abx*abx+aby*aby;
        if (ab2 < 1e-6) continue;

        const t = Math.max(0, Math.min(1, ((px-ax)*abx + (py-ay)*aby)/ab2));
        const cxp = ax + t*abx, cyp = ay + t*aby;
        const dx = px - cxp, dy = py - cyp, d2 = dx*dx + dy*dy;
        if (d2 < bestD2){
          bestD2 = d2;
          const len = Math.sqrt(ab2);
          nx = -aby/len; ny = abx/len; // left normal
          // make normal point away from canvas center
          const vx = px - cx, vy = py - cy;
          if (nx*vx + ny*vy < 0){ nx = -nx; ny = -ny; }
        }
      }
    }

    const mag = LABEL_OFFSET_PX[id] ?? 22;
    NAV_OFFSETS[id] = { nx: nx*mag, ny: ny*mag };
  }
}

function showSection(sectionName) {
  const sections = document.querySelectorAll('.stage');
  sections.forEach(s => s.classList.toggle('active-section', s.dataset.section === sectionName));
  
  document.querySelectorAll('.network-node-label, .network-sigil-node').forEach(label =>
    label.classList.toggle('active', label.dataset.section === sectionName)
  );
}

function createNavLabel(id) {
  const label = document.createElement('a');
  label.dataset.node = id;
  label.dataset.section = id;
  label.className = 'network-node-label';
  const anchorId = id === 'intro' ? 'main' : id;
  label.href = `#${anchorId}`;
  label.innerHTML = `<span class="node-label">${id}</span>`;
  label.setAttribute('aria-label', `Navigate to ${id}`);
  return label;
}

function createSigilNode() {
  const sigil = document.createElement('button');
  sigil.dataset.node = 'intro';
  sigil.dataset.section = 'intro';
  sigil.className = 'network-sigil-node';
  sigil.setAttribute('role', 'button');
  sigil.setAttribute('aria-label', 'Open intro');
  sigil.innerHTML = '<img src="./artifacts/sigil/AZ-VZ-01.png" alt="" width="64" height="64">';
  return sigil;
}

function layoutNavNodes() {
  const nav = document.getElementById('network-nav');
  if (!nav) return;

  if (nav.children.length === 0) {
    const frag = document.createDocumentFragment();
    for (const id of NAV_ORDER) {
      if (id === 'intro') {
        const sigil = createSigilNode();
        sigil.addEventListener('click', () => {
          document.getElementById('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          ritualCascade();
        });
        sigil.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            ritualCascade();
          }
        });
        frag.appendChild(sigil);
      } else {
        const label = createNavLabel(id);
        label.addEventListener('click', (event) => {
          const targetStage = document.querySelector(`.stage[data-section="${id}"]`);
          if (targetStage) {
            event.preventDefault();
            showSection(id);
            targetStage.focus?.({ preventScroll: false });
          }
        });
        frag.appendChild(label);
      }
    }
    nav.appendChild(frag);
  }

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    const el = nav.querySelector(`[data-node="${id}"]`);
    if (!el) continue;

    const [ax, ay] = coverMap(pt.x, pt.y);
    const off = NAV_OFFSETS[id] || { nx:0, ny:0 };
    const [ox, oy] = coverMap(pt.x + off.nx, pt.y + off.ny);

    // snap to pixels to avoid blur
    const left = Math.round(ax) + 0.5;
    const top  = Math.round(ay) + 0.5;
    let tx = Math.round(ox - ax);
    let ty = Math.round(oy - ay);

    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
    // IMPORTANT: keep the -50% centering and add our delta
    el.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px)`;

    // Avoid collision with portrait (only for blog)
    if (id === 'blog') {
      const target = el.getBoundingClientRect();
      const face = document.querySelector('.portrait-wrap')?.getBoundingClientRect();
      if (face && !(target.right < face.left || target.left > face.right || target.bottom < face.top || target.top > face.bottom)) {
        // nudge along normal in viewport space
        let step = 0, tx2 = tx, ty2 = ty;
        const [nox1, noy1] = coverMap(pt.x + off.nx + 4, pt.y + off.ny + 4);
        const [nox0, noy0] = coverMap(pt.x + off.nx, pt.y + off.ny);
        const ndx = Math.sign((nox1 - nox0) || 0), ndy = Math.sign((noy1 - noy0) || 0);
        while (step++ < 8) {
          tx2 += 4*ndx; ty2 += 4*ndy;
          el.style.transform = `translate(-50%, -50%) translate(${tx2}px, ${ty2}px)`;
          const r = el.getBoundingClientRect();
          if (r.right < face.left || r.left > face.right || r.bottom < face.top || r.top > face.bottom) break;
        }
      }
    }
  }

  if (hudEnabled) renderHUD();
}

// ━━━ HUD Rendering ━━━
function initHUD() {
  if (!hudCanvas) {
    hudCanvas = document.createElement('canvas');
    hudCanvas.id = 'hud-canvas';
    hudCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(hudCanvas);
    hudCtx = hudCanvas.getContext('2d');
  }
  hudCanvas.width = window.innerWidth;
  hudCanvas.height = window.innerHeight;
}

function renderHUD() {
  if (!hudEnabled) return;
  if (!hudCtx) initHUD();

  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    const [tx, ty] = coverMap(pt.x, pt.y);
    
    hudCtx.fillStyle = '#fff';
    hudCtx.beginPath();
    hudCtx.arc(tx, ty, 4, 0, Math.PI * 2);
    hudCtx.fill();
    
    hudCtx.fillStyle = '#fff';
    hudCtx.font = '10px monospace';
    hudCtx.fillText(`${id} (${Math.round(tx)},${Math.round(ty)})`, tx + 8, ty - 8);

    const off = NAV_OFFSETS[id] || {nx:0, ny:0};
    const [lx, ly] = coverMap(pt.x + off.nx, pt.y + off.ny);
    hudCtx.strokeStyle = 'rgba(0,255,255,.35)';
    hudCtx.beginPath(); 
    hudCtx.moveTo(tx,ty); 
    hudCtx.lineTo(lx,ly); 
    hudCtx.stroke();
    hudCtx.fillStyle = '#0ff'; 
    hudCtx.beginPath(); 
    hudCtx.arc(lx, ly, 3, 0, Math.PI*2); 
    hudCtx.fill();

    const el = document.querySelector(`[data-node="${id}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      
      hudCtx.fillStyle = '#0f0';
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, 3, 0, Math.PI * 2);
      hudCtx.fill();
      
      hudCtx.fillStyle = '#0f0';
      hudCtx.fillText(`live (${Math.round(cx)},${Math.round(cy)})`, cx + 8, cy + 16);

      const dx = cx - lx, dy = cy - ly;
      const drift = Math.hypot(dx, dy);
      if (drift > 2) console.warn(`HUD drift ${id}: ${drift.toFixed(1)}px`);
    }
  }
}

function toggleHUD() {
  hudEnabled = !hudEnabled;
  if (hudEnabled) {
    initHUD();
    renderHUD();
  } else if (hudCanvas) {
    hudCanvas.remove();
    hudCanvas = null;
    hudCtx = null;
  }
}

// ━━━ Spark Animation State ━━━
let sparkCanvas = document.getElementById('reveal-canvas') || document.getElementById('spark-canvas');
if (!sparkCanvas) {
  sparkCanvas = document.createElement('canvas');
  sparkCanvas.id = 'spark-canvas';
  sparkCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
  document.body.appendChild(sparkCanvas);
}
const sparkCtx = sparkCanvas.getContext('2d');

const sporeCanvas = document.getElementById('spore-canvas');
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

const MAX_SPARKS = 12;
const loggedPathFailures = new Set();

function startSpark(fromKey, toKey, speedPxPerSec = 650) {
  if (prefersReducedMotion || !GRAPH) return;
  if (ACTIVE_ANIMS.length >= MAX_SPARKS) ACTIVE_ANIMS.shift();

  const fromAnchor = NAV_COORDS[fromKey];
  const toAnchor = NAV_COORDS[toKey];
  if (!fromAnchor || !toAnchor) return;

  let idA = NODE_IDS[fromKey];
  let idB = NODE_IDS[toKey];
  
  // Recompute NODE_IDS if invalid
  if (idA == null || idB == null || idA < 0 || idB < 0) {
    for (const [id, pt] of Object.entries(NAV_COORDS)) {
      NODE_IDS[id] = GRAPH.nearestId(pt.x, pt.y, 80, 24);
    }
    idA = NODE_IDS[fromKey];
    idB = NODE_IDS[toKey];
  }

  if (idA == null || idB == null || idA < 0 || idB < 0) {
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
    s: 0,
    v: speedPxPerSec
  });
}

let cascadeAnims = [];
let cascadeActive = false;

function ritualCascade() {
  if (prefersReducedMotion) {
    document.querySelectorAll('.network-node-label, .network-sigil-node').forEach(n => {
      n.classList.add('motion-highlight');
      setTimeout(() => n.classList.remove('motion-highlight'), 200);
    });
    return;
  }
  if (cascadeActive) return;
  cascadeActive = true;
  cascadeAnims = [];

  if (!GRAPH || !MYC_MAP) {
    cascadeActive = false;
    return;
  }

  const visited = new Set();
  const queue = [];
  for (const id of GRAPH.nodes.keys()) {
    queue.push({ id, depth: 0 });
  }

  const edges = [];
  visited.clear();
  for (let i = 0; i < queue.length; i++) {
    const { id, depth } = queue[i];
    if (visited.has(id)) continue;
    visited.add(id);

    for (const nb of GRAPH.neighbors(id)) {
      if (!visited.has(nb)) {
        edges.push({ from: id, to: nb, depth });
      }
    }
  }

  edges.forEach((edge, idx) => {
    const delay = (edge.depth * 30) + (idx % 5) * 15;
    setTimeout(() => {
      const fromPt = GRAPH.nodes[edge.from];
      const toPt = GRAPH.nodes[edge.to];
      if (!fromPt || !toPt) return;

      const pathImg = [fromPt, toPt];
      const proj = projectXY(pathImg);
      const cum = cumulativeLengths(proj);
      const len = cum[cum.length - 1];
      if (!len) return;

      cascadeAnims.push({
        projPts: proj,
        cum,
        len,
        s: 0,
        v: 800,
        alpha: 0.15 + Math.random() * 0.1
      });
    }, delay);
  });

  setTimeout(() => {
    cascadeActive = false;
    cascadeAnims = [];
  }, 1800);
}

function drawCascade(dt) {
  if (!cascadeActive || cascadeAnims.length === 0) return;

  const survivors = [];
  for (const anim of cascadeAnims) {
    anim.s += anim.v * dt;
    if (anim.s > anim.len) continue;

    const head = pointAt(anim.projPts, anim.cum, anim.s);
    const tail = pointAt(anim.projPts, anim.cum, Math.max(0, anim.s - 40));

    sparkCtx.save();
    sparkCtx.lineCap = 'round';

    sparkCtx.strokeStyle = `rgba(143,180,255,${anim.alpha * 0.5})`;
    sparkCtx.lineWidth = 12;
    sparkCtx.shadowBlur = 24;
    sparkCtx.shadowColor = `rgba(143,180,255,${anim.alpha * 0.3})`;
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    sparkCtx.strokeStyle = `rgba(194,74,46,${anim.alpha * 0.3})`;
    sparkCtx.lineWidth = 6;
    sparkCtx.shadowBlur = 16;
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    sparkCtx.restore();
    survivors.push(anim);
  }
  cascadeAnims = survivors;
}

function drawSparks(dt) {
  if (!sparkCtx || !sparkCanvas) return;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  sparkCtx.clearRect(0, 0, cssW, cssH);

  drawCascade(dt);

  const trailLen = 60;
  const survivors = [];

  for (const anim of ACTIVE_ANIMS) {
    anim.s += anim.v * dt;
    if (anim.s > anim.len) continue;

    const head = pointAt(anim.projPts, anim.cum, anim.s);
    const tail = pointAt(anim.projPts, anim.cum, Math.max(0, anim.s - trailLen));

    sparkCtx.save();
    sparkCtx.lineCap = 'round';
    sparkCtx.lineJoin = 'round';

    sparkCtx.strokeStyle = 'rgba(143,180,255,0.2)';
    sparkCtx.lineWidth = 8;
    sparkCtx.shadowBlur = 20;
    sparkCtx.shadowColor = 'rgba(143,180,255,0.4)';
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    sparkCtx.strokeStyle = 'rgba(122,174,138,0.6)';
    sparkCtx.lineWidth = 4;
    sparkCtx.shadowBlur = 12;
    sparkCtx.shadowColor = 'rgba(122,174,138,0.7)';
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

    sparkCtx.fillStyle = 'rgba(200,255,220,1)';
    sparkCtx.shadowBlur = 12;
    sparkCtx.shadowColor = 'rgba(200,255,220,0.8)';
    sparkCtx.beginPath();
    sparkCtx.arc(head[0], head[1], 2.8, 0, Math.PI * 2);
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
  if (hudEnabled && hudCanvas) {
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
  }
  layoutNavNodes();

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
    document.querySelectorAll('.network-node-label, .network-sigil-node').forEach(node => node.classList.remove('motion-highlight'));
    el.classList.add('motion-highlight');
    if (id !== 'intro') {
      const introEl = document.querySelector('.network-sigil-node[data-node="intro"], .network-node-label[data-node="intro"]');
      introEl?.classList.add('motion-highlight');
    }
    return;
  }

  if (id === 'intro') {
    let delay = 0;
    for (const dest of NAV_ORDER) {
      if (dest === 'intro') continue;
      setTimeout(() => startSpark('intro', dest, 700), delay);
      delay += 50 + Math.random() * 50;
    }
  } else {
    startSpark(id, 'intro', 700);
  }
}

function handleNavLeave(id, el) {
  if (currentNavHover !== id) return;
  currentNavHover = null;

  if (prefersReducedMotion) {
    el.classList.remove('motion-highlight');
    if (id !== 'intro') {
      const introEl = document.querySelector('.network-sigil-node[data-node="intro"], .network-node-label[data-node="intro"]');
      introEl?.classList.remove('motion-highlight');
    }
  } else {
    ACTIVE_ANIMS = [];
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
  computeNavOffsets();                 // AFTER graph built
  PATH_CACHE.clear();

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    NODE_IDS[id] = GRAPH.nearestId(pt.x, pt.y, 80, 24);
  }

  const introId = NODE_IDS.intro;
  if (introId != null && introId >= 0) {
    for (const [id, gid] of Object.entries(NODE_IDS)) {
      if (id === 'intro' || gid == null || gid < 0) continue;
      aStarPath(introId, gid); // warm both ways
      aStarPath(gid, introId);
    }
  }

  layoutNavNodes();
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadMycelium().catch(err => console.warn('⚠️ network.json unavailable:', err));
  await initNetworkAndNav();

  const nav = document.getElementById('network-nav');
  if (nav) {
    nav.querySelectorAll('.network-node-label, .network-sigil-node').forEach(el => {
      const id = el.dataset.node;
      el.addEventListener('pointerenter', () => handleNavEnter(id, el));
      el.addEventListener('pointerleave', () => handleNavLeave(id, el));
      el.addEventListener('focus', () => handleNavEnter(id, el));
      el.addEventListener('blur', () => handleNavLeave(id, el));
    });
  }

  layoutNavNodes();
  showSection('intro');
  resizeAll();

  if (hudEnabled) {
    initHUD();
    renderHUD();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'H') toggleHUD();
  });
});

// ━━━ Post-load layout (fonts & image settling) ━━━
window.addEventListener('load', () => {
  computeCoverTransform();
  computeNavOffsets();
  layoutNavNodes();
  if (hudEnabled) renderHUD();
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
