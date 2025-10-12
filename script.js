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
let cover = { s: 1, dx: 0, dy: 0 }; // CSS background-size:cover transform
const NAV_GROUPS = new Map(); // nodeIndex → {junction, nearbyPaths}
let HIGHLIGHT = { activeIdx: null, mouse: {x:-1, y:-1} };

/**
 * Compute CSS background-size:cover transform for responsive scaling.
 */
function computeCover() {
  if (!MYC_MAP) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const imgW = MYC_MAP.width;
  const imgH = MYC_MAP.height;
  
  const scaleW = vw / imgW;
  const scaleH = vh / imgH;
  const s = Math.max(scaleW, scaleH);
  
  const scaledW = imgW * s;
  const scaledH = imgH * s;
  
  const dx = (vw - scaledW) / 2;
  const dy = (vh - scaledH) / 2;
  
  cover = { s, dx, dy };
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
    
    computeCover();
  } catch (err) {
    console.error('❌ Failed to load mycelium geometry:', err);
  }
}

// ━━━ Distance to Line Segment (for hover detection) ━━━
function distToSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  const qx = ax + t * vx, qy = ay + t * vy;
  return Math.hypot(px - qx, py - qy);
}

// ━━━ Navigation System ━━━
const NAV_SECTIONS = [
  { section: 'intro'    },
  { section: 'about'    },
  { section: 'projects' },
  { section: 'blog'     },
];

function showSection(sectionName) {
  const sections = document.querySelectorAll('.stage');
  sections.forEach(s => s.classList.toggle('active-section', s.dataset.section === sectionName));
  
  document.querySelectorAll('.network-node-label').forEach(label =>
    label.classList.toggle('active', label.dataset.section === sectionName)
  );
}

/**
 * Strategic node picker: root + top→bottom sorted majors
 */
function pickStrategicNodes() {
  const js = MYC_MAP.junctions;
  if (!js || !js.length) return [];

  // Prefer lower-right as root
  const root = js.reduce((best, j) => {
    const score = (j.x / MYC_MAP.width) * 0.65 + (j.y / MYC_MAP.height) * 0.35 + j.r * 0.02 - j.depth * 0.02;
    return (!best || score > best._score) ? { ...j, _score: score } : best;
  }, null);

  // Far junctions as majors
  const far = js
    .filter(j => {
      const dx = j.x - root.x, dy = j.y - root.y, d = Math.hypot(dx, dy);
      return d > Math.min(MYC_MAP.width, MYC_MAP.height) * 0.25 && j.depth <= 6;
    })
    .map(j => ({ ...j, _d: Math.hypot(j.x - root.x, j.y - root.y) }))
    .sort((a, b) => b._d - a._d);

  // Pick three majors with vertical separation
  const majors = [];
  for (const j of far) {
    if (majors.length === 3) break;
    if (majors.every(k => Math.abs(k.y - j.y) > MYC_MAP.height * 0.12)) majors.push(j);
  }
  
  // Fallback if needed
  while (majors.length < 3) majors.push(far[majors.length] || root);

  // Sort by Y (top→bottom): about, projects, blog
  majors.sort((a, b) => a.y - b.y);

  return [root, ...majors];
}

