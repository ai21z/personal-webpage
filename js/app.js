/* ━━━ Necrography — Vissarion Zounarakis ━━━
 * Smart Navigation Node Placement System
 * - Static fungal mycelium background image
 * - Non-overlapping anchor-based node placement
 * - Automatic collision avoidance with content
 * - Branch-reveal highlight effect on hover
 * - Full accessibility support
 */

// ━━━ Module Imports ━━━
import { sizeCanvas, cumulativeLengths, pointAt, approach } from './utils.js';
import { buildGraphFromPaths, aStarPath } from './graph.js';
import {
  RITUAL_RETURN_MS,
  NAV_SPEED_WHEN_ACTIVE,
  NAV_COORDS,
  NAV_ORDER,
  LABEL_OFFSET_PX,
  LABEL_SPEEDS,
  DEFAULT_SPEED,
  MAX_SPARKS,
  MIN_ROUTE_LEN_PX,
  MAX_ROUTE_LEN_PX,
  RESAMPLE_STEP_PX,
  RESAMPLE_MIN_POINTS
} from './config.js';
import {
  prefersReducedMotion,
  hudEnabled,
  hudCanvas,
  hudCtx,
  setHudEnabled,
  setHudCanvas,
  setHudCtx,
  bgImg,
  COVER,
  MYC_MAP,
  setMycMap,
  GRAPH,
  PATH_CACHE,
  setGraph,
  ritualActive,
  followerSparks,
  setRitualActive,
  setFollowerSparks,
  LOCKED_ROUTES,
  setLockedRoutes,
  NODE_IDS,
  NAV_OFFSETS,
  currentNavHover,
  setCurrentNavHover,
  sparkCanvas,
  sparkCtx,
  sporeCanvas,
  sporeCtx,
  setSparkCanvas,
  setSparkCtx,
  setSporeCanvas,
  setSporeCtx,
  ACTIVE_ANIMS,
  cascadeAnims,
  cascadeActive,
  spores,
  lastSporeFrame,
  lastSparkTs,
  setActiveAnims,
  setCascadeAnims,
  setCascadeActive,
  setSpores,
  setLastSporeFrame,
  setLastSparkTs
} from './state.js';
import {
  computeCoverFromImage,
  coverMap,
  toViewport,
  projectXY
} from './viewport.js';
import {
  startSpark,
  ritualCascade,
  drawSparks,
  startSparkToPoint
} from './sparks.js';
import {
  computeNavOffsets,
  showSection,
  createNavLabel,
  createSigilNode,
  layoutNavNodes,
  handleNavEnter,
  handleNavLeave,
  updateMovingLabels
} from './navigation.js';
import {
  buildLockedRoutes,
  pointAtRoute,
  imgPointAtRoute
} from './routes.js';
import { notebookContact } from './contact.js';

// ━━━ A11y: Insert current year in footer ━━━
const yearElement = document.getElementById('yr');
if (yearElement) yearElement.textContent = new Date().getFullYear();

// ━━━ Mycelium Geometry System (Exported from Python) ━━━
/**
 * Load exported geometry JSON and preload background image.
 */
async function loadMycelium() {
  const response = await fetch('artifacts/network.json');
  setMycMap(await response.json());
  console.log(`✅ Loaded ${MYC_MAP.paths.length} paths, ${MYC_MAP.junctions.length} junctions`);
}

/* ━━━ Image-Space Graph + Pathfinding ━━━ */

