// blog-sparks-overlay.js — 2D canvas overlay for pulses, spores, and bloom effects
// Architecture: WebGL owns geometry, this owns FX via transparent canvas (pointer-events:none)

import { viewportSize } from './utils.js';

const DEBUG_OVERLAY = false; // Set true to see debug dots and logs
console.log('[Blog Overlay] Module loaded');

class BlogSparksOverlay {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.networkData = null;
    this.trunksByHub = {}; // {hubId: [{points:[...], length:number}]}
    
    // Projection (from blog:transform event)
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.baseW = 1920;
    this.baseH = 1080;
    
    // State
    this.visible = false;
    this.motionEnabled = true; // Overridable by user toggle
    this.rafId = null;
    this.pulses = [];
    this.spores = [];
    this.blooms = [];
    this.lastIdlePulse = 0;
    
    // Caps
    const { w } = viewportSize();
    this.MAX_PULSES = w < 768 ? 3 : 6;
    this.MAX_SPORES = w < 768 ? 8 : 15;
    
    // Throttle hover fans
    this.lastFanTime = 0;
    this.FAN_THROTTLE = 800; // ms
    
    // Idle pulse timing
    this.IDLE_INTERVAL_MIN = 4000;
    this.IDLE_INTERVAL_MAX = 8000;
    this.nextIdlePulse = 0;
  }
  
  async init({ jsonUrl, container }) {
    if (DEBUG_OVERLAY) console.log('[Overlay] Initializing...');
    
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'blog-sparks-overlay';
    this.canvas.setAttribute('aria-hidden', 'true');
    container.querySelector('.blog-container').appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    
    // Load network data
    try {
      const res = await fetch(jsonUrl);
      this.networkData = await res.json();
      this.extractTrunks();
      if (DEBUG_OVERLAY) console.log('[Overlay] Trunks extracted:', Object.keys(this.trunksByHub));
    } catch (err) {
      console.error('[Overlay] Failed to load network:', err);
    }
    
    // Set up controls
    this.setupControls(container);
    
    // Listen for events
    this.setupEventListeners();
    
    // Check for prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      this.motionEnabled = false;
      const toggle = document.querySelector('.blog-motion-toggle');
      if (toggle) {
        toggle.setAttribute('aria-pressed', 'false');
        toggle.style.display = 'none'; // Hide toggle if OS pref is set
      }
    }
    
    // Init spores
    if (this.motionEnabled) {
      this.initSpores();
    }
    
    if (DEBUG_OVERLAY) console.log('[Overlay] Init complete');
  }
  
  extractTrunks() {
    // Collect trunk polylines grouped by destination hub
    const paths = this.networkData.paths || [];
    const meta = this.networkData.paths_meta || [];
    
    paths.forEach((path, i) => {
      const m = meta[i] || {};
      if (m.kind !== 'trunk') return;
      const hub = m.hub;
      if (!hub || hub === 'source') return;
      
      // Resample to ~12-18px spacing for smooth interpolation
      const resampled = this.resamplePath(path, 15);
      const length = this.pathLength(resampled);
      
      if (!this.trunksByHub[hub]) this.trunksByHub[hub] = [];
      this.trunksByHub[hub].push({ points: resampled, length });
    });
  }
  
  resamplePath(path, spacing) {
    if (path.length < 2) return path;
    
    const result = [path[0]];
    let accumulated = 0;
    
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1];
      const [x1, y1] = path[i];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      accumulated += segLen;
      
      while (accumulated >= spacing) {
        const t = (accumulated - spacing) / segLen;
        const nx = x1 - (x1 - x0) * t;
        const ny = y1 - (y1 - y0) * t;
        result.push([nx, ny]);
        accumulated -= spacing;
      }
    }
    
    result.push(path[path.length - 1]);
    return result;
  }
  
  pathLength(path) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const [x0, y0] = path[i - 1];
      const [x1, y1] = path[i];
      len += Math.hypot(x1 - x0, y1 - y0);
    }
    return len;
  }
  
  setupControls(container) {
    // Get references (use new class names)
    this.infoCard = document.getElementById('hub-infocard');
    const hubButtons = container.querySelectorAll('.hub-btn');
    const motionToggle = container.querySelector('.blog-motion-toggle');
    
    if (DEBUG_OVERLAY) console.log('[Blog Overlay] Controls found:', { 
      infoCard: !!this.infoCard,
      hubButtons: hubButtons.length,
      motionToggle: !!motionToggle
    });
    
    // Note: app.js will also wire these hub buttons for navigation
    // This just ensures overlay effects trigger
    hubButtons.forEach(btn => {
      const hubId = btn.dataset.hub;
      
      btn.addEventListener('mouseenter', () => {
        window.dispatchEvent(new CustomEvent('blog:hover', { detail: { hubId } }));
      });
      
      btn.addEventListener('mouseleave', () => {
        window.dispatchEvent(new CustomEvent('blog:hover-off', { detail: {} }));
      });
      
      btn.addEventListener('focus', () => {
        window.dispatchEvent(new CustomEvent('blog:hover', { detail: { hubId } }));
      });
      
      btn.addEventListener('blur', () => {
        window.dispatchEvent(new CustomEvent('blog:hover-off', { detail: {} }));
      });
      
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('blog:click', { detail: { hubId } }));
      });
      
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('blog:click', { detail: { hubId } }));
        }
      });
    });
    
    // Motion toggle
    if (motionToggle) {
      const storedPref = localStorage.getItem('blog-motion-enabled');
      if (storedPref !== null) {
        this.motionEnabled = storedPref === 'true';
        motionToggle.setAttribute('aria-pressed', this.motionEnabled ? 'true' : 'false');
      }
      
      motionToggle.addEventListener('click', () => {
        this.motionEnabled = !this.motionEnabled;
        motionToggle.setAttribute('aria-pressed', this.motionEnabled ? 'true' : 'false');
        localStorage.setItem('blog-motion-enabled', this.motionEnabled ? 'true' : 'false');
        
        if (this.motionEnabled) {
          this.initSpores();
        } else {
          this.spores = [];
          this.pulses = [];
          this.blooms = [];
        }
      });
    }
  }
  
  setupEventListeners() {
    window.addEventListener('blog:visible', (e) => {
      this.visible = e.detail.visible;
      console.log('[Blog Overlay] Visibility changed:', this.visible);
      if (this.visible) {
        this.start();
      } else {
        this.stop();
      }
    });
    
    window.addEventListener('blog:transform', (e) => {
      const { scale, offsetX, offsetY, baseW, baseH, cssW, cssH } = e.detail;
      this.scale = scale;
      this.offsetX = offsetX;
      this.offsetY = offsetY;
      this.baseW = baseW || 1920;
      this.baseH = baseH || 1080;
      
      // Resize canvas to match CSS size
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = cssW * dpr;
      this.canvas.height = cssH * dpr;
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
      this.ctx.scale(dpr, dpr);
      
      console.log('[Blog Overlay] Transform updated:', { scale, offsetX, offsetY, cssW, cssH });
    });
    
    window.addEventListener('blog:motion', (e) => {
      this.motionEnabled = e.detail.enabled;
      console.log('[Blog Overlay] Motion toggled:', this.motionEnabled);
      
      if (!this.motionEnabled) {
        // Clear animated effects when motion disabled
        this.pulses = [];
        this.spores = [];
      } else {
        // Reinit spores when motion enabled
        this.initSpores();
      }
    });
    
    window.addEventListener('blog:hover', (e) => {
      this.onHover(e.detail.hubId);
    });
    
    window.addEventListener('blog:hover-off', () => {
      this.onHoverOff();
    });
    
    window.addEventListener('blog:click', (e) => {
      this.onClick(e.detail.hubId);
    });
  }
  
  // Projection: world -> screen (NO Y flip - JSON is already Y-down)
  project(x, y) {
    return [
      this.offsetX + x * this.scale,
      this.offsetY + y * this.scale
    ];
  }
  
  onHover(hubId) {
    // Ignore source node and empty hubIds
    if (!hubId || hubId === 'source') return;
    
    if (DEBUG_OVERLAY) console.log('[Blog Overlay] Hover:', hubId);
    
    // Motion effects: throttled pulse spawns (independent of info card)
    if (this.motionEnabled) {
      const now = performance.now();
      if (now - this.lastFanTime >= this.FAN_THROTTLE) {
        this.lastFanTime = now;
        const count = Math.random() < 0.6 ? 1 : 2;
        for (let i = 0; i < count; i++) {
          setTimeout(() => this.spawnPulse(hubId, false), i * 50);
        }
      }
    }
    
    // Info card always shows (independent of motion)
    this.showInfoCard(hubId);
  }
  
  onHoverOff() {
    if (DEBUG_OVERLAY) console.log('[Blog Overlay] Hover off');
    
    // Hide info card with fade delay
    if (this.infoCard) {
      setTimeout(() => {
        this.infoCard.setAttribute('hidden', '');
      }, 150);
    }
  }
  
  onClick(hubId) {
    // Ignore source node and empty hubIds
    if (!hubId || hubId === 'source') return;
    
    console.log('[Blog Overlay] Click:', hubId);
    
    // Motion effects: spawn converging fan or static halo
    if (this.motionEnabled) {
      // Fan of 2-3 faster pulses with stagger
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          this.spawnPulse(hubId, true); // click = true (faster, bigger bloom)
        }, i * 100); // 100ms stagger
      }
    } else {
      // Reduced motion: static halo fade
      this.spawnStaticHalo(hubId);
    }
    
    // Navigation handled in app.js (not here)
  }
  
  showInfoCard(hubId) {
    if (!this.infoCard) return;
    
    const HUB_COPY = {
      craft: { title: 'CRAFT', desc: 'Making things by hand: code, design, tools, pipelines.' },
      cosmos: { title: 'COSMOS', desc: 'Systems, networks, emergence, simulations, world.' },
      codex: { title: 'CODEX', desc: 'Engineering notes, debugging journals, patterns.' },
      convergence: { title: 'CONVERGENCE', desc: 'Where disciplines meet — synthesis & essays.' }
    };
    
    const copy = HUB_COPY[hubId];
    if (!copy) return;
    
    document.getElementById('infocard-title').textContent = copy.title;
    document.getElementById('infocard-desc').textContent = copy.desc;
    this.infoCard.removeAttribute('hidden');
    
    if (DEBUG_OVERLAY) console.log('[Blog Overlay] Info card shown:', hubId);
  }
  
  spawnPulse(hubId, isClick = false) {
    // Ignore source node (not a real hub)
    if (!hubId || hubId === 'source') return;
    
    // Cap pulses to prevent performance issues
    if (this.pulses.length >= this.MAX_PULSES) {
      if (DEBUG_OVERLAY) console.log('[Blog Overlay] Max pulses reached, skipping spawn');
      return;
    }
    
    const trunks = this.trunksByHub[hubId];
    if (!trunks || trunks.length === 0) {
      if (DEBUG_OVERLAY) console.warn('[Blog Overlay] No trunks found for hub:', hubId);
      return;
    }
    
    // Pick random trunk for this hub (source → hub)
    const trunk = trunks[Math.floor(Math.random() * trunks.length)];
    
    const pulse = {
      hubId,
      points: trunk.points, // World space coordinates
      length: trunk.length,
      progress: 0,
      speed: isClick ? 1.8 : 1.0, // clicks are faster
      alpha: isClick ? 0.14 : 0.10,
      tailLength: isClick ? 100 : 80,
      headLength: isClick ? 120 : 90,
      isClick
    };
    
    this.pulses.push(pulse);
    if (DEBUG_OVERLAY) console.log('[Blog Overlay] Pulse spawned:', { hubId, isClick, totalPulses: this.pulses.length });
  }
  
  spawnStaticHalo(hubId) {
    // Reduced-motion fallback: soft static halo at hub position
    const hub = this.networkData.hubs.find(h => h.id === hubId);
    if (!hub) return;
    
    const bloom = {
      x: hub.x,
      y: hub.y,
      radius: 0,
      maxRadius: 80,
      alpha: 0.3,
      duration: 300,
      elapsed: 0,
      isStatic: true
    };
    
    this.blooms.push(bloom);
  }
  
  initSpores() {
    this.spores = [];
    for (let i = 0; i < this.MAX_SPORES; i++) {
      this.spores.push({
        x: Math.random() * this.baseW,
        y: Math.random() * this.baseH,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 1.5 + Math.random() * 2,
        alpha: 0.05 + Math.random() * 0.08,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  
  scheduleIdlePulse() {
    if (!this.motionEnabled) return;
    
    const now = performance.now();
    if (now < this.nextIdlePulse) return;
    
    // Schedule next (6-10s interval)
    this.nextIdlePulse = now + 6000 + Math.random() * 4000;
    
    // Pick random hub
    const hubs = Object.keys(this.trunksByHub);
    if (hubs.length === 0) return;
    
    // Only spawn if we're under the cap (leave room for user interactions)
    if (this.pulses.length < this.MAX_PULSES - 2) {
      const hubId = hubs[Math.floor(Math.random() * hubs.length)];
      this.spawnPulse(hubId, false);
      if (DEBUG_OVERLAY) console.log('[Blog Overlay] Idle pulse spawned for:', hubId);
    }
  }
  
  start() {
    if (this.rafId) return;
    this.lastTime = performance.now();
    this.loop();
  }
  
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  loop() {
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 50); // Cap delta to prevent huge jumps
    this.lastTime = now;
    
    this.update(dt);
    this.render();
    
    // Schedule idle pulses every 6-10s (only if motion enabled)
    if (this.motionEnabled) {
      this.scheduleIdlePulse();
    }
    
    this.rafId = requestAnimationFrame(() => this.loop());
  }
  
  update(dt) {
    // Hard gate: if motion disabled, only update blooms (static halos), skip pulses/spores
    if (!this.motionEnabled) {
      this.blooms = this.blooms.filter(b => {
        b.elapsed += dt;
        return b.elapsed < b.duration;
      });
      return;
    }
    
    // Update pulses
    this.pulses = this.pulses.filter(p => {
      p.progress += (dt / 1000) * p.speed * 300; // px/sec
      
      // Check if reached end
      if (p.progress >= p.length) {
        // Spawn bloom
        const endPt = p.points[p.points.length - 1];
        this.spawnBloom(endPt[0], endPt[1], p.isClick);
        return false; // Remove pulse
      }
      
      return true;
    });
    
    // Update spores
    this.spores.forEach(s => {
      s.x += s.vx;
      s.y += s.vy;
      s.phase += 0.02;
      
      // Wrap around
      if (s.x < 0) s.x = this.baseW;
      if (s.x > this.baseW) s.x = 0;
      if (s.y < 0) s.y = this.baseH;
      if (s.y > this.baseH) s.y = 0;
    });
    
    // Update blooms
    this.blooms = this.blooms.filter(b => {
      b.elapsed += dt;
      const t = b.elapsed / b.duration;
      
      if (b.isStatic) {
        // Fade in then out
        b.alpha = t < 0.3 ? t / 0.3 * 0.3 : (1 - (t - 0.3) / 0.7) * 0.3;
        b.radius = b.maxRadius * Math.min(t / 0.3, 1);
      } else {
        // Normal bloom
        b.alpha = (1 - t) * 0.22;
        b.radius = b.maxRadius * t;
      }
      
      return t < 1;
    });
    
    // Schedule idle pulses
    this.scheduleIdlePulse();
  }
  
  spawnBloom(x, y, isClick = false) {
    const bloom = {
      x,
      y,
      radius: 0,
      maxRadius: isClick ? 100 : 70,
      alpha: isClick ? 0.25 : 0.18,
      duration: isClick ? 600 : 450,
      elapsed: 0,
      isStatic: false
    };
    
    this.blooms.push(bloom);
    
    // Click gets afterglow ring
    if (isClick) {
      this.blooms.push({
        x,
        y,
        radius: 0,
        maxRadius: 150,
        alpha: 0.15,
        duration: 2000,
        elapsed: 0,
        isStatic: false
      });
    }
  }
  
  render() {
    // Clear
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Hard gate: if motion disabled, only render blooms (static halos)
    if (!this.motionEnabled) {
      this.ctx.globalCompositeOperation = 'lighter';
      this.blooms.forEach(b => this.renderBloom(b));
      return;
    }
    
    // Render spores
    this.ctx.globalCompositeOperation = 'lighter';
    this.spores.forEach(s => {
      const [sx, sy] = this.project(s.x, s.y);
      const pulseAlpha = s.alpha * (0.7 + 0.3 * Math.sin(s.phase));
      
      this.ctx.fillStyle = `rgba(135, 160, 132, ${pulseAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, s.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // Render pulses
    this.ctx.globalCompositeOperation = 'lighter';
    this.pulses.forEach(p => this.renderPulse(p));
    
    // Render blooms
    this.ctx.globalCompositeOperation = 'lighter';
    this.blooms.forEach(b => this.renderBloom(b));
    
    // Debug: show hovered hub position
    if (DEBUG_OVERLAY && this.debugHubId) {
      const hub = this.networkData.hubs.find(h => h.id === this.debugHubId);
      if (hub) {
        const [sx, sy] = this.project(hub.x, hub.y);
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  
  renderPulse(pulse) {
    // Find current position along path
    let traveled = 0;
    let segIdx = -1;
    
    for (let i = 1; i < pulse.points.length; i++) {
      const [x0, y0] = pulse.points[i - 1];
      const [x1, y1] = pulse.points[i];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      
      if (traveled + segLen >= pulse.progress) {
        segIdx = i;
        break;
      }
      
      traveled += segLen;
    }
    
    if (segIdx === -1) return;
    
    // Interpolate head position
    const [x0, y0] = pulse.points[segIdx - 1];
    const [x1, y1] = pulse.points[segIdx];
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    const t = (pulse.progress - traveled) / segLen;
    const headX = x0 + (x1 - x0) * t;
    const headY = y0 + (y1 - y0) * t;
    
    // Project to screen
    const [headSX, headSY] = this.project(headX, headY);
    
    // Find tail position
    const tailProgress = Math.max(0, pulse.progress - pulse.tailLength);
    traveled = 0;
    let tailSegIdx = -1;
    
    for (let i = 1; i < pulse.points.length; i++) {
      const [x0, y0] = pulse.points[i - 1];
      const [x1, y1] = pulse.points[i];
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      
      if (traveled + segLen >= tailProgress) {
        tailSegIdx = i;
        break;
      }
      
      traveled += segLen;
    }
    
    if (tailSegIdx === -1) return;
    
    const [tx0, ty0] = pulse.points[tailSegIdx - 1];
    const [tx1, ty1] = pulse.points[tailSegIdx];
    const tSegLen = Math.hypot(tx1 - tx0, ty1 - ty0);
    const tt = (tailProgress - traveled) / tSegLen;
    const tailX = tx0 + (tx1 - tx0) * tt;
    const tailY = ty0 + (ty1 - ty0) * tt;
    
    const [tailSX, tailSY] = this.project(tailX, tailY);
    
    // Draw gradient stroke from tail to head
    const grad = this.ctx.createLinearGradient(tailSX, tailSY, headSX, headSY);
    grad.addColorStop(0, `rgba(135, 160, 132, 0)`);
    grad.addColorStop(0.3, `rgba(135, 160, 132, ${pulse.alpha * 0.5})`);
    grad.addColorStop(1, `rgba(135, 160, 132, ${pulse.alpha})`);
    
    this.ctx.strokeStyle = grad;
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(tailSX, tailSY);
    this.ctx.lineTo(headSX, headSY);
    this.ctx.stroke();
  }
  
  renderBloom(bloom) {
    const [sx, sy] = this.project(bloom.x, bloom.y);
    
    const grad = this.ctx.createRadialGradient(sx, sy, 0, sx, sy, bloom.radius * this.scale);
    grad.addColorStop(0, `rgba(135, 160, 132, ${bloom.alpha})`);
    grad.addColorStop(0.5, `rgba(135, 160, 132, ${bloom.alpha * 0.4})`);
    grad.addColorStop(1, `rgba(135, 160, 132, 0)`);
    
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(sx, sy, bloom.radius * this.scale, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

// Export singleton
const blogSparksOverlay = new BlogSparksOverlay();
export default blogSparksOverlay;

// Auto-init when module loads (app.js will trigger via blog:visible event)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Wait for blog section to be ready
    setTimeout(() => {
      const container = document.querySelector('.blog-screen');
      if (container) {
        blogSparksOverlay.init({
          jsonUrl: './artifacts/blog_network.json',
          container
        });
      }
    }, 100);
  });
} else {
  // DOM already ready
  setTimeout(() => {
    const container = document.querySelector('.blog-screen');
    if (container) {
      blogSparksOverlay.init({
        jsonUrl: './artifacts/blog_network.json',
        container
      });
    }
  }, 100);
}
