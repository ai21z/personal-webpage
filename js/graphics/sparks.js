/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SPARK ANIMATION SYSTEM
 * Animated particles traveling along mycelial network paths
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { NAV_COORDS } from '../core/config.js';
import { 
  GRAPH, 
  NODE_IDS, 
  MYC_MAP, 
  ritualActive, 
  followerSparks, 
  LOCKED_ROUTES, 
  prefersReducedMotion 
} from '../core/state.js';
import { aStarPath } from '../navigation/graph.js';
import { projectXY, cumulativeLengths, pointAt } from '../utils/geometry.js';

/**
 * Spark Animation State
 */
export let sparkCanvas = document.getElementById('reveal-canvas') || document.getElementById('spark-canvas');
if (!sparkCanvas) {
  sparkCanvas = document.createElement('canvas');
  sparkCanvas.id = 'spark-canvas';
  sparkCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;';
  document.body.appendChild(sparkCanvas);
}
export const sparkCtx = sparkCanvas.getContext('2d');

export let ACTIVE_ANIMS = [];
export let lastSparkTs = performance.now();

/**
 * Configuration
 */
const MAX_SPARKS = 12;
const TRAIL_LENGTH = 60; // pixels
const loggedPathFailures = new Set();

/**
 * Cascade Animation State
 */
let cascadeAnims = [];
let cascadeActive = false;

/**
 * Start a spark animation between two navigation anchors
 * @param {string} fromKey - Source anchor ID
 * @param {string} toKey - Target anchor ID
 * @param {number} speedPxPerSec - Travel speed in pixels per second
 */
