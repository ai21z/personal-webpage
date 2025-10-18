/* ━━━ Necrography — Vissarion Zounarakis ━━━
 * Smart Navigation Node Placement System
 * - Static fungal mycelium background image
 * - Non-overlapping anchor-based node placement
 * - Automatic collision avoidance with content
 * - Branch-reveal highlight effect on hover
 * - Full accessibility support
 */

// ━━━ Module Imports ━━━
import { buildGraphFromPaths, aStarPath, nearestNodeId } from './js/navigation/graph.js';
import { 
  GRAPH, 
  PATH_CACHE, 
  ritualActive, 
  followerSparks, 
  COVER,
  MYC_MAP,
  setMycMap,
  setGraph,
  NODE_IDS,
  NAV_OFFSETS,
  LOCKED_ROUTES,
  setLockedRoutes,
  prefersReducedMotion,
  hudEnabled,
  hudCanvas,
  hudCtx,
  setHudCanvas
} from './js/core/state.js';
import { 
  RITUAL_RETURN_MS, 
  NAV_SPEED_WHEN_ACTIVE,
  NAV_COORDS,
  NAV_ORDER,
  LABEL_OFFSET_PX,
  LABEL_SPEEDS,
  DEFAULT_SPEED
} from './js/core/config.js';
import { 
  startSpark, 
  startSparkToPoint, 
  drawSparks, 
  ritualCascade, 
  ritualCatchUp,
  sparkCanvas,
  sparkCtx,
  resizeSparkCanvas,
  getSparkDelta
} from './js/graphics/sparks.js';
import { 
  createSpores, 
  startSpores, 
  resizeSporeCanvas,
  sporeCanvas,
  sporeCtx
} from './js/graphics/spores.js';
import { 
  sizeCanvas, 
  projectXY, 
  cumulativeLengths, 
  pointAt, 
  approach, 
  resamplePolyline, 
  projectOntoPolyline,
  computeCoverFromImage,
  coverMap,
  toViewport
} from './js/utils/geometry.js';

// ━━━ A11y: Insert current year in footer ━━━
const yearElement = document.getElementById('yr');
if (yearElement) yearElement.textContent = new Date().getFullYear();

// ━━━ State imported from modules ━━━
// prefersReducedMotion, hudEnabled, hudCanvas, hudCtx → from state.js
// COVER, MYC_MAP, GRAPH, PATH_CACHE → from state.js
// NAV_COORDS, LABEL_SPEEDS, etc. → from config.js
// coverMap, toViewport, computeCoverFromImage → from geometry.js

// ━━━ Background image reference ━━━
const bgImg = document.getElementById('bg-front-img');

/**
 * Load exported geometry JSON and preload background image.
 */
async function loadMycelium() {
  const response = await fetch('artifacts/network.json');
  const data = await response.json();
  setMycMap(data);
  console.log(`✅ Loaded ${MYC_MAP.paths.length} paths, ${MYC_MAP.junctions.length} junctions`);
}

/* ━━━ Image-Space Graph + Pathfinding ━━━ */
// Imported from js/navigation/graph.js and js/core/state.js

/* ━━━ Ritual State + Follower Lightning ━━━ */
// Imported from js/core/state.js and js/core/config.js

/* --- DESIGN ANCHORS (1920×1080 reference) --- */
// Imported from js/core/config.js