function findNearbyPaths(j, r = 140) {
  const out = [];
  for (let i = 0; i < MYC_MAP.paths.length; i++) {
    const path = MYC_MAP.paths[i];
    for (const [x, y] of path) {
      const d = Math.hypot(x - j.x, y - j.y);
      if (d <= r) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/**
 * Zone-based picker: finds junctions within specified viewport zones.
 */
function pickNavByZones(zones, labelSize) {
  if (!MYC_MAP || !MYC_MAP.junctions.length) return [];

  const toView = (j) => ({ x: j.x * cover.s + cover.dx, y: j.y * cover.s + cover.dy });
  const avoid = getAvoidRects();
  const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

  const picks = [];

  for (const z of zones) {
    const target = { x: z.cx * window.innerWidth, y: z.cy * window.innerHeight };
    let best = null, bestScore = Infinity;

    for (const j of MYC_MAP.junctions) {
      const v = toView(j);
      if (v.x < 0 || v.x > window.innerWidth || v.y < 0 || v.y > window.innerHeight) continue;

      const inside = (
        v.x >= (target.x - z.rx * window.innerWidth) &&
        v.x <= (target.x + z.rx * window.innerWidth) &&
        v.y >= (target.y - z.ry * window.innerHeight) &&
        v.y <= (target.y + z.ry * window.innerHeight)
      );

      const dist = d2(v, target);
      const depthBonus = Math.max(0, 6 - (j.depth ?? 999)) * 1e3;
      const radiusBonus = (j.r ?? 1) * 2e3;
      const outsidePenalty = inside ? 0 : 2e6;
      const score = dist - radiusBonus - depthBonus + outsidePenalty;

      const box = { x: v.x - labelSize.w / 2, y: v.y - labelSize.h / 2, w: labelSize.w, h: labelSize.h };
      const overlapsContent = avoid.some(r => boxesOverlap(box, r, 12));
      const overlapsOther = picks.some(p => boxesOverlap(box, p, 28));

      if (!overlapsContent && !overlapsOther && score < bestScore) {
        best = { ...box, centerX: v.x, centerY: v.y, junction: j };
        bestScore = score;
      }
    }

    if (best) picks.push(best);
  }
  return picks;
}

/**
 * Pick best navigation node placements from exported junctions.
 * Score = radius × 3 + max(0, 6 - depth) + random(0.7)
 */
function pickNavFromJunctions(count, labelSize) {
  if (!MYC_MAP || !MYC_MAP.junctions.length) return [];
  
  const avoid = getAvoidRects();
  
  // Score junctions (larger radius + shallower depth = better)
  const scored = MYC_MAP.junctions.map(j => {
    const score = j.r * 3 + Math.max(0, 6 - j.depth) + Math.random() * 0.7;
    return { ...j, score };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  const picks = [];
  
  for (const j of scored) {
    if (picks.length >= count) break;
    
    // Transform from image space to viewport space using cover transform
    const vx = j.x * cover.s + cover.dx;
    const vy = j.y * cover.s + cover.dy;
    
    // Check if within viewport bounds
    if (vx < 0 || vx > window.innerWidth || vy < 0 || vy > window.innerHeight) continue;
    
    const box = {
      x: vx - labelSize.w / 2,
      y: vy - labelSize.h / 2,
      w: labelSize.w,
      h: labelSize.h,
      centerX: vx,
      centerY: vy,
      junction: j
    };
    
    // Check collisions
    const overlapsContent = avoid.some(r => boxesOverlap(box, r, 16));
    const overlapsOther = picks.some(p => boxesOverlap(box, p, 32));
    
    if (!overlapsContent && !overlapsOther) picks.push(box);
  }
  
  if (picks.length < count) {
    console.warn(`Only found ${picks.length}/${count} non-overlapping junction positions`);
  }
  
  return picks;
}

// ━━━ Collision Detection System ━━━

// ━━━ Content to Avoid: title, intro copy, sigil, footer, cards ━━━
function getAvoidRects() {
  const selectors = [
    '.site-title', '.name', '#intro-copy', '.intro-block',
    '.sigil-wrap', 'footer', '.card', '.bio-card', '.project-card', '.post-card'
  ];
  const rects = [];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        rects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
    });
  });
  return rects;
}

function boxesOverlap(a, b, pad = 12) {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

/**
 * Find paths near a junction (within 120px in image space).
 */
function findPathsNearJunction(junction, radiusPx = 120) {
  if (!MYC_MAP) return [];
  
  const nearby = [];
  
  for (let pathIdx = 0; pathIdx < MYC_MAP.paths.length; pathIdx++) {
    const path = MYC_MAP.paths[pathIdx];
    
    // Check if any point in path is within radius of junction
    for (const [x, y] of path) {
      const dx = x - junction.x;
      const dy = y - junction.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radiusPx) {
        nearby.push(pathIdx);
        break;
      }
    }
  }
  
  return nearby;
}

// ━━━ Layout Navigation Nodes Using Strategic Positions ━━━
function layoutNavNodes() {
  if (!MYC_MAP || !MYC_MAP.strategic) {
    console.warn('⚠️ Mycelium geometry not loaded yet');
    return;
  }

  const nav = document.getElementById('network-nav');
  if (!nav) return;
  nav.innerHTML = '';
  NAV_GROUPS.clear();

  // Use pre-calculated strategic positions from Python generator
  const cfgs = [
    { section: 'intro', node: MYC_MAP.strategic.intro },
    { section: 'about', node: MYC_MAP.strategic.about },
    { section: 'projects', node: MYC_MAP.strategic.projects },
    { section: 'blog', node: MYC_MAP.strategic.blog },
  ];

  cfgs.forEach((cfg, i) => {
    if (!cfg.node) {
      console.warn(`⚠️ Strategic node ${cfg.section} not found`);
      return;
    }

    const [vx, vy] = toViewport([cfg.node.x, cfg.node.y]);
    const nearby = findNearbyPaths(cfg.node, 160);
    const path2d = buildGroupPath(nearby);

    NAV_GROUPS.set(i, { section: cfg.section, x: vx, y: vy, path2d, nearbyPaths: nearby });

    const btn = document.createElement('button');
    btn.className = 'network-node-label';
    btn.style.left = `${vx}px`;
    btn.style.top = `${vy}px`;
    btn.dataset.section = cfg.section;
    btn.innerHTML = `<span class="node-label">${cfg.section}</span>`;
    btn.setAttribute('aria-label', `Go to ${cfg.section}`);
    
    btn.addEventListener('click', () => showSection(cfg.section));
    btn.addEventListener('mouseenter', () => setActive(i, performance.now()));
    btn.addEventListener('mouseleave', () => setActive(null, performance.now()));
    btn.addEventListener('focus', () => setActive(i, performance.now()));
    btn.addEventListener('blur', () => setActive(null, performance.now()));
    
    nav.appendChild(btn);
    requestAnimationFrame(() => btn.classList.add('visible'));
  });

  // Set intro as active by default
  document.querySelectorAll('.network-node-label').forEach(b => {
    if (b.dataset.section === 'intro') b.classList.add('active');
  });

  console.log(`✅ Placed ${cfgs.length} strategic navigation nodes`);
}

// ━━━ Shared Canvas Utilities ━━━
function toViewport([x, y]) {
  return [x * cover.s + cover.dx, y * cover.s + cover.dy];
}

function smooth(points) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i], [x2, y2] = points[i + 1];
    const mx = (x0 + x2) * 0.5, my = (y0 + y2) * 0.5;
    out.push([(x0 + 6 * x1 + x2) / 8, (y0 + 6 * y1 + y2) / 8]);
    out.push([mx, my]);
  }
  out.push(points[points.length - 1]);
  return out.filter((_, i) => i % 2 === 0);
}

