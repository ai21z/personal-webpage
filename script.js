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
    const response = await fetch('artifacts/fungi_network_map.json');
    MYC_MAP = await response.json();
    console.log(`✅ Loaded ${MYC_MAP.paths.length} paths, ${MYC_MAP.junctions.length} junctions`);
    
    BG_IMG = new Image();
    await new Promise((resolve, reject) => {
      BG_IMG.onload = resolve;
      BG_IMG.onerror = reject;
      BG_IMG.src = 'artifacts/fungi_network_bg.jpg';
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

// ━━━ Layout Navigation Nodes Using Exported Junctions ━━━
function layoutNavNodes() {
  if (!MYC_MAP) {
    console.warn('⚠️ Mycelium geometry not loaded yet');
    return;
  }
  
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  const tablet = window.matchMedia('(max-width: 1200px)').matches;
  const labelSize = mobile 
    ? { w: 64, h: 24 } 
    : tablet 
    ? { w: 120, h: 28 } 
    : { w: 140, h: 28 };

  // viewport-fraction zones (tweak to taste)
  const ZONES = [
    { key: 'intro',    cx: 0.73, cy: 0.58, rx: 0.08, ry: 0.08 },
    { key: 'about',    cx: 0.76, cy: 0.30, rx: 0.10, ry: 0.08 },
    { key: 'projects', cx: 0.68, cy: 0.46, rx: 0.10, ry: 0.08 },
    { key: 'blog',     cx: 0.56, cy: 0.64, rx: 0.10, ry: 0.08 }
  ];

  let spots = pickNavByZones(ZONES, labelSize);

  // fallback to scoring picker if zones couldn't place all
  if (spots.length < NAV_SECTIONS.length) {
    const missing = NAV_SECTIONS.length - spots.length;
    const extra = pickNavFromJunctions(missing, labelSize);
    spots = spots.concat(extra.slice(0, missing));
  }
  
  const nav = document.getElementById('network-nav');
  if (!nav) return;
  nav.innerHTML = '';
  NAV_GROUPS.clear();

  spots.forEach((spot, i) => {
    const cfg = NAV_SECTIONS[i];
    if (!cfg) return;
    
    const nodeIdx = i;
    
    // Find paths near this junction
    const nearbyPaths = findPathsNearJunction(spot.junction, 120);
    NAV_GROUPS.set(nodeIdx, { 
      junction: spot.junction, 
      nearbyPaths,
      x: spot.centerX,
      y: spot.centerY,
      section: cfg.section
    });
    
    const btn = document.createElement('button');
    btn.className = 'network-node-label';
    btn.style.left = `${spot.centerX}px`;
    btn.style.top = `${spot.centerY}px`;
    btn.dataset.section = cfg.section;
    btn.dataset.nodeIdx = nodeIdx;
    btn.setAttribute('aria-label', `Go to ${cfg.section}`);
    btn.textContent = cfg.section; // lowercase text only
    
    btn.addEventListener('click', () => showSection(cfg.section));
    btn.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter' || e.key === ' ') { 
        e.preventDefault(); 
        showSection(cfg.section); 
      } 
    });
    
    // Hover/focus triggers highlight
    btn.addEventListener('mouseenter', () => { HIGHLIGHT.activeIdx = nodeIdx; });
    btn.addEventListener('mouseleave', () => { HIGHLIGHT.activeIdx = null; });
    btn.addEventListener('focus', () => { HIGHLIGHT.activeIdx = nodeIdx; });
    btn.addEventListener('blur', () => { HIGHLIGHT.activeIdx = null; });

    if (cfg.section === 'intro') btn.classList.add('active');

    nav.appendChild(btn);
    requestAnimationFrame(() => btn.classList.add('visible'));
  });

  console.log(`✅ Placed ${spots.length} navigation nodes on junctions`);
}