function computeNavOffsets(){
  if (!MYC_MAP || !MYC_MAP.paths) return;
  const cx = COVER.baseW/2, cy = COVER.baseH/2;

  for (const [id, {x:px, y:py}] of Object.entries(NAV_COORDS)){
    // Skip intro (sigil) - it should never have an offset
    if (id === 'intro') {
      NAV_OFFSETS[id] = { nx: 0, ny: 0 };
      continue;
    }
    
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
  // Update active section
  const sections = document.querySelectorAll('.stage');
  sections.forEach(s => s.classList.toggle('active-section', s.dataset.section === sectionName));
  
  // Update nav aria-current
  document.querySelectorAll('.network-node-label, .network-sigil-node').forEach(label =>
    {
      const isActive = label.dataset.section === sectionName;
      label.classList.toggle('active', isActive);
      if (isActive) {
        label.setAttribute('aria-current', 'page');
      } else {
        label.removeAttribute('aria-current');
      }
    }
  );
  
  // Update hash (replaceState to avoid scroll jump)
  const hashId = sectionName === 'intro' ? '' : sectionName;
  const newUrl = hashId ? `${window.location.pathname}#${hashId}` : window.location.pathname;
  history.replaceState(null, '', newUrl);
  
  // Lock body scroll for panel screens (altar-screen or panel-screen)
  const activeSection = document.querySelector(`.stage[data-section="${sectionName}"]`);
  const isPanel = activeSection?.classList.contains('panel-screen') || activeSection?.classList.contains('altar-screen');
  document.documentElement.style.overflow = isPanel ? 'hidden' : '';
  document.body.style.overflow = isPanel ? 'hidden' : '';
  
  // Toggle nav suppression + ritual background
  document.body.classList.toggle('nav-suppressed', !!isPanel);
  if (isPanel) {
    startRitualBackground();
  } else {
    stopRitualBackground();
  }
  
  // Focus the active section for accessibility
  if (activeSection && activeSection.getAttribute('tabindex') === '-1') {
    setTimeout(() => {
      activeSection.focus({ preventScroll: true });
    }, 100);
  }
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
  sigil.setAttribute('aria-label', 'Toggle ritual');
  // Image starts at 0° (no initial rotation - will rotate to 180° when clicked)
  sigil.innerHTML = '<img id="sigil" src="./artifacts/sigil/AZ-VZ-01.png" alt="" width="64" height="64">';
  return sigil;
}

function layoutNavNodes() {
  const nav = document.getElementById('network-nav');
  if (!nav) return;
  
  // Don't layout if cover isn't ready yet
  if (!COVER.ready) {
    console.warn('⚠️ layoutNavNodes: COVER not ready, skipping layout');
    return;
  }

  if (nav.children.length === 0) {
    const frag = document.createDocumentFragment();
    for (const id of NAV_ORDER) {
      if (id === 'intro') {
        const sigil = createSigilNode();
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
    wireSigilToggle(); // Wire up the ritual toggle
  }

  // Static mode = ZERO offsets, proper logging
  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    const el = nav.querySelector(`[data-node="${id}"]`);
    if (!el) continue;

    const [ax, ay] = coverMap(pt.x, pt.y);

    // Only apply branch-normal offset when ritualActive === true
    let tx = 0, ty = 0;
    if (ritualActive) {
      const off = NAV_OFFSETS[id] || { nx: 0, ny: 0 };
      const [ox, oy] = coverMap(pt.x + off.nx, pt.y + off.ny);
      tx = Math.round(ox - ax);
      ty = Math.round(oy - ay);
    }

    const left = Math.round(ax) + 0.5;
    const top = Math.round(ay) + 0.5;
    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
    
    // Labels ONLY use translate(-50%,-50%) translate(dx,dy)
    el.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px)`;
    
    // Log each label in static mode
    if (!ritualActive) {
      console.log(`📍 Static[${id}]: left=${left.toFixed(1)}px, top=${top.toFixed(1)}px, delta=(${tx},${ty})`);
    }

    // NO collision nudging in static mode
    if (ritualActive && id === 'blog') {
      const target = el.getBoundingClientRect();
      const face = document.querySelector('.portrait-wrap')?.getBoundingClientRect();
      if (face && !(target.right < face.left || target.left > face.right || target.bottom < face.top || target.top > face.bottom)) {
        // nudge along normal in viewport space
        let step = 0, tx2 = tx, ty2 = ty;
        const off = NAV_OFFSETS[id] || { nx: 0, ny: 0 };
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

// [LOCKED-ROUTE] HUD shows white anchor, cyan locked route, green live position
function renderHUD() {
  if (!hudEnabled) return;
  if (!hudCtx) initHUD();

  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    const [tx, ty] = toViewport(pt.x, pt.y);
    
    // White: design anchor
    hudCtx.fillStyle = '#fff';
    hudCtx.beginPath();
    hudCtx.arc(tx, ty, 4, 0, Math.PI * 2);
    hudCtx.fill();
    
    hudCtx.fillStyle = '#fff';
    hudCtx.font = '10px monospace';
    hudCtx.fillText(`${id} anchor`, tx + 8, ty - 8);

    // Cyan: locked route polyline
    const route = LOCKED_ROUTES[id];
    if (route && route.projPts.length > 1) {
      hudCtx.strokeStyle = 'rgba(0,255,255,.4)';
      hudCtx.lineWidth = 1;
      hudCtx.beginPath();
      hudCtx.moveTo(route.projPts[0][0], route.projPts[0][1]);
      for (let i = 1; i < route.projPts.length; i++) {
        hudCtx.lineTo(route.projPts[i][0], route.projPts[i][1]);
      }
      hudCtx.stroke();
      hudCtx.lineWidth = 1;
    }

    // Green: live label position
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

      // Check orthogonal distance to locked route
      if (route && route.projPts.length > 1) {
        let minDist = Infinity;
        for (let i = 1; i < route.projPts.length; i++) {
          const [x0, y0] = route.projPts[i - 1];
          const [x1, y1] = route.projPts[i];
          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) continue;
          
          const t = Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / (len * len)));
          const projX = x0 + t * dx;
          const projY = y0 + t * dy;
          const dist = Math.hypot(cx - projX, cy - projY);
          minDist = Math.min(minDist, dist);
        }
        
        if (minDist > 8) {
          console.warn(`[LOCKED-ROUTE] HUD: ${id} label is ${minDist.toFixed(1)}px off its route (should be <8px)`);
        }
      }
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
// Now imported from js/graphics/sparks.js

// ━━━ Spore Animation State ━━━
// Now imported from js/graphics/spores.js

// ━━━ Utility functions ━━━
// Imported from js/utils/geometry.js: sizeCanvas, projectXY, cumulativeLengths, pointAt, approach

// ━━━ Spark Functions ━━━
// Now imported from js/graphics/sparks.js

function sparkLoop(ts) {
  const dt = getSparkDelta(ts);
  updateMovingLabels(dt); // Move labels along their branch tails
  drawSparks(dt);
  requestAnimationFrame(sparkLoop);
}

function resizeAll() {
  if (!COVER.ready) return; // Don't resize until image is loaded
  computeCoverFromImage(bgImg);
  resizeSparkCanvas();
  resizeSporeCanvas();
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

  // [LOCKED-ROUTE] Reproject locked routes (keep imgPts unchanged, only update projPts/cum/len)
  for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
    const projPts = projectXY(route.imgPts);
    const cum = cumulativeLengths(projPts);
    const len = cum[cum.length - 1];
    
    // Preserve s ratio and update boundaries
    const sRatio = route.len > 0 ? route.s / route.len : 0.5;
    const sHomeRatio = route.len > 0 ? route.sHome / route.len : 0.5;
    
    route.projPts = projPts;
    route.cum = cum;
    route.len = len;
    route.sMin = 24;
    route.sMax = len - 24;
    route.s = Math.max(route.sMin, Math.min(route.sMax, sRatio * len));
    route.sHome = Math.max(route.sMin, Math.min(route.sMax, sHomeRatio * len));
  }

  if (sporeCtx) createSpores();
}

// Wait for background image before ANY layout or initialization
function initAfterImageLoad() {
  if (!bgImg) {
    console.error('❌ bgImg element not found!');
    return;
  }
  
  console.log(`🖼️ Background image loaded: ${bgImg.naturalWidth}×${bgImg.naturalHeight}px`);
  
  // Compute cover using naturalWidth/naturalHeight
  if (!computeCoverFromImage(bgImg)) {
    console.error('❌ Failed to compute cover from image');
    return;
  }
  
  computeNavOffsets(); // Compute offsets with proper base dimensions
  
  // First layout now happens AFTER image loads
  layoutNavNodes();
  
  console.log(`✅ Initial layout complete — ritual is ${ritualActive ? 'ACTIVE' : 'OFF'}`);
  
  // Now safe to do full resize setup
  sizeCanvas(sparkCanvas);
  sizeCanvas(sporeCanvas);
  if (sporeCtx) createSpores();
  
  // Start animation loops
  requestAnimationFrame(sparkLoop);
  startSpores();
}

// GATE all initialization on image load
if (bgImg) {
  if (!bgImg.complete) {
    console.log(`⏳ Waiting for background image to load...`);
    bgImg.addEventListener('load', initAfterImageLoad, { once: true });
  } else if (bgImg.naturalWidth > 0) {
    // Already loaded
    console.log(`✅ Background image already loaded`);
    initAfterImageLoad();
  } else {
    console.warn('⚠️ Background image complete but no naturalWidth, waiting for load event');
    bgImg.addEventListener('load', initAfterImageLoad, { once: true });
  }
} else {
  console.error('❌ #bg-front-img element not found in DOM');
}

// Keep updated on resize
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resizeAll, 80);
}, { passive: true });

// ━━━ Navigation Hover State ━━━
let currentNavHover = null;

/* ━━━ Ritual Toggle (Sigil) — P0 FIX #3, #4 ━━━ */
function toggleRitualFromSigil(el){
  ritualActive = !ritualActive;
  
  // Apply rotation to CHILD img#sigil only (not parent .network-sigil-node)
  // Simple toggle: 0° when off, 180° when on
  const img = el.querySelector('img#sigil');
  if (img) {
    img.style.transform = `rotate(${ritualActive ? 180 : 0}deg)`;
    img.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
  } else {
    console.warn('⚠️ img#sigil not found in sigil node');
  }

  // spore burst at sigil center
  const r = el.getBoundingClientRect();
  simpleParticles(r.left + r.width/2, r.top + r.height/2);

  // Proper ritual gating with logging
  if (ritualActive){
    startRitualMotion();
    attachFollowerSparks();
    console.log(`🔮 Ritual ACTIVATED (ritualActive=${ritualActive}) — ${followerSparks.length} follower sparks attached, rotation=180°`);
  } else {
    stopRitualMotion();
    detachFollowerSparks();
    sendLightningHome(); // one quick, zippy home ping per nav
    console.log(`🔮 Ritual DEACTIVATED (ritualActive=${ritualActive}) — labels returning to anchors, rotation=0°`);
  }
  
  // Update layout to apply/remove offsets immediately
  layoutNavNodes();
}

function wireSigilToggle(){
  const sigil = document.querySelector('.network-sigil-node');
  const sigilImg = sigil ? sigil.querySelector('img#sigil') : null;
  
  // Debug check for proper DOM structure
  console.log('Sigil elements found:', { 
    sigilWrap: !!sigil, 
    sigilImg: !!sigilImg,
    sigilClass: sigil?.className,
    imgId: sigilImg?.id 
  });
  
  if (!sigil) {
    console.warn('⚠️ .network-sigil-node not found — toggle will not work');
    return;
  }
  if (!sigilImg) {
    console.warn('⚠️ img#sigil not found inside .network-sigil-node — rotation will not work');
  }
  
  sigil.addEventListener('click', () => toggleRitualFromSigil(sigil));
  sigil.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter'){
      e.preventDefault();
      toggleRitualFromSigil(sigil);
    }
  });
  console.log('✅ Sigil toggle wired — click to activate ritual');
}

function attachFollowerSparks(){
  followerSparks = [];
  for (const [id] of Object.entries(LOCKED_ROUTES)){
    if (id === 'intro') continue;
    followerSparks.push({ id, alpha: 0.85 });
  }
}
function detachFollowerSparks(){ followerSparks = []; }

function sendLightningHome(){
  for (const [id] of Object.entries(LOCKED_ROUTES)){
    if (id === 'intro') continue;
    startSpark('intro', id, 900); // quick home ping
  }
}

function startRitualMotion(){
  for (const route of Object.values(LOCKED_ROUTES)){
    if (!route) continue;
    
    // FIX: Pick initial direction based on position within route bounds
    // If closer to sMin, go forward (+1); if closer to sMax, go backward (-1)
    const distToMin = Math.abs(route.s - route.sMin);
    const distToMax = Math.abs(route.s - route.sMax);
    
    if (distToMin < distToMax) {
      route.dir = 1; // Start moving toward sMax
    } else {
      route.dir = -1; // Start moving toward sMin
    }
  }
}

function stopRitualMotion(){
  // Reset all routes back to home position (anchor)
  // This ensures next activation starts from anchors, not from where they stopped
  for (const route of Object.values(LOCKED_ROUTES)){
    if (!route) continue;
    route.s = route.sHome;
  }
  console.log('🏠 Routes reset to home positions (anchors)');
}

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
      
      setTimeout(() => {
        // If ritual is active, spark to current position on route
        if (ritualActive) {
          const route = LOCKED_ROUTES[dest];
          if (route && route.len >= 60) {
            // Get current VIEWPORT position on route (not image space)
            const [vpX, vpY] = pointAtRoute(route, route.s);
            
            // Convert back to image space for startSparkToPoint
            // Inverse of coverMap: (vp - dx) / s = img
            const imgX = (vpX - COVER.dx) / COVER.s;
            const imgY = (vpY - COVER.dy) / COVER.s;
            
            startSparkToPoint('intro', imgX, imgY, 700);
          } else {
            // Fallback to anchor if route is too short or missing
            startSpark('intro', dest, 700);
          }
        } else {
          // Static mode: spark to anchor
          startSpark('intro', dest, 700);
        }
      }, delay);
      
      delay += 50 + Math.random() * 50;
    }
  } else {
    // When hovering a label, spark back to intro
    // If ritual is active, use current position
    if (ritualActive) {
      const route = LOCKED_ROUTES[id];
      if (route && route.len >= 60) {
        const [vpX, vpY] = pointAtRoute(route, route.s);
        
        // Convert viewport back to image space
        const imgX = (vpX - COVER.dx) / COVER.s;
        const imgY = (vpY - COVER.dy) / COVER.s;
        
        startSparkToPoint(id, NAV_COORDS.intro.x, NAV_COORDS.intro.y, 700);
      } else {
        startSpark(id, 'intro', 700);
      }
    } else {
      startSpark(id, 'intro', 700);
    }
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
// Now imported from js/graphics/spores.js

// ━━━ [LOCKED-ROUTE] Stable Single-Branch Label Motion ━━━
// resamplePolyline and projectOntoPolyline imported from js/utils/geometry.js

// [LOCKED-ROUTE] Slice polyline by arc-length window [sStart, sEnd]
function slicePolylineByS(poly, sStart, sEnd) {
  if (!poly || poly.length < 2) return poly;
  
  const result = [];
  let cumS = 0;
  
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    
    if (i === 0) {
      // Check if start point is within window
      if (cumS >= sStart) result.push([x0, y0]);
      continue;
    }
    
    const [x1, y1] = poly[i - 1];
    const segLen = Math.hypot(x0 - x1, y0 - y1);
    const segEnd = cumS + segLen;
    
    // Segment overlaps [sStart, sEnd]?
    if (segEnd >= sStart && cumS <= sEnd) {
      // Add start interpolation if needed
      if (result.length === 0 && cumS < sStart) {
        const t = (sStart - cumS) / segLen;
        result.push([
          x1 + (x0 - x1) * t,
          y1 + (y0 - y1) * t
        ]);
      }
      
      // Add endpoint if within window
      if (cumS >= sStart && cumS <= sEnd) {
        result.push([x0, y0]);
      }
      
      // Add end interpolation if we've passed sEnd
      if (segEnd > sEnd && cumS < sEnd) {
        const t = (sEnd - cumS) / segLen;
        result.push([
          x1 + (x0 - x1) * t,
          y1 + (y0 - y1) * t
        ]);
        break;
      }
    }
    
    cumS = segEnd;
    if (cumS > sEnd) break;
  }
  
  return result.length >= 2 ? result : poly;
}

// --- LOCKED BRANCH ROUTES (robust branch-walking system) ---
const MIN_ROUTE_LEN_PX     = 320;  // generous travel
const MAX_ROUTE_LEN_PX     = 900;  // don't span the whole canvas
const RESAMPLE_STEP_PX     = 18;   // output spacing in pixels
const RESAMPLE_MIN_POINTS  = 64;   // guarantee enough samples

const LOCKED = new Map(); // id -> {imgPts, projPts, cum, len, s, dir, speed}

const hyp = (a,b) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (id)   => (GRAPH.neighbors(id) || []).length;

/** Walk off tiny spurs: if start is a leaf, climb until a junction (deg!=2). */
function climbToSpine(id, prev = null, maxHops = 80) {
  let a = prev, b = id, hops = 0;
  while (hops++ < maxHops) {
    const nbs = GRAPH.neighbors(b).filter(n => n !== a);
    if (nbs.length !== 1) break; // stop at leaf(0) or junction(>=2)
    a = b; b = nbs[0];
  }
  return b;
}

/** BFS in geodesic length; optionally forbid the first hop from src. */
function farthestLeafFrom(src, forbidFirstHop = -1) {
  const q = [src];
  const dist   = new Map([[src, 0]]);
  const parent = new Map();
  const firstHop = new Map();

  while (q.length) {
    const u = q.shift();
    for (const v of GRAPH.neighbors(u)) {
      if (u === src && v === forbidFirstHop) continue;
      if (!dist.has(v)) {
        const w = hyp(GRAPH.nodes[u], GRAPH.nodes[v]);
        dist.set(v, dist.get(u) + w);
        parent.set(v, u);
        firstHop.set(v, firstHop.get(u) ?? v);
        q.push(v);
      }
    }
  }

  let best = src, bestD = -1;
  for (const [v, d] of dist) if (d > bestD) { best = v; bestD = d; }
  return { leaf: best, parent, dist, firstHop };
}

function rebuildPath(parent, end) {
  const out = [];
  for (let v = end; v != null; v = parent.get(v)) out.push(GRAPH.nodes[v]);
  return out.reverse();
}

/** Slice a polyline to a centered window (by arc-length) around the anchor. */
function trimAroundAnchor(imgPts, maxLenPx, anchor) {
  const proj = imgPts.map(p => [p.x, p.y]);
  const cum  = cumulativeLengths(proj);
  const total = cum[cum.length - 1];

  // index of poly point closest to anchor
  const idx = proj.reduce((best, p, i) =>
    (Math.hypot(p[0]-anchor.x, p[1]-anchor.y) <
     Math.hypot(proj[best][0]-anchor.x, proj[best][1]-anchor.y)) ? i : best
  , 0);

  const centerS = cum[idx];
  const half = maxLenPx / 2;
  const s0 = Math.max(0, centerS - half);
  const s1 = Math.min(total, centerS + half);

  // turn window into points
  const out = [];
  const steps = Math.max(2, Math.round((s1 - s0) / RESAMPLE_STEP_PX));
  for (let i = 0; i <= steps; i++) {
    const s = s0 + (i * (s1 - s0)) / steps;
    out.push(pointAt(proj, cum, s));
  }
  return { imgPts: out.map(([x,y]) => ({ x, y })), len: s1 - s0 };
}

function resampleToViewport(imgPts) {
  // Project to viewport, then resample to uniform spacing with a minimum count.
  const screenPts = projectXY(imgPts);
  const cum = cumulativeLengths(screenPts);
  const len = cum[cum.length - 1];
  const N = Math.max(RESAMPLE_MIN_POINTS, Math.ceil(len / RESAMPLE_STEP_PX));
  const out = [];
  for (let i = 0; i < N; i++) {
    const s = (len * i) / (N - 1);
    out.push(pointAt(screenPts, cum, s));
  }
  return { projPts: out, cum: cumulativeLengths(out), len };
}

function computeLockedRouteFor(id, anchor) {
  // Wider radius + finer step, with retry on failure
  let start = GRAPH.nearestId(anchor.x, anchor.y, /*radius*/ 160, /*step*/ 12);
  
  // Retry with wider radius if first attempt failed
  if (start < 0) {
    console.warn(`⚠️ [LOCKED-ROUTE] ${id}: nearestId failed at r=160, retrying with r=240`);
    start = GRAPH.nearestId(anchor.x, anchor.y, /*radius*/ 240, /*step*/ 12);
  }
  
  if (start < 0) {
    console.error(`❌ [LOCKED-ROUTE] ${id}: nearestId failed even with r=240`);
    return null;
  }

  // If on a tiny twig, walk to a spine before evaluating both directions.
  if (deg(start) <= 1) start = climbToSpine(start);

  // Two directions from the spine: pick two farthest leaves on distinct sides.
  const A = farthestLeafFrom(start);
  const avoid = A.firstHop.get(A.leaf) ?? -1;
  const B = farthestLeafFrom(start, avoid);

  let left  = rebuildPath(A.parent, A.leaf);
  let right = rebuildPath(B.parent, B.leaf);

  // Ensure both include the spine as their first point.
  const spine = GRAPH.nodes[start];
  const eq = (p,q) => p.x === q.x && p.y === q.y;
  while (left.length  && !eq(left[0], spine))  left.shift();
  while (right.length && !eq(right[0], spine)) right.shift();

  // Build a long, continuous branch passing through the anchor's spine.
  const raw = [...left.reverse(), spine, ...right.slice(1)];

  // Limit window around the anchor so movement is generous but not crazy.
  const trimmed = trimAroundAnchor(raw, MAX_ROUTE_LEN_PX, anchor);

  // Guarantee enough samples to move smoothly.
  const sampled = resampleToViewport(trimmed.imgPts);
  if (sampled.projPts.length < 2) {
    console.error(`❌ [LOCKED-ROUTE] ${id}: resample produced < 2 points`);
    return null;
  }

  // Enforce minimum length (target 140-240px)
  if (sampled.len < MIN_ROUTE_LEN_PX) {
    console.warn(`⚠️ [LOCKED-ROUTE] ${id}: route too short (${sampled.len.toFixed(1)}px < ${MIN_ROUTE_LEN_PX}px)`);
    return { ...sampled, imgPts: trimmed.imgPts, len: sampled.len, tooShort: true };
  }
  
  return { ...sampled, imgPts: trimmed.imgPts };
}

// Helper: Find arc-length on route closest to a viewport point
function findClosestSOnRoute(route, vpX, vpY) {
  let bestS = 0;
  let bestDist = Infinity;
  
  for (let i = 0; i < route.projPts.length; i++) {
    const [x, y] = route.projPts[i];
    const dist = Math.hypot(x - vpX, y - vpY);
    if (dist < bestDist) {
      bestDist = dist;
      bestS = route.cum[i];
    }
  }
  
  return bestS;
}

function buildLockedRoutes() {
  LOCKED.clear();
  console.log('\n=== Building Locked Routes ===');
  
  for (const [id, anchor] of Object.entries(NAV_COORDS)) {
    if (id === 'intro') continue; // sigil stays static
    
    const route = computeLockedRouteFor(id, anchor);
    if (!route) {
      console.warn(`❌ [LOCKED-ROUTE] ${id}: failed; fallback to static anchor`);
      LOCKED.set(id, null);
      continue;
    }
    
    const pointsCount = route.projPts?.length || 0;
    
    // Log route quality with clear criteria
    if (route.tooShort || route.len < 140 || pointsCount < 3) {
      console.warn(`⚠️ [LOCKED-ROUTE] ${id}: len=${route.len.toFixed(1)}px, points=${pointsCount} (BELOW TARGET: want 140-240px, ≥3 points)`);
    } else {
      console.log(`✅ [LOCKED-ROUTE] ${id}: len=${route.len.toFixed(1)}px, points=${pointsCount}`);
    }
    
    // Find the arc-length position on route closest to the anchor
    // This is where labels START (sHome) and where they are in static mode
    const [anchorX, anchorY] = coverMap(anchor.x, anchor.y);
    const sHome = findClosestSOnRoute(route, anchorX, anchorY);
    
    // Add animation state with safe margins (sMin/sMax)
    const MIN_S = 24;
    const MAX_S = Math.max(MIN_S + 1, route.len - 24);
    
    // Clamp sHome to safe bounds
    const clampedHome = Math.max(MIN_S, Math.min(MAX_S, sHome));
    
    route.s = clampedHome; // Start at anchor position
    route.sHome = clampedHome; // Where it returns when ritual is off
    route.sMin = MIN_S;
    route.sMax = MAX_S;
    route.dir = 1;
    route.speed = LABEL_SPEEDS[id] ?? DEFAULT_SPEED;
    
    console.log(`  📍 ${id}: sHome=${clampedHome.toFixed(1)} (closest to anchor on route)`);
    
    LOCKED.set(id, route);
  }
  
  // Copy to LOCKED_ROUTES for compatibility with existing code
  LOCKED_ROUTES = {};
  for (const [id, route] of LOCKED) {
    if (route) LOCKED_ROUTES[id] = route;
  }
  
  console.log(`=== Locked ${Object.keys(LOCKED_ROUTES).length} routes ===\n`);
}

// Alias for backward compatibility
const lockNavRoutes = buildLockedRoutes;

// [LOCKED-ROUTE] Interpolate position along locked route
function pointAtRoute(route, s) {
  if (s <= 0) return [route.projPts[0][0], route.projPts[0][1]];
  if (s >= route.len) {
    const last = route.projPts[route.projPts.length - 1];
    return [last[0], last[1]];
  }
  
  let lo = 0, hi = route.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route.cum[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  
  const i = Math.max(1, lo);
  const segStart = route.cum[i - 1];
  const segLen = Math.max(1e-6, route.cum[i] - segStart);
  const t = (s - segStart) / segLen;
  
  const [x0, y0] = route.projPts[i - 1];
  const [x1, y1] = route.projPts[i];
  
  return [
    x0 + (x1 - x0) * t,
    y0 + (y1 - y0) * t
  ];
}

// [LOCKED-ROUTE] Get image-space point at current s
function imgPointAtRoute(route, s) {
  if (s <= 0) return [route.imgPts[0].x, route.imgPts[0].y];
  if (s >= route.len) {
    const last = route.imgPts[route.imgPts.length - 1];
    return [last.x, last.y];
  }
  
  let lo = 0, hi = route.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route.cum[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  
  const i = Math.max(1, lo);
  const segStart = route.cum[i - 1];
  const segLen = Math.max(1e-6, route.cum[i] - segStart);
  const t = (s - segStart) / segLen;
  
  const pt0 = route.imgPts[i - 1];
  const pt1 = route.imgPts[i];
  
  return [
    pt0.x + (pt1.x - pt0.x) * t,
    pt0.y + (pt1.y - pt0.y) * t
  ];
}

// [LOCKED-ROUTE] Update label positions along locked routes (P0 FIX #4, #6, #7)
function updateMovingLabels(dt) {
  if (prefersReducedMotion) return; // PRM: freeze motion globally
  
  // CRITICAL FIX: Only run this when ritual is ACTIVE
  // Static labels are positioned by layoutNavNodes() ONLY
  if (!ritualActive) return;
  
  const nav = document.getElementById('network-nav');
  if (!nav) return;
  
  // Iterate over what's actually locked (not a static list)
  for (const id of Object.keys(LOCKED_ROUTES)) {
    const route = LOCKED_ROUTES[id];
    if (!route || route.len < 60) continue; // too short → stay static (no jitter)
    
    // Get anchor position in viewport using coverMap
    const anchor = NAV_COORDS[id];
    if (!anchor) continue;
    const [anchorX, anchorY] = coverMap(anchor.x, anchor.y);
    
    // Ritual active: oscillate along the route
    route.speed = NAV_SPEED_WHEN_ACTIVE;
    route.s += route.dir * route.speed * dt;

    if (route.s >= route.sMax){ route.s = route.sMax; route.dir = -1; }
    if (route.s <= route.sMin){ route.s = route.sMin; route.dir =  1; }
    
    // Recompute position using SAME locked route (uses coverMap internally)
    const [px, py] = pointAtRoute(route, route.s);
    
    // Position element with delta from anchor
    const el = nav.querySelector(`[data-node="${id}"]`);
    if (!el) continue;
    
    const dx = Math.round(px - anchorX);
    const dy = Math.round(py - anchorY);
    el.style.left = `${anchorX}px`;
    el.style.top = `${anchorY}px`;
    
    // P0 FIX #7: Labels ONLY use translate(-50%,-50%) translate(dx,dy)
    el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
  }
}

// [LOCKED-ROUTE] Spark to current label position
// [LOCKED-ROUTE] Spark functions now imported from js/graphics/sparks.js

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

  // [LOCKED-ROUTE] Lock each label to a single polyline (never re-snap)
  lockNavRoutes();

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

  // Honor hash on load, or default to intro
  const hash = window.location.hash.slice(1);
  const validSections = ['intro', 'about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills'];
  const initialSection = validSections.includes(hash) ? hash : 'intro';
  console.log(`🎯 Page Load: hash="${hash}", showing section="${initialSection}"`);
  showSection(initialSection);

  if (hudEnabled) {
    initHUD();
    renderHUD();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'H') toggleHUD();
  });

  // Initialize ritual background system
  initRitualBackground();
});

// ━━━ Post-load layout (fonts & image settling) ━━━
window.addEventListener('load', () => {
  // Ensure cover is recomputed after all assets settle
  if (COVER.ready) {
    computeCoverFromImage(bgImg);
    computeNavOffsets();
    layoutNavNodes();
    if (hudEnabled) renderHUD();
  }
});

// ━━━ Glitch Text Effect Setup ━━━
const glitchElements = document.querySelectorAll('.glitch-text');
glitchElements.forEach(el => {
  el.setAttribute('data-text', el.textContent);
});

// ━━━ Removed duplicate sigil handler (using wireSigilToggle() instead) ━━━

/**
 * Simple Particle Effect (kept for use by toggleRitualFromSigil)
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

// ━━━ Debug Helper (Console Command) ━━━
window.verifyAlignment = function() {
  console.log('\n=== ALIGNMENT VERIFICATION ===');
  console.log(`Ritual Active: ${ritualActive}`);
  console.log(`Cover Ready: ${COVER.ready}`);
  console.log(`Base Dimensions: ${COVER.baseW}×${COVER.baseH}`);
  console.log(`Transform: scale=${COVER.s.toFixed(4)}, offset=(${COVER.dx.toFixed(2)}, ${COVER.dy.toFixed(2)})`);
  console.log('\nLabel Positions:');
  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    const el = document.querySelector(`[data-node="${id}"]`);
    if (!el) continue;
    const [ax, ay] = toViewport(pt.x, pt.y);
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = centerX - ax;
    const deltaY = centerY - ay;
    const route = LOCKED_ROUTES[id];
    console.log(`  ${id.padEnd(10)}: anchor=(${ax.toFixed(1)}, ${ay.toFixed(1)}), center=(${centerX.toFixed(1)}, ${centerY.toFixed(1)}), delta=(${deltaX.toFixed(1)}, ${deltaY.toFixed(1)})${route ? `, route=${route.len.toFixed(0)}px` : ''}`);
  }
  console.log('\nRun this command after load and after toggling ritual to verify alignment.\n');
};

// ━━━ Hash change listener (back/forward navigation) ━━━
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1);
  const validSections = ['intro', 'about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills'];
  if (validSections.includes(hash)) {
    showSection(hash);
  } else if (!hash) {
    showSection('intro');
  }
});

// ━━━ Back button handler (for altar screens) ━━━
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="go-intro"]');
  if (!btn) return;
  e.preventDefault();
  showSection('intro');
});

// ━━━ About: Paper focus (zoom to center + backdrop dim) ━━━
initAboutPaperFocus();
initSkillsPaperFocus();
initPaperHoverRing();

/**
 * initAboutPaperFocus
 * 
 * Click (or Enter/Space) on an About "paper" zooms it to center and darkens the rest.
 * ESC or clicking the backdrop closes it.
 */
function initAboutPaperFocus(){
  initPaperFocusForSection('about');
}

/**
 * initSkillsPaperFocus
 * 
 * Click (or Enter/Space) on a Skills "paper" zooms it to center and darkens the rest.
 * ESC or clicking the backdrop closes it.
 */
function initSkillsPaperFocus(){
  initPaperFocusForSection('skills');
}

/**
 * Generic paper focus for altar sections
 */
function initPaperFocusForSection(sectionId){
  const section = document.getElementById(sectionId);
  if (!section) return;
  // Remove any old, scoped overlays (they caused the rectangle issue)
  section.querySelectorAll('.paper-overlay')?.forEach(n=>n.remove());

  const backdrop = document.getElementById('paper-backdrop');
  if (!backdrop) {
    console.warn('⚠️ paper-backdrop not found');
    return;
  }
  
  const papers = section.querySelectorAll('.paper');
  papers.forEach(p => {
    // ensure focusable for keyboard users
    if (!p.hasAttribute('tabindex')) p.setAttribute('tabindex','0');
    
    p.addEventListener('click', () => {
      // Toggle: if this paper is already open, close it; otherwise open it
      if (p.classList.contains('paper-open')) {
        closePaper();
      } else {
        openPaper(p);
      }
    });
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (p.classList.contains('paper-open')) {
          closePaper();
        } else {
          openPaper(p);
        }
      }
    });
  });
  
  backdrop.addEventListener('click', closePaper);
  
  function onEsc(e){ if (e.key === 'Escape') closePaper(); }
  
  function openPaper(el){
    if (document.body.classList.contains('has-paper-open-global')) return;
    // Freeze current pixels before portaling
    const r = el.getBoundingClientRect();
    el.__portal = { parent: el.parentNode, placeholder: document.createComment('paper-pl') };
    el.__portal.parent.insertBefore(el.__portal.placeholder, el.nextSibling);
    // Move to <body> so fixed positioning uses viewport (avoids rectangle/backdrop bugs)
    document.body.appendChild(el);
    el.classList.add('paper-open');
    el.style.position = 'fixed';
    el.style.left = `${r.left}px`;
    el.style.top  = `${r.top}px`;
    el.style.width  = `${r.width}px`;
    el.style.height = `${r.height}px`;
    
    // Start with transform at 0 (paper at original position)
    el.style.setProperty('--open-tx', '0px');
    el.style.setProperty('--open-ty', '0px');
    el.style.setProperty('--open-scale', '1');
    
    // Compute center translation and scale to fit
    const vw = window.innerWidth, vh = window.innerHeight;
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const tx = (vw/2) - cx;
    const ty = (vh/2) - cy;
    const fitW = (vw * 0.86) / r.width;
    const fitH = (vh * 0.80) / r.height;
    const scale = Math.min(fitW, fitH, 2.4);
    
    // Animate to magnified state in next frame
    requestAnimationFrame(() => {
      el.style.setProperty('--open-tx', `${tx}px`);
      el.style.setProperty('--open-ty', `${ty}px`);
      el.style.setProperty('--open-scale', `${scale}`);
    });
    
    // Accessibility + backdrop
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    document.body.classList.add('has-paper-open-global');
    requestAnimationFrame(() => el.focus({ preventScroll:true }));
    document.addEventListener('keydown', onEsc);
    // Hide hover ring while opened
    document.body.classList.remove('hovering-paper');
  }
  
  function closePaper(){
    const openEl = document.querySelector('.paper-open');
    if (openEl){
      // animate back to wall
      openEl.style.setProperty('--open-tx','0px');
      openEl.style.setProperty('--open-ty','0px');
      openEl.style.setProperty('--open-scale','1');
      const cleanup = () => {
        openEl.classList.remove('paper-open');
        openEl.removeAttribute('role');
        openEl.removeAttribute('aria-modal');
        openEl.style.position = '';
        openEl.style.left = '';
        openEl.style.top = '';
        openEl.style.width = '';
        openEl.style.height = '';
        openEl.style.removeProperty('--open-tx');
        openEl.style.removeProperty('--open-ty');
        openEl.style.removeProperty('--open-scale');
        // restore into original DOM position
        if (openEl.__portal){
          openEl.__portal.parent.insertBefore(openEl, openEl.__portal.placeholder);
          openEl.__portal.placeholder.remove();
          openEl.__portal = null;
        }
        openEl.removeEventListener('transitionend', cleanup);
      };
      openEl.addEventListener('transitionend', cleanup);
    }
    document.body.classList.remove('has-paper-open-global');
    document.removeEventListener('keydown', onEsc);
  }
}

// ───────────────────────── Breathing Ring Around Cursor (paper hover) ─────────────────────────
/**
 * Thin breathing ring around your existing glowing cursor while papers are hoverable
 */
function initPaperHoverRing(){
  const ring = document.getElementById('cursor-ring');
  if (!ring) return;
  
  // Track cursor position smoothly using RAF for 60fps updates
  let currentX = 0, currentY = 0;
  let targetX = 0, targetY = 0;
  let rafId = null;
  
  const updatePosition = () => {
    // Smooth interpolation for buttery movement
    currentX += (targetX - currentX) * 1.0; // 1.0 = instant (no lag)
    currentY += (targetY - currentY) * 1.0;
    
    ring.style.left = currentX + 'px';
    ring.style.top = currentY + 'px';
    
    rafId = requestAnimationFrame(updatePosition);
  };
  
  // Start the animation loop
  updatePosition();
  
  // Update target position on mouse move
  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  }, { passive: true });
  
  // Show ring when hovering clickable papers (not when one is already open)
  const about = document.getElementById('about');
  if (!about) return;
  
  about.addEventListener('mouseenter', (e) => {
    if (e.target.closest('.paper') && !document.body.classList.contains('has-paper-open-global')) {
      document.body.classList.add('hovering-paper');
    }
  }, true);
  
  about.addEventListener('mouseleave', (e) => {
    if (e.target.closest('.paper')) {
      document.body.classList.remove('hovering-paper');
    }
  }, true);
}

// ───────────────────────── Ritual Background (panel mode) ─────────────────────────
let SIGNALS = {
  canvas: null,
  ctx: null,
  raf: 0,
  interval: 0,
  pulses: [],  // moving fronts along edges or radial rays
  spores: [],  // drifting dots
  lastTs: 0
};

function initRitualBackground(){
  const c = document.getElementById('signals-canvas') || createSignalsCanvas();
  SIGNALS.canvas = c;
  SIGNALS.ctx = c.getContext('2d');
  const resize = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.floor(c.clientWidth * dpr);
    c.height = Math.floor(c.clientHeight * dpr);
    SIGNALS.ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  window.addEventListener('resize', resize, { passive: true });
  resize();
}
function createSignalsCanvas(){
  const c = document.createElement('canvas');
  c.id = 'signals-canvas';
  c.className = 'signals-canvas';
  c.setAttribute('aria-hidden','true');
  document.body.appendChild(c);
  return c;
}

function getSigilEl(){
  return document.querySelector('.network-sigil-node, .sigil, #sigil, [data-sigil]') || null;
}
function getSigilCenter(){
  const el = getSigilEl();
  if (!el) return { x: window.innerWidth/2, y: window.innerHeight/2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2 };
}

function startRitualBackground(){
  // Spin sigil continuously
  const sigil = getSigilEl();
  if (sigil) sigil.classList.add('sigil-spin');

  // Start animation loop (idempotent)
  if (!SIGNALS.raf) {
    SIGNALS.lastTs = performance.now();
    const loop = (ts) => {
      SIGNALS.raf = requestAnimationFrame(loop);
      const dt = (ts - SIGNALS.lastTs) / 1000;
      SIGNALS.lastTs = ts;
      renderSignals(dt);
    };
    SIGNALS.raf = requestAnimationFrame(loop);
  }
  // Fire a first burst soon, then repeat every 2–3s
  triggerLightningBurst();
  if (!SIGNALS.interval) {
    SIGNALS.interval = setInterval(() => {
      triggerLightningBurst();
    }, 2000 + Math.random()*1000);
  }
}
function stopRitualBackground(){
  const sigil = getSigilEl();
  if (sigil) sigil.classList.remove('sigil-spin', 'sigil-kick');
  if (SIGNALS.interval) { clearInterval(SIGNALS.interval); SIGNALS.interval = 0; }
  if (SIGNALS.raf) { cancelAnimationFrame(SIGNALS.raf); SIGNALS.raf = 0; }
  SIGNALS.pulses.length = 0;
  SIGNALS.spores.length = 0;
  if (SIGNALS.ctx) SIGNALS.ctx.clearRect(0,0,SIGNALS.canvas.width, SIGNALS.canvas.height);
}

// Try to use real graph edges if available; otherwise radial rays fallback
function collectEdges(){
  const candidates = [
    window.MYCELIUM?.links, window.MYCELIUM?.edges,
    window.graph?.links, window.__network?.links, window.NETWORK?.links
  ].find(Boolean);
  const nodes = (window.MYCELIUM?.nodes || window.graph?.nodes || window.__network?.nodes || window.NETWORK?.nodes) || [];
  if (!candidates || !nodes.length) return null;
  const byId = new Map(nodes.map(n => [n.id ?? n.name ?? n.i, n]));
  // Map to screen coords if your renderer maintains node.screenX/Y; else use x/y
  return candidates
    .map(e => {
      const a = byId.get(e.source?.id ?? e.source ?? e.a ?? e.from);
      const b = byId.get(e.target?.id ?? e.target ?? e.b ?? e.to);
      if (!a || !b) return null;
      const ax = a.screenX ?? a.x ?? a.cx ?? a.fx ?? 0;
      const ay = a.screenY ?? a.y ?? a.cy ?? a.fy ?? 0;
      const bx = b.screenX ?? b.x ?? b.cx ?? b.fx ?? 0;
      const by = b.screenY ?? b.y ?? b.cy ?? b.fy ?? 0;
      return { ax, ay, bx, by };
    })
    .filter(Boolean);
}

function triggerLightningBurst(){
  // micro kick on the sigil
  const sigil = getSigilEl();
  if (sigil) {
    sigil.classList.remove('sigil-kick'); // restart animation
    void sigil.offsetWidth;
    sigil.classList.add('sigil-kick');
  }
  const center = getSigilCenter();
  const edges = collectEdges();
  if (edges) {
    // Create a traveling front along every edge outward from center
    // We sort edges by their min distance to center so the cascade looks radial.
    const ranked = edges.map(e => {
      const mx = (e.ax + e.bx)*0.5, my = (e.ay + e.by)*0.5;
      const d = Math.hypot(mx - center.x, my - center.y);
      return { ...e, d };
    }).sort((a,b)=>a.d-b.d);
    const t0 = performance.now()/1000;
    ranked.forEach((e, i) => {
      SIGNALS.pulses.push({
        type: 'edge',
        ax: e.ax, ay: e.ay, bx: e.bx, by: e.by,
        // stagger start by distance for wave effect
        start: t0 + i*0.006,
        speed: 2200,   // px/s of front progression
        life: 0.35     // how long the glow lingers
      });
    });
  } else {
    // Fallback: 180 radial rays (additive)
    const t0 = performance.now()/1000;
    for (let i=0;i<180;i++){
      const a = (i/180)*Math.PI*2;
      const r = Math.max(window.innerWidth, window.innerHeight) * 0.66;
      SIGNALS.pulses.push({
        type: 'ray',
        x: center.x, y: center.y,
        tx: center.x + Math.cos(a)*r,
        ty: center.y + Math.sin(a)*r,
        start: t0 + i*0.0025,
        speed: 2600,
        life: 0.28
      });
    }
  }
  // Spawn spores peeling off the sigil
  for (let i=0;i<24;i++){
    const ang = Math.random()*Math.PI*2;
    const v = 30 + Math.random()*90; // px/s
    SIGNALS.spores.push({
      x: center.x, y: center.y,
      vx: Math.cos(ang)*v, vy: Math.sin(ang)*v,
      t: 0, life: 1.4 + Math.random()*0.6
    });
  }
}

function renderSignals(dt){
  const ctx = SIGNALS.ctx; if (!ctx) return;
  const w = SIGNALS.canvas.clientWidth, h = SIGNALS.canvas.clientHeight;
  // Fade trail (additive-soft persistence)
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(0,0,w,h);

  // Draw pulses
  ctx.globalCompositeOperation = 'lighter';
  const now = performance.now()/1000;
  const pulses = SIGNALS.pulses;
  for (let i=pulses.length-1; i>=0; i--){
    const p = pulses[i];
    const age = now - p.start;
    if (age < 0) continue;
    if (age > p.life + 0.6) { pulses.splice(i,1); continue; }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (p.type === 'edge'){
      // front progress [0..1]
      const segLen = Math.hypot(p.bx - p.ax, p.by - p.ay);
      const prog = Math.min(1, (age * p.speed) / segLen);
      const bx = p.ax + (p.bx - p.ax)*prog;
      const by = p.ay + (p.by - p.ay)*prog;
      const glow = Math.max(0, 1 - (age / (p.life+0.0001)));
      ctx.strokeStyle = `rgba(45,212,175,${0.75*glow})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(bx, by); ctx.stroke();
      // white-hot core
      ctx.strokeStyle = `rgba(255,255,255,${0.25*glow})`; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(bx, by); ctx.stroke();
    } else { // ray
      const segLen = Math.hypot(p.tx - p.x, p.ty - p.y);
      const prog = Math.min(1, (age * p.speed) / segLen);
      const bx = p.x + (p.tx - p.x)*prog;
      const by = p.y + (p.ty - p.y)*prog;
      const glow = Math.max(0, 1 - (age / (p.life+0.0001)));
      ctx.strokeStyle = `rgba(45,212,175,${0.7*glow})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.22*glow})`; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(bx, by); ctx.stroke();
    }
  }

  // Draw spores
  const spores = SIGNALS.spores;
  for (let i=spores.length-1; i>=0; i--){
    const s = spores[i];
    s.t += dt; if (s.t > s.life) { spores.splice(i,1); continue; }
    s.x += s.vx*dt; s.y += s.vy*dt;
    const fade = 1 - (s.t / s.life);
    ctx.fillStyle = `rgba(45,212,175,${0.9*fade})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.2 + (1.6*fade), 0, Math.PI*2); ctx.fill();
    // rare ember flickers
    if (Math.random() < 0.03){
      ctx.fillStyle = `rgba(255,122,51,${0.6*fade})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.0, 0, Math.PI*2); ctx.fill();
    }
  }
}
