/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * SPORE ANIMATION SYSTEM
 * Ambient floating particle effects for atmospheric depth
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { prefersReducedMotion } from '../core/state.js';
import { sizeCanvas } from '../utils/geometry.js';

/**
 * Spore Canvas State
 */
export const sporeCanvas = document.getElementById('spore-canvas');
export let sporeCtx = sporeCanvas ? sporeCanvas.getContext('2d') : null;

/**
 * Spore Particles
 */
let spores = [];
let lastSporeFrame = 0;

/**
 * Configuration
 */
const SPORE_COUNT_MOBILE = 30;
const SPORE_COUNT_DESKTOP = 50;
const MOBILE_BREAKPOINT = 768;
const FRAME_INTERVAL = 33; // ~30fps

/**
 * Create spore particles
 */
export function createSpores() {
  if (!sporeCanvas || !sporeCtx) return;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const count = cssW < MOBILE_BREAKPOINT ? SPORE_COUNT_MOBILE : SPORE_COUNT_DESKTOP;
  
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

/**
 * Draw spore particles
 * @param {number} ts - Timestamp from requestAnimationFrame
 */
function drawSpores(ts) {
  if (!sporeCtx || !sporeCanvas) return;
  if (ts - lastSporeFrame < FRAME_INTERVAL) return;
  lastSporeFrame = ts;

  const c = sporeCtx;
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.clearRect(0, 0, w, h);

  for (const s of spores) {
    // Wrap-around movement
    s.x = (s.x + s.vx + w) % w;
    s.y = (s.y + s.vy + h) % h;

    // Pulsing opacity
    const pulse = (Math.sin(ts * 0.001 + s.p) + 1) / 2;
    const scalePulse = 0.8 + 0.4 * (Math.sin(ts * 0.0015 + s.scalePhase) + 1) / 2;
    const radius = s.r * scalePulse;

    // Outer glow
    c.shadowBlur = 8;
    c.shadowColor = `rgba(122,174,138,${s.a * pulse * 0.6})`;
    c.fillStyle = `rgba(122,174,138,${s.a * pulse})`;
    c.beginPath();
    c.arc(s.x, s.y, radius, 0, Math.PI * 2);
    c.fill();

    // Inner bright core
    c.shadowBlur = 0;
    c.fillStyle = `rgba(200,255,220,${s.a * pulse * 0.8})`;
    c.beginPath();
    c.arc(s.x, s.y, radius * 0.4, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * Start spore animation loop
 */
export function startSpores() {
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

/**
 * Resize spore canvas to match window
 */
export function resizeSporeCanvas() {
  if (!sporeCanvas) return;
  sizeCanvas(sporeCanvas);
  if (sporeCtx) createSpores();
}
