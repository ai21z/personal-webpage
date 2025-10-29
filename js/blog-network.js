/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BLOG NETWORK — Necrography Edition (Canvas2D)
   - Generator JSON untouched; this file handles *all* art/behavior.
   - Layers: paper (procedural), ink (multiply, prerendered), live glow,
             cyst pulses, labels, film grain.
   - Palette discipline: Ashen Green linework, Eerie Teal fusions,
     Ember accents only near hubs (<10%).
   - Performance: 30 FPS cap, prerendered ink, tiny noise math.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class BlogNetwork {
  constructor() {
  this.version = window.__BLOG_NETWORK_VERSION || '20251029-trunks6-fan';
    // DOM / state
    this.canvas = null;
    this.ctx = null;
    this.networkData = null;
    this.animationFrame = null;
    this.isVisible = false;
    this.loaded = false;

    // Interaction
    this.time = 0;
    this.mouseX = -1000;
    this.mouseY = -1000;
    this.hoveredHub = null;
    this.infectedNodes = [];

    // Timing
    this.FPS = 30;
    this.frameInterval = 1000 / this.FPS;
    this.lastFrame = 0;

    // Render transforms (fit 1920x1080)
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Offscreen layers (1920x1080 logical)
    this.paperLayer = null;
    this.inkLayer = null;
    this.grainLayer = null;
    this.inkReady = false;

    // Composition bias (avoid dead-center symmetry)
    this.offCenterShift = { x: -40, y: 18 };
  }

  // ---------- init & setup ----------
  async init() {
    this.canvas = document.getElementById('blog-network-canvas');
    if (!this.canvas) {
      console.warn('Blog network canvas not found');
      return;
    }
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.setupCanvas();

    await this.loadNetworkData();       // JSON from generator (do not modify)

    this.setupLayers();
    this.buildPaperTexture();
    this.buildGrain();
    this.buildStaticInk();              // prerender heavy ink once
    this.inkReady = true;

    this.setupInteraction();
    window.addEventListener('resize', () => this.handleResize());

    this.loaded = true;
    // console.log('✓ Blog network initialized (Necrography)');
  }

  setupCanvas() {
    const container = this.canvas.parentElement || document.body;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    // compute fit for 1920x1080
    const scaleX = this.canvasWidth / 1920;
    const scaleY = this.canvasHeight / 1080;
    this.scale = Math.min(scaleX, scaleY);
    this.offsetX = (this.canvasWidth - 1920 * this.scale) / 2;
    this.offsetY = (this.canvasHeight - 1080 * this.scale) / 2;
  }

  setupLayers() {
    // simple canvases at logical resolution (no DPR scaling needed)
    this.paperLayer = document.createElement('canvas');
    this.paperLayer.width = 1920; this.paperLayer.height = 1080;

    this.inkLayer = document.createElement('canvas');
    this.inkLayer.width = 1920; this.inkLayer.height = 1080;

    this.grainLayer = document.createElement('canvas');
    this.grainLayer.width = 1920; this.grainLayer.height = 1080;
  }

  setupInteraction() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.updateHover();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredHub = null;
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredHub) {
        // Wire your navigation here for each hub id
        // e.g., window.location.href = `/blog/${this.hoveredHub}`;
        // console.log(`🔮 Clicked hub: ${this.hoveredHub}`);
      }
    });
  }

  handleResize() {
    if (!this.isVisible) return;
    this.setupCanvas();
    // rebuild static ink at new composition offset (ink is 1920x1080; only off-center shift matters)
    this.inkReady = false;
    this.buildStaticInk();
    this.inkReady = true;
    this.updateHover();
  }

  async loadNetworkData() {
  const response = await fetch(`./artifacts/blog_network.json?v=${this.version}`);
    this.networkData = await response.json();

    // Cyst nodes (every 12th segment)
    const junctionInterval = 12;
    this.infectedNodes = [];
    this.networkData.paths.forEach((path, idx) => {
      for (let i = junctionInterval; i < path.length - junctionInterval; i += junctionInterval) {
        this.infectedNodes.push({
          id: `cyst_${idx}_${i}`,
          pathIdx: idx,
          segmentIdx: i,
          x: path[i][0],
          y: path[i][1],
          pulse: Math.random() * Math.PI * 2,
          intensity: 0.3 + Math.random() * 0.4
        });
      }
    });
  }

  show() {
    this.isVisible = true;
    if (this.loaded) this.startAnimation();
  }
  hide() { this.isVisible = false; this.stopAnimation(); }
  startAnimation() {
    if (this.animationFrame) return;
    this.lastFrame = performance.now();
    this.animate();
  }
  stopAnimation() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  // ---------- hov/coords ----------
  updateHover() {
    if (!this.networkData) return;

    // transform mouse into 1920x1080 network space and counter the off-center shift
    const netX = (this.mouseX - this.offsetX) / this.scale - this.offCenterShift.x;
    const netY = (this.mouseY - this.offsetY) / this.scale - this.offCenterShift.y;

    const { hubs } = this.networkData;
    this.hoveredHub = null;
    for (const hub of hubs) {
      const dx = netX - hub.x;
      const dy = netY - hub.y;
      if (Math.hypot(dx, dy) < 50) {
        this.hoveredHub = hub.id;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    this.canvas.style.cursor = 'default';
  }

  // ---------- small math helpers ----------
  _nrand(a, b) { // deterministic noise without libs
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  _mix(a, b, t) { return a + (b - a) * t; }
  _rgb(r, g, b, a = 1) { return `rgba(${r|0},${g|0},${b|0},${a})`; }

  // ---------- palette ----------
  get PALETTE() {
    return {
      ABYSS: '#0B0C0D',
      ASHEN: [67, 93, 80],      // linework
      GLOW:  [135,160,132],     // faint tips/cysts
      TEAL:  [35, 67, 60],      // fusions
      EMBER: [184,114,66],      // rare accents
      BONE:  [201,194,179]      // labels
    };
  }

  // ---------- paper / grain ----------
  buildPaperTexture() {
    const ctx = this.paperLayer.getContext('2d');
    ctx.clearRect(0, 0, 1920, 1080);
    // abyss base
    ctx.fillStyle = this.PALETTE.ABYSS;
    ctx.fillRect(0, 0, 1920, 1080);

    // fiber specks
    const step = 3, strength = 0.08;
    for (let y = 0; y < 1080; y += step) {
      for (let x = 0; x < 1920; x += step) {
        const n = this._nrand(x * 0.37, y * 0.29);
        if (n > 0.66) {
          const shade = 10 + Math.floor(n * 28);
          ctx.fillStyle = `rgba(${shade},${shade},${shade},${strength})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // vignette
    const g = ctx.createRadialGradient(960, 540, 220, 960, 540, 940);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1920, 1080);
  }

  buildGrain() {
    const ctx = this.grainLayer.getContext('2d');
    const img = ctx.createImageData(1920, 1080);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() * 50 - 25);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- prerender ink ----------
  buildStaticInk() {
    if (!this.networkData || !this.inkLayer) return;
    const ctx = this.inkLayer.getContext('2d');
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.save();
    // off-center composition
    ctx.translate(this.offCenterShift.x, this.offCenterShift.y);

    const { paths, paths_meta, hubs } = this.networkData;

    // local ember zones near hubs (rare accents)
    const emberRadius = 86;
    const emberZones = (hubs || []).map(h => ({ x: h.x, y: h.y, r2: emberRadius * emberRadius }));

    const ASHEN = this.PALETTE.ASHEN;
    const TEAL = this.PALETTE.TEAL;
    const EMBER = this.PALETTE.EMBER;

    const baseMax = 4.5, baseMin = 0.9;

    paths.forEach((path, i) => {
      if (path.length < 2) return;
      const meta = paths_meta ? (paths_meta[i] || {}) : {};
      const kind = meta.kind || 'branch';
      const depth = meta.depth || 0;

      const baseW = Math.max(baseMin, baseMax - depth * 0.5);
      const colorBase = (kind === 'fusion') ? TEAL : ASHEN;

      for (let j = 0; j < path.length - 1; j++) {
        const [x1, y1] = path[j];
        const [x2, y2] = path[j + 1];

        const prog = j / (path.length - 1);
        let w = baseW * (1 - prog * 0.4);

        // ember only for thick segments near hubs
        let rgbArr = colorBase;
        if (kind !== 'fusion' && w > 0.66 * baseMax) {
          const mx = 0.5 * (x1 + x2), my = 0.5 * (y1 + y2);
          const nearHub = emberZones.some(z => {
            const dx = mx - z.x, dy = my - z.y;
            return (dx * dx + dy * dy) < z.r2;
          });
          if (nearHub) rgbArr = EMBER;
        }

        this._charcoalStroke(ctx, x1, y1, x2, y2, w, rgbArr);
      }
    });

    ctx.restore();
  }

  _charcoalStroke(ctx, x1, y1, x2, y2, w, rgbArr) {
    const [r, g, b] = rgbArr;

    // main body — multiply keeps blacks rich
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this._rgb(r, g, b, 0.78);
    ctx.lineWidth = w;
    ctx.shadowBlur = Math.min(3, 1 + w * 0.35);
    ctx.shadowColor = this._rgb(r, g, b, 0.2);

    // slight curvature + micro-jitter
    const nx = y2 - y1, ny = -(x2 - x1);
    const len = Math.hypot(nx, ny) || 1;
    const j = 0.6; // jitter px
    const j1 = (this._nrand(x1, y1) - 0.5) * j;
    const j2 = (this._nrand(x2, y2) - 0.5) * j;
    const cx = this._mix(x1, x2, 0.5) + (nx / len) * (this._nrand(x1 + x2, y1 + y2) - 0.5) * j;

    ctx.beginPath();
    ctx.moveTo(x1 + (nx / len) * j1 * 0.5, y1 + (ny / len) * j1 * 0.5);
    ctx.quadraticCurveTo(cx, this._mix(y1, y2, 0.5), x2 + (nx / len) * j2 * 0.5, y2 + (ny / len) * j2 * 0.5);
    ctx.stroke();
    ctx.restore();

    // frayed rim — lighter, broken dash
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this._rgb(r, g, b, 0.35);
    ctx.lineWidth = Math.max(0.6, w * 0.55);
    ctx.setLineDash([3, 1 + this._nrand(x1, y1) * 2]);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ---------- frame ----------
  animate() {
    if (!this.isVisible) return;
    const now = performance.now();
    const elapsed = now - this.lastFrame;

    if (elapsed >= this.frameInterval) {
      this.time += elapsed * 0.001;
      this.render();
      this.lastFrame = now - (elapsed % this.frameInterval);
    }
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  render() {
    if (!this.loaded || !this.ctx) return;

    const ctx = this.ctx;
    const w = this.canvasWidth, h = this.canvasHeight;

    // clear to abyss
    ctx.fillStyle = '#0B0C0D';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // paper + ink (static)
    ctx.drawImage(this.paperLayer, 0, 0, 1920, 1080);
    if (this.inkReady) ctx.drawImage(this.inkLayer, 0, 0, 1920, 1080);

    // live effects
    this.renderHubGlow(ctx);
    this.renderArticleCysts(ctx);
    this.renderHubLabels(ctx);

    // subtle grain (refresh 2×/s, keep alpha tiny)
    if ((Math.floor(this.time * 2) % 2) === 0) this.buildGrain();
    ctx.globalAlpha = 0.06;
    ctx.drawImage(this.grainLayer, 0, 0, 1920, 1080);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ---------- live layers ----------
  renderHubGlow(ctx) {
    if (!this.networkData || !this.hoveredHub) return;
    const hub = this.networkData.hubs.find(h => h.id === this.hoveredHub);
    if (!hub) return;

    const t = this.time;
    const pulse = Math.sin(t * 0.5) * 0.2 + 0.8; // slow, 6–12s feel
    const radius = 64 * pulse;

    ctx.save();
    ctx.translate(this.offCenterShift.x, this.offCenterShift.y);
    const g = ctx.createRadialGradient(hub.x, hub.y, 0, hub.x, hub.y, radius);
    g.addColorStop(0, this._rgb(...this.PALETTE.EMBER, 0.35));
    g.addColorStop(0.6, this._rgb(...this.PALETTE.ASHEN, 0.18));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderArticleCysts(ctx) {
    if (!this.infectedNodes.length) return;
    ctx.save();
    ctx.translate(this.offCenterShift.x, this.offCenterShift.y);

    const ASHEN = this.PALETTE.ASHEN, GLOW = this.PALETTE.GLOW;

    this.infectedNodes.forEach(node => {
      const pulse = Math.sin(this.time * 0.8 + node.pulse) * 0.3 + 0.7;
      const size = 2.5 * pulse * node.intensity;
      const r = size * 3;

      const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
      grad.addColorStop(0, this._rgb(...GLOW, 0.45 * pulse));
      grad.addColorStop(0.7, this._rgb(...ASHEN, 0.18 * pulse));
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = this._rgb(...GLOW, 0.55 * pulse);
      ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();
  }

  renderHubLabels(ctx) {
    if (!this.networkData) return;
    const { hubs } = this.networkData;

    ctx.save();
    ctx.translate(this.offCenterShift.x, this.offCenterShift.y);
    hubs.forEach(hub => {
      if (hub.id === 'source') return;
      const hovered = this.hoveredHub === hub.id;
      const a = hovered ? 0.85 : 0.42;

      ctx.font = hovered ? '600 16px ui-monospace, Menlo, monospace'
                         : '13px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = hovered ? 10 : 5;
      ctx.shadowColor = hovered
        ? this._rgb(...this.PALETTE.EMBER, 0.5)
        : this._rgb(...this.PALETTE.ASHEN, 0.25);
      ctx.fillStyle = this._rgb(...this.PALETTE.BONE, a);
      ctx.fillText(hub.label, hub.x, hub.y);
    });
    ctx.restore();
  }

  // ---------- teardown ----------
  destroy() {
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
    this.networkData = null;
    this.paperLayer = this.inkLayer = this.grainLayer = null;
  }
}

// Export singleton
const blogNetwork = new BlogNetwork();
export default blogNetwork;