// ━━━ Canvas: Ambient Spores + Branch Reveal Highlights ━━━
const canvas = document.getElementById('network-canvas');
if (canvas && !prefersReducedMotion) {
  const ctx = canvas.getContext('2d');
  let spores = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createSpores();
    computeCover(); // Recalculate cover transform on canvas resize
  }

  function createSpores() {
    spores = [];
    const count = window.innerWidth < 768 ? 15 : 25;
    for (let i = 0; i < count; i++) {
      spores.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.25 + 0.05,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
  }

  function updateSpores() {
    for (const s of spores) {
      s.x = (s.x + s.speedX + canvas.width) % canvas.width;
      s.y = (s.y + s.speedY + canvas.height) % canvas.height;
    }
  }

  function drawSpores(time) {
    for (const s of spores) {
      const p = Math.sin(time * 0.001 + s.pulsePhase) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(122, 174, 138, ${s.opacity * p})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mouse detection: check proximity to exported paths
  document.addEventListener('mousemove', (e) => {
    HIGHLIGHT.mouse.x = e.clientX;
    HIGHLIGHT.mouse.y = e.clientY;
    
    if (!MYC_MAP || HIGHLIGHT.activeIdx !== null) return;
    
    // Convert viewport coords to image space
    const imgX = (e.clientX - cover.dx) / cover.s;
    const imgY = (e.clientY - cover.dy) / cover.s;
    
    // Find closest path
    let bestIdx = null;
    let bestDist = 22; // Tolerance in viewport px
    
    for (const [nodeIdx, group] of NAV_GROUPS) {
      for (const pathIdx of group.nearbyPaths) {
        const path = MYC_MAP.paths[pathIdx];
        
        for (let i = 0; i < path.length - 1; i++) {
          const [x1, y1] = path[i];
          const [x2, y2] = path[i + 1];
          
          // Transform to viewport space
          const vx1 = x1 * cover.s + cover.dx;
          const vy1 = y1 * cover.s + cover.dy;
          const vx2 = x2 * cover.s + cover.dx;
          const vy2 = y2 * cover.s + cover.dy;
          
          const d = distToSeg(e.clientX, e.clientY, vx1, vy1, vx2, vy2);
          
          if (d < bestDist) {
            bestDist = d;
            bestIdx = nodeIdx;
          }
        }
      }
    }
    
    HIGHLIGHT.activeIdx = bestIdx;
  });

  /**
   * Draw brightened branches using exported geometry with halo ring.
   */
  function drawReveal(time) {
    if (!MYC_MAP || !BG_IMG || HIGHLIGHT.activeIdx === null) return;
    
    const group = NAV_GROUPS.get(HIGHLIGHT.activeIdx);
    if (!group || !group.nearbyPaths.length) return;
    
    ctx.save();
    
    // Draw mask along active paths
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'white';
    
    for (const pathIdx of group.nearbyPaths) {
      const path = MYC_MAP.paths[pathIdx];
      ctx.beginPath();
      
      const [x0, y0] = path[0];
      ctx.moveTo(x0 * cover.s + cover.dx, y0 * cover.s + cover.dy);
      
      for (let i = 1; i < path.length; i++) {
        const [x, y] = path[i];
        ctx.lineTo(x * cover.s + cover.dx, y * cover.s + cover.dy);
      }
      
      ctx.stroke();
    }
    
    // Draw brightened image only where mask exists
    ctx.globalCompositeOperation = 'source-in';
    ctx.filter = 'brightness(1.85) saturate(1.15)';
    ctx.drawImage(BG_IMG, cover.dx, cover.dy, MYC_MAP.width * cover.s, MYC_MAP.height * cover.s);
    ctx.filter = 'none';
    
    // Halo ring with pulse
    ctx.globalCompositeOperation = 'lighter';
    const t = time * 0.004;
    const pulse = (Math.sin(t) * 0.5 + 0.5);
    const ringRadius = 12 + (22 - 12) * pulse;
    
    // Soft glow
    const g = ctx.createRadialGradient(group.x, group.y, 0, group.x, group.y, 84);
    g.addColorStop(0, 'rgba(63,255,159,0.28)');
    g.addColorStop(1, 'rgba(63,255,159,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(group.x, group.y, 84, 0, Math.PI * 2);
    ctx.fill();
    
    // Crisp pulsing ring
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = 'rgba(63,255,159,0.9)';
    ctx.arc(group.x, group.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }

  function animate(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateSpores();
    drawSpores(time);
    drawReveal(time);
    requestAnimationFrame(animate);
  }

  resizeCanvas();
  window.addEventListener('resize', () => {
    clearTimeout(window.__hz);
    window.__hz = setTimeout(() => {
      resizeCanvas();
      computeCover(); // Recalculate cover transform
    }, 120);
  });
  animate(0);
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