function buildGroupPath(pathIdxs) {
  const p = new Path2D();
  for (const idx of pathIdxs) {
    const raw = MYC_MAP.paths[idx].map(toViewport);
    const pts = smooth(raw);
    if (!pts.length) continue;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  }
  return p;
}

// ━━━ CANVAS LAYERS (split for performance) ━━━
const sporeCanvas  = document.getElementById('spore-canvas');
const revealCanvas = document.getElementById('reveal-canvas');

// Global reference to setActive (populated by canvas init)
let setActive = null;

if (sporeCanvas && revealCanvas && !prefersReducedMotion) {
  const sporeCtx  = sporeCanvas.getContext('2d');
  const revealCtx = revealCanvas.getContext('2d');
  let spores = [];
  let ACTIVE = null;
  let lastSpore = 0;

  function sizeCanvases() {
    const w = window.innerWidth, h = window.innerHeight;
    sporeCanvas.width = w; sporeCanvas.height = h;
    revealCanvas.width = w; revealCanvas.height = h;
  }

  function createSpores() {
    // More spores for "dangerous universe mystical" atmosphere
    const count = window.innerWidth < 768 ? 30 : 50;
    spores = new Array(count).fill(0).map(() => ({
      x: Math.random() * sporeCanvas.width,
      y: Math.random() * sporeCanvas.height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: 1 + Math.random() * 3, // Larger range (1-4px)
      p: Math.random() * Math.PI * 2, // Phase offset for pulse
      a: 0.1 + Math.random() * 0.25, // Base alpha
      scalePhase: Math.random() * Math.PI * 2 // Separate phase for scaling
    }));
  }

  // Spores: ~30fps animation with scaling and glow
  function drawSpores(t) {
    if (t - lastSpore < 33) return;
    lastSpore = t;
    const c = sporeCtx, w = sporeCanvas.width, h = sporeCanvas.height;
    c.clearRect(0, 0, w, h);
    for (const s of spores) {
      s.x = (s.x + s.vx + w) % w;
      s.y = (s.y + s.vy + h) % h;
      
      // Opacity pulse
      const pulse = (Math.sin(t * 0.001 + s.p) + 1) / 2;
      
      // Scale pulse (0.8 - 1.2x)
      const scalePulse = 0.8 + 0.4 * (Math.sin(t * 0.0015 + s.scalePhase) + 1) / 2;
      const radius = s.r * scalePulse;
      
      // Draw glow halo
      c.shadowBlur = 8;
      c.shadowColor = `rgba(122,174,138,${s.a * pulse * 0.6})`;
      
      // Draw spore with necrotic green
      c.fillStyle = `rgba(122,174,138,${s.a * pulse})`;
      c.beginPath();
      c.arc(s.x, s.y, radius, 0, Math.PI * 2);
      c.fill();
      
      // Bright center for star effect
      c.shadowBlur = 0;
      c.fillStyle = `rgba(200,255,220,${s.a * pulse * 0.8})`;
      c.beginPath();
      c.arc(s.x, s.y, radius * 0.4, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Reveal: redraw only when active changes - with enhanced spore glow
  function renderReveal(time) {
    const c = revealCtx, w = revealCanvas.width, h = revealCanvas.height;
    c.clearRect(0, 0, w, h);
    if (ACTIVE === null) return;

    const group = NAV_GROUPS.get(ACTIVE);
    if (!group || !group.path2d) return;

    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    
    // Draw multiple glow layers for spore effect
    c.globalCompositeOperation = 'source-over';
    
    // Outer glow (dim spectral blue)
    c.strokeStyle = 'rgba(143,180,255,0.15)';
    c.lineWidth = 12;
    c.shadowBlur = 24;
    c.shadowColor = 'rgba(143,180,255,0.3)';
    c.stroke(group.path2d);
    
    // Mid glow (necrotic green)
    c.strokeStyle = 'rgba(122,174,138,0.3)';
    c.lineWidth = 6;
    c.shadowBlur = 16;
    c.shadowColor = 'rgba(122,174,138,0.5)';
    c.stroke(group.path2d);
    
    // Inner bright line (white core)
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2.2;
    c.shadowBlur = 8;
    c.shadowColor = '#ffffff';
    c.stroke(group.path2d);

    // Brighten only where stroke exists
    c.globalCompositeOperation = 'source-in';
    c.filter = 'brightness(2.0) saturate(1.3)';
    c.drawImage(BG_IMG, cover.dx, cover.dy, MYC_MAP.width * cover.s, MYC_MAP.height * cover.s);
    c.filter = 'none';

    // Soft glow at junction (larger, more intense)
    c.globalCompositeOperation = 'lighter';
    const R = 120;
    const grd = c.createRadialGradient(group.x, group.y, 0, group.x, group.y, R);
    grd.addColorStop(0, 'rgba(122,174,138,.45)');
    grd.addColorStop(0.5, 'rgba(63,255,159,.18)');
    grd.addColorStop(1, 'rgba(63,255,159,0)');
    c.fillStyle = grd;
    c.beginPath();
    c.arc(group.x, group.y, R, 0, Math.PI * 2);
    c.fill();

    // Pulsing ring with spore glow
    if (time) {
      c.globalCompositeOperation = 'screen';
      const pulse = (Math.sin(time * 0.004) * 0.5 + 0.5);
      const ringRadius = 16 + 12 * pulse;
      
      // Outer ring
      c.beginPath();
      c.lineWidth = 2;
      c.strokeStyle = `rgba(122,174,138,${0.6 * (1 - pulse * 0.3)})`;
      c.shadowBlur = 16;
      c.shadowColor = 'rgba(122,174,138,0.8)';
      c.arc(group.x, group.y, ringRadius, 0, Math.PI * 2);
      c.stroke();
      
      // Inner bright ring
      c.beginPath();
      c.lineWidth = 1.5;
      c.strokeStyle = 'rgba(200,255,220,0.9)';
      c.shadowBlur = 8;
      c.arc(group.x, group.y, ringRadius * 0.7, 0, Math.PI * 2);
      c.stroke();
    }

    c.restore();
  }

  function setActiveInternal(idx, time) {
    if (idx === ACTIVE) return;
    ACTIVE = idx;
    
    // Update label active state
    document.querySelectorAll('.network-node-label').forEach(b => {
      const shouldBeActive = NAV_GROUPS.get(ACTIVE)?.section === b.dataset.section;
      b.classList.toggle('active', shouldBeActive);
    });
    
    renderReveal(time);
  }
  
  // Expose to global scope
  setActive = setActiveInternal;

  // Fast Path2D hit testing
  window.addEventListener('pointermove', (e) => {
    if (!MYC_MAP) return;
    const x = e.clientX, y = e.clientY;
    
    // Check current active first
    if (ACTIVE !== null) {
      revealCtx.lineWidth = 22;
      if (revealCtx.isPointInStroke(NAV_GROUPS.get(ACTIVE).path2d, x, y)) return;
    }
    
    // Find first hit
    revealCtx.lineWidth = 22;
    let hit = null;
    for (const [idx, g] of NAV_GROUPS) {
      if (revealCtx.isPointInStroke(g.path2d, x, y)) {
        hit = idx;
        break;
      }
      // Also near junction
      if (Math.hypot(x - g.x, y - g.y) < 64) {
        hit = idx;
        break;
      }
    }
    setActiveInternal(hit, performance.now());
  }, { passive: true });

  // RAF loop: only spores animate per frame
  let animFrameTime = 0;
  function loop(t) {
    animFrameTime = t;
    drawSpores(t);
    
    // Update pulsing ring if active
    if (ACTIVE !== null) {
      renderReveal(t);
    }
    
    requestAnimationFrame(loop);
  }

  sizeCanvases();
  createSpores();
  
  window.addEventListener('resize', () => {
    clearTimeout(window.__hz);
    window.__hz = setTimeout(() => {
      sizeCanvases();
      computeCover();
      
      // Rebuild all path2d objects on resize
      for (const [idx, group] of NAV_GROUPS) {
        group.path2d = buildGroupPath(group.nearbyPaths);
      }
      
      renderReveal(animFrameTime);
    }, 120);
  });
  
  requestAnimationFrame(loop);
} else {
  // Fallback for reduced motion or missing canvas
  setActive = (idx) => {
    document.querySelectorAll('.network-node-label').forEach(b => {
      const shouldBeActive = NAV_GROUPS.get(idx)?.section === b.dataset.section;
      b.classList.toggle('active', shouldBeActive);
    });
  };
}

// ━━━ Initialize Navigation on Load ━━━
window.addEventListener('DOMContentLoaded', async () => {
  await loadMycelium();
  layoutNavNodes();
  
  // Debounced resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      computeCover();
      layoutNavNodes();
      console.log('♻️ Navigation nodes repositioned');
    }, 150);
  });
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
 * 
 * Background System:
 * - Static fungal mycelium image at #bg-fungi (z-index: 0)
 * - Optional canvas for ambient spores (z-index: 1)
 * - Content sections (z-index: 2)
 * - Navigation nodes (z-index: 100)
 * 
 * Smart Placement:
 * - Uses STARTER_ANCHORS (percent coordinates) per breakpoint
 * - Detects content element positions via getBoundingClientRect()
 * - Places nodes at first non-overlapping anchor positions
 * - Automatically adjusts on window resize
 * 
 * Accessibility:
 * - All nodes are <button> elements with ARIA labels
 * - Keyboard navigation (Tab, Enter, Space)
 * - Screen reader announcements
 * - Respects prefers-reduced-motion
 */
