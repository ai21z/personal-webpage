/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * GEOMETRY UTILITIES
 * Pure functions for coordinate transformations and calculations
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { COVER } from '../core/state.js';

/**
 * Compute cover transform from background image
 * @param {HTMLImageElement} bgImg - Background image element
 * @returns {boolean} - Success status
 */
export function computeCoverFromImage(bgImg) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = bgImg ? bgImg.naturalWidth : 0;
  const H = bgImg ? bgImg.naturalHeight : 0;
  
  if (!W || !H) {
    console.warn('⚠️ Cover: Image not ready yet, dimensions unavailable');
    return false;
  }
  
  const s = Math.max(vw / W, vh / H);
  COVER.s = s;
  COVER.dx = (vw - W * s) * 0.5;
  COVER.dy = (vh - H * s) * 0.5;
  COVER.baseW = W; 
  COVER.baseH = H;
  COVER.ready = true;
  
  console.log(`📐 Cover`, { baseW: W, baseH: H, s: s.toFixed(4), dx: COVER.dx.toFixed(2), dy: COVER.dy.toFixed(2), viewport: `${vw}×${vh}` });
  return true;
}

/**
 * Map image space coordinates to viewport space
 * SINGLE coverMap function used everywhere (labels, sparks, follower lightning, HUD)
 * @param {number} x - X coordinate in image space
 * @param {number} y - Y coordinate in image space
 * @returns {[number, number]} - [x, y] in viewport space
 */
export function coverMap(x, y) { 
  return [ x * COVER.s + COVER.dx, y * COVER.s + COVER.dy ]; 
}

/**
 * Alias for backward compatibility
 */
export function toViewport(x, y) { 
  return coverMap(x, y);
}

/**
 * Resize canvas to match window dimensions
 * @param {HTMLCanvasElement} canvas
 */
export function sizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.scale(dpr, dpr);
}

/**
 * Project array of image-space points to viewport
 * @param {Array<Array<number>>} points - [[x,y], ...]
 * @returns {Array<Array<number>>} - Projected points
 */
export function projectXY(points) {
  return points.map(([x, y]) => coverMap(x, y));
}

/**
 * Compute cumulative arc lengths along a polyline
 * @param {Array<Array<number>>} pts - [[x,y], ...]
 * @returns {Float32Array} - Cumulative lengths
 */
export function cumulativeLengths(pts) {
  const cum = new Float32Array(pts.length);
  cum[0] = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    cum[i] = cum[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  return cum;
}

/**
 * Get point at normalized position s along polyline
 * @param {Array<Array<number>>} pts - Polyline points
 * @param {Float32Array} cum - Cumulative lengths
 * @param {number} s - Normalized position [0..1]
 * @returns {{x: number, y: number, angle: number}} - Point and tangent angle
 */
export function pointAt(pts, cum, s) {
  const L = cum[cum.length - 1];
  const target = s * L;
  
  let i = 0;
  while (i < cum.length - 1 && cum[i + 1] < target) i++;
  
  if (i >= pts.length - 1) {
    return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], angle: 0 };
  }
  
  const segLen = cum[i + 1] - cum[i];
  const t = segLen > 0 ? (target - cum[i]) / segLen : 0;
  
  const x = pts[i][0] + t * (pts[i + 1][0] - pts[i][0]);
  const y = pts[i][1] + t * (pts[i + 1][1] - pts[i][1]);
  const angle = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
  
  return { x, y, angle };
}

/**
 * Smooth approach from current to target value
 * @param {number} current
 * @param {number} target
 * @param {number} ratePerSec - Rate of change per second
 * @param {number} dt - Delta time in seconds
 * @returns {number} - New value
 */
export function approach(current, target, ratePerSec, dt) {
  const delta = target - current;
  const step = ratePerSec * dt;
  if (Math.abs(delta) < step) return target;
  return current + Math.sign(delta) * step;
}

/**
 * Resample polyline to evenly spaced points
 * @param {Array<Array<number>>} pts - Input polyline
 * @param {number} step - Spacing between points (default 10)
 * @returns {Array<Array<number>>} - Resampled polyline
 */
export function resamplePolyline(pts, step = 10) {
  if (!pts || pts.length < 2) return pts;
  
  const out = [pts[0]];
  let accum = 0;
  
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const seg = Math.sqrt(dx * dx + dy * dy);
    
    let walked = 0;
    while (walked + step < seg) {
      walked += step;
      accum += step;
      const t = walked / seg;
      out.push([
        pts[i - 1][0] + t * dx,
        pts[i - 1][1] + t * dy
      ]);
    }
    accum += (seg - walked);
  }
  
  if (out[out.length - 1] !== pts[pts.length - 1]) {
    out.push(pts[pts.length - 1]);
  }
  
  return out;
}

/**
 * Project point onto polyline (closest point on line)
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @param {Array<Array<number>>} polyline - Polyline points
 * @returns {{x: number, y: number, t: number, segmentIndex: number}} - Projected point info
 */
export function projectOntoPolyline(px, py, polyline) {
  let bestDist = Infinity;
  let bestX = polyline[0][0];
  let bestY = polyline[0][1];
  let bestT = 0;
  let bestSeg = 0;
  
  for (let i = 0; i < polyline.length - 1; i++) {
    const [ax, ay] = polyline[i];
    const [bx, by] = polyline[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) continue;
    
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    
    if (dist < bestDist) {
      bestDist = dist;
      bestX = cx;
      bestY = cy;
      bestT = t;
      bestSeg = i;
    }
  }
  
  return { x: bestX, y: bestY, t: bestT, segmentIndex: bestSeg };
}