// ━━━ HUD Rendering ━━━
function initHUD() {
  if (!hudCanvas) {
    const canvas = document.createElement('canvas');
    canvas.id = 'hud-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    setHudCanvas(canvas);
    setHudCtx(canvas.getContext('2d'));
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
  setHudEnabled(!hudEnabled);
  if (hudEnabled) {
    initHUD();
    renderHUD();
  } else if (hudCanvas) {
    hudCanvas.remove();
    setHudCanvas(null);
    setHudCtx(null);
  }
}

// ━━━ Initialize canvas contexts (sparkCanvas already imported from state) ━━━
if (!sparkCanvas) {
  const canvas = document.createElement('canvas');
  canvas.id = 'spark-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
  document.body.appendChild(canvas);
  setSparkCanvas(canvas);
}
  setSparkCtx(sparkCanvas.getContext('2d'));
if (sporeCanvas) {
  setSporeCtx(sporeCanvas.getContext('2d'));
}

// Main spark animation loop - wraps imported draw functions
function sparkLoopWrapper(ts) {
  const dt = Math.min(0.05, (ts - lastSparkTs) / 1000);
  setLastSparkTs(ts);
  updateMovingLabels(dt, pointAtRoute);
  drawSparks(dt, pointAtRoute);
  requestAnimationFrame(sparkLoopWrapper);
}

function resizeAll() {
  if (!COVER.ready) return; // Don't resize until image is loaded
  computeCoverFromImage();
  sizeCanvas(sparkCanvas);
  sizeCanvas(sporeCanvas);
  if (hudEnabled && hudCanvas) {
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
  }
  layoutNavNodes(wireSigilToggle, renderHUD, (sectionName) => showSection(sectionName, startRitualBackground, stopRitualBackground));

  setActiveAnims(ACTIVE_ANIMS.map((anim) => {
    const projPts = projectXY(anim.imgPts);
    const cum = cumulativeLengths(projPts);
    const len = cum[cum.length - 1];
    if (!len) return null;
    const ratio = anim.len ? anim.s / anim.len : (anim.dir > 0 ? 0 : 1);
    const s = Math.max(0, Math.min(len, ratio * len));
    return { ...anim, projPts, cum, len, s };
  }).filter(Boolean));

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
  if (!computeCoverFromImage()) {
    console.error('❌ Failed to compute cover from image');
    return;
  }
  
  computeNavOffsets(); // Compute offsets with proper base dimensions
  
  // First layout now happens AFTER image loads
  layoutNavNodes(wireSigilToggle, renderHUD, (sectionName) => showSection(sectionName, startRitualBackground, stopRitualBackground));
  
  console.log(`✅ Initial layout complete — ritual is ${ritualActive ? 'ACTIVE' : 'OFF'}`);
  
  // Now safe to do full resize setup
  sizeCanvas(sparkCanvas);
  sizeCanvas(sporeCanvas);
  if (sporeCtx) createSpores();
  
  // Start animation loops
  requestAnimationFrame(sparkLoopWrapper);
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

/* ━━━ Ritual Toggle (Sigil) — P0 FIX #3, #4 ━━━ */
function toggleRitualFromSigil(el){
  setRitualActive(!ritualActive);
  
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
  layoutNavNodes(wireSigilToggle, renderHUD, (sectionName) => showSection(sectionName, startRitualBackground, stopRitualBackground));
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
  const sparks = [];
  for (const [id] of Object.entries(LOCKED_ROUTES)){
    if (id === 'intro') continue;
    sparks.push({ id, alpha: 0.85 });
  }
  setFollowerSparks(sparks);
}
function detachFollowerSparks(){ 
  setFollowerSparks([]);
}

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

// ━━━ Spores Layer (ambient) ━━━

function createSpores() {
  if (!sporeCanvas || !sporeCtx) return;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const count = cssW < 768 ? 30 : 50;
  setSpores(new Array(count).fill(0).map(() => ({
    x: Math.random() * cssW,
    y: Math.random() * cssH,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    r: 1 + Math.random() * 3,
    p: Math.random() * Math.PI * 2,
    a: 0.1 + Math.random() * 0.25,
    scalePhase: Math.random() * Math.PI * 2
  })));
  setLastSporeFrame(0);
}

function drawSpores(ts) {
  if (!sporeCtx || !sporeCanvas) return;
  if (ts - lastSporeFrame < 33) return;
  setLastSporeFrame(ts);

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
  if (!sporeCtx) setSporeCtx(sporeCanvas.getContext('2d'));
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

// ━━━ [LOCKED-ROUTE] Stable Single-Branch Label Motion ━━━

// [LOCKED-ROUTE] Resample polyline to uniform spacing in image space
function resamplePolyline(pts, step = 10) {
  if (!pts || pts.length < 2) return pts;
  
  const resampled = [pts[0]];
  let accumulated = 0;
  
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    
    let localDist = 0;
    while (accumulated + localDist + step <= segLen) {
      localDist += step;
      const t = localDist / segLen;
      resampled.push([
        x0 + (x1 - x0) * t,
        y0 + (y1 - y0) * t
      ]);
    }
    accumulated = segLen - localDist;
  }
  
  // Always include endpoint
  const last = pts[pts.length - 1];
  if (resampled[resampled.length - 1] !== last) {
    resampled.push(last);
  }
  
  return resampled;
}

// [LOCKED-ROUTE] Find closest point on polyline and return arc-length
function projectOntoPolyline(px, py, polyline) {
  let bestDist = Infinity;
  let bestS = 0;
  let cumS = 0;
  
  for (let i = 1; i < polyline.length; i++) {
    const [x0, y0] = polyline[i - 1];
    const [x1, y1] = polyline[i];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dx, dy);
    
    if (segLen < 1e-6) {
      const d = Math.hypot(px - x0, py - y0);
      if (d < bestDist) {
        bestDist = d;
        bestS = cumS;
      }
      continue;
    }
    
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (segLen * segLen)));
    const closestX = x0 + t * dx;
    const closestY = y0 + t * dy;
    const d = Math.hypot(px - closestX, py - closestY);
    
    if (d < bestDist) {
      bestDist = d;
      bestS = cumS + t * segLen;
    }
    
    cumS += segLen;
  }
  
  return { dist: bestDist, s: bestS };
}

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