export function startSpark(fromKey, toKey, speedPxPerSec = 650) {
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

/**
 * Start a spark from an anchor to a specific point in image space
 * @param {string} fromKey - Source anchor ID
 * @param {number} imgX - Target X in image space
 * @param {number} imgY - Target Y in image space
 * @param {number} speed - Travel speed in pixels per second
 */
export function startSparkToPoint(fromKey, imgX, imgY, speed = 750) {
  if (prefersReducedMotion || !GRAPH) return;
  
  const fromId = NODE_IDS[fromKey];
  if (fromId == null || fromId < 0) return;
  
  // Find nearest graph node to target point
  const toId = GRAPH.nearestId(imgX, imgY, 96, 24);
  if (toId == null || toId < 0) {
    console.warn(`[LOCKED-ROUTE] No graph node near (${imgX.toFixed(0)}, ${imgY.toFixed(0)}) for spark`);
    return;
  }
  
  const solved = aStarPath(fromId, toId);
  if (!solved || solved.length < 2) return;
  
  const imgPts = solved.map(p => ({ x: p.x, y: p.y }));
  const projPts = projectXY(imgPts);
  const cum = cumulativeLengths(projPts);
  const len = cum[cum.length - 1];
  if (!len) return;
  
  ACTIVE_ANIMS.push({
    imgPts, projPts, cum, len,
    s: 0, v: speed
  });
}

/**
 * Ritual cascade effect - animate entire mycelial network
 */
export function ritualCascade() {
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

/**
 * Ritual catch-up - send sparks to all current label positions
 */
export function ritualCatchUp() {
  if (prefersReducedMotion) return;
  
  let delay = 0;
  // Iterate over what's actually locked
  for (const id of Object.keys(LOCKED_ROUTES)) {
    const route = LOCKED_ROUTES[id];
    if (!route) continue;
    
    // Import imgPointAtRoute from wherever it's defined
    // For now, commenting out to avoid errors
    // const [imgX, imgY] = imgPointAtRoute(route, route.s);
    
    // setTimeout(() => {
    //   startSparkToPoint('intro', imgX, imgY, 750);
    // }, delay);
    
    delay += 60 + Math.random() * 40;
  }
}

/**
 * Draw cascade animation
 * @param {number} dt - Delta time in seconds
 */
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

/**
 * Draw follower sparks (ritual mode light dots following labels)
 */
function drawFollowerSparks() {
  if (!ritualActive || !followerSparks.length || prefersReducedMotion) return;

  for (const f of followerSparks) {
    const route = LOCKED_ROUTES[f.id];
    if (!route || !route.projPts || route.projPts.length < 2) continue;
    
    // Get current position (need pointAtRoute from navigation system)
    // For now, skip to avoid errors
    // const head = pointAtRoute(route, route.s);

    // Commenting out rendering until we have pointAtRoute
    /*
    sparkCtx.save();

    // Outer glow
    sparkCtx.fillStyle = `rgba(143,180,255,${0.25 * f.alpha})`;
    sparkCtx.shadowBlur = 20;
    sparkCtx.shadowColor = `rgba(143,180,255,${0.4 * f.alpha})`;
    sparkCtx.beginPath();
    sparkCtx.arc(head[0], head[1], 8, 0, Math.PI * 2);
    sparkCtx.fill();

    // Mid glow
    sparkCtx.fillStyle = `rgba(122,174,138,${0.6 * f.alpha})`;
    sparkCtx.shadowBlur = 12;
    sparkCtx.shadowColor = `rgba(122,174,138,${0.7 * f.alpha})`;
    sparkCtx.beginPath();
    sparkCtx.arc(head[0], head[1], 4, 0, Math.PI * 2);
    sparkCtx.fill();

    // Bright core
    sparkCtx.fillStyle = `rgba(200,255,220,${0.9 * f.alpha})`;
    sparkCtx.shadowBlur = 8;
    sparkCtx.shadowColor = 'rgba(200,255,220,0.8)';
    sparkCtx.beginPath();
    sparkCtx.arc(head[0], head[1], 2, 0, Math.PI * 2);
    sparkCtx.fill();

    sparkCtx.restore();
    */
  }
}

/**
 * Main draw function for all spark animations
 * @param {number} dt - Delta time in seconds
 */
export function drawSparks(dt) {
  if (!sparkCtx || !sparkCanvas) return;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  sparkCtx.clearRect(0, 0, cssW, cssH);

  drawCascade(dt);

  const survivors = [];

  for (const anim of ACTIVE_ANIMS) {
    anim.s += anim.v * dt;
    if (anim.s > anim.len) continue;

    const head = pointAt(anim.projPts, anim.cum, anim.s);
    const tail = pointAt(anim.projPts, anim.cum, Math.max(0, anim.s - TRAIL_LENGTH));

    sparkCtx.save();
    sparkCtx.lineCap = 'round';
    sparkCtx.lineJoin = 'round';

    // Outer blue glow trail
    sparkCtx.strokeStyle = 'rgba(143,180,255,0.2)';
    sparkCtx.lineWidth = 8;
    sparkCtx.shadowBlur = 20;
    sparkCtx.shadowColor = 'rgba(143,180,255,0.4)';
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    // Mid green glow
    sparkCtx.strokeStyle = 'rgba(122,174,138,0.6)';
    sparkCtx.lineWidth = 4;
    sparkCtx.shadowBlur = 12;
    sparkCtx.shadowColor = 'rgba(122,174,138,0.7)';
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    // Bright white core
    sparkCtx.strokeStyle = 'rgba(240,255,245,0.9)';
    sparkCtx.lineWidth = 2;
    sparkCtx.shadowBlur = 8;
    sparkCtx.beginPath();
    sparkCtx.moveTo(tail[0], tail[1]);
    sparkCtx.lineTo(head[0], head[1]);
    sparkCtx.stroke();

    // Head particle
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

  drawFollowerSparks();
}

/**
 * Update lastSparkTs timestamp
 * @param {number} ts - Current timestamp
 */
export function updateSparkTimestamp(ts) {
  lastSparkTs = ts;
}

/**
 * Get delta time for spark animations
 * @param {number} ts - Current timestamp
 * @returns {number} Delta time in seconds
 */
export function getSparkDelta(ts) {
  const dt = Math.min(0.05, (ts - lastSparkTs) / 1000);
  lastSparkTs = ts;
  return dt;
}

/**
 * Resize spark canvas to match window
 */
export function resizeSparkCanvas() {
  if (!sparkCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  sparkCanvas.width = Math.floor(window.innerWidth * dpr);
  sparkCanvas.height = Math.floor(window.innerHeight * dpr);
  sparkCanvas.style.width = `${window.innerWidth}px`;
  sparkCanvas.style.height = `${window.innerHeight}px`;
  sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