// [LOCKED-ROUTE] Ritual: sparks to all current label positions
function ritualCatchUp() {
  if (prefersReducedMotion) return;
  
  let delay = 0;
  // Iterate over what's actually locked
  for (const id of Object.keys(LOCKED_ROUTES)) {
    const route = LOCKED_ROUTES[id];
    if (!route) continue;
    
    const [imgX, imgY] = imgPointAtRoute(route, route.s);
    
    setTimeout(() => {
      startSparkToPoint('intro', imgX, imgY, 750);
    }, delay);
    
    delay += 60 + Math.random() * 40;
  }
}

// ━━━ Initialization ━━━
async function initNetworkAndNav() {
  if (!MYC_MAP) return;

  setGraph(buildGraphFromPaths(MYC_MAP.paths));
  computeNavOffsets();                 // AFTER graph built
  PATH_CACHE.clear();

  for (const [id, pt] of Object.entries(NAV_COORDS)) {
    NODE_IDS[id] = GRAPH.nearestId(pt.x, pt.y, 80, 24);
  }

  const introId = NODE_IDS.intro;
  if (introId != null && introId >= 0) {
    for (const [id, gid] of Object.entries(NODE_IDS)) {
      if (id === 'intro' || gid == null || gid < 0) continue;
      aStarPath(introId, gid, GRAPH, PATH_CACHE); // warm both ways
      aStarPath(gid, introId, GRAPH, PATH_CACHE);
    }
  }

  // [LOCKED-ROUTE] Lock each label to a single polyline (never re-snap)
  buildLockedRoutes();

  layoutNavNodes(wireSigilToggle, renderHUD, (sectionName) => showSection(sectionName, startRitualBackground, stopRitualBackground));
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadMycelium().catch(err => console.warn('⚠️ network.json unavailable:', err));
  await initNetworkAndNav();

  const nav = document.getElementById('network-nav');
  if (nav) {
    nav.querySelectorAll('.network-node-label, .network-sigil-node').forEach(el => {
      const id = el.dataset.node;
      el.addEventListener('pointerenter', () => handleNavEnter(id, el, startSpark, startSparkToPoint, pointAtRoute));
      el.addEventListener('pointerleave', () => handleNavLeave(id, el));
      el.addEventListener('focus', () => handleNavEnter(id, el, startSpark, startSparkToPoint, pointAtRoute));
      el.addEventListener('blur', () => handleNavLeave(id, el));
    });
  }

  // Honor hash on load, or default to intro
  const hash = window.location.hash.slice(1);
  const validSections = ['intro', 'about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills'];
  const initialSection = validSections.includes(hash) ? hash : 'intro';
  console.log(`🎯 Page Load: hash="${hash}", showing section="${initialSection}"`);
  showSection(initialSection, startRitualBackground, stopRitualBackground);

  if (hudEnabled) {
    initHUD();
    renderHUD();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'H') toggleHUD();
  });

  // Initialize ritual background system
  initRitualBackground();

  // Initialize contact form
  notebookContact.init();

  // Contact section: click background to close
  const contactSection = document.getElementById('contact');
  if (contactSection) {
    contactSection.addEventListener('click', (e) => {
      // Only close if clicking directly on the section (background), not on the notebook or its children
      if (e.target === contactSection) {
        showSection('intro', startRitualBackground, stopRitualBackground);
      }
    });
  }
});

// ━━━ Post-load layout (fonts & image settling) ━━━
window.addEventListener('load', () => {
  // Ensure cover is recomputed after all assets settle
  if (COVER.ready) {
    computeCoverFromImage();
    computeNavOffsets();
    layoutNavNodes(wireSigilToggle, renderHUD, (sectionName) => showSection(sectionName, startRitualBackground, stopRitualBackground));
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
    showSection(hash, startRitualBackground, stopRitualBackground);
  } else if (!hash) {
    showSection('intro', startRitualBackground, stopRitualBackground);
  }
});

// ━━━ Back button handler (for altar screens) ━━━
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="go-intro"]');
  if (!btn) return;
  e.preventDefault();
  showSection('intro', startRitualBackground, stopRitualBackground);
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
    const computed = getComputedStyle(el);
    
    // Create an invisible placeholder that holds the exact same space and positioning
    const placeholder = document.createElement('div');
    // Copy all the classes so it gets the same CSS positioning rules
    placeholder.className = el.className.replace('paper-open', '') + ' paper-placeholder';
    placeholder.style.visibility = 'hidden';
    placeholder.style.pointerEvents = 'none';
    // Don't override the CSS positioning - let it use the same rules
    
    el.__portal = { parent: el.parentNode, placeholder: placeholder };
    el.__portal.parent.insertBefore(placeholder, el);
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
  // DISABLED FOR PERFORMANCE - No radial rays effect
  return;
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
  // DISABLED FOR PERFORMANCE - No more radial rays effect
  // Ensure everything is stopped and cleared
  stopRitualBackground();
  return;
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
