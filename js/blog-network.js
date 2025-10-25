/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BLOG NETWORK VISUALIZATION
   Radial mycelium network with SOURCE→hub trunks and center fusion
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class BlogNetwork {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.networkData = null;
    this.animationFrame = null;
    this.isVisible = false;
    this.glowImage = null;
    this.baseImage = null;
    this.loaded = false;
    this.animatedPaths = [];
    this.time = 0;
    this.FPS = 30;
    this.frameInterval = 1000 / this.FPS;
    this.lastFrame = 0;
  }

  async init() {
    this.canvas = document.getElementById('blog-network-canvas');
    if (!this.canvas) {
      console.warn('Blog network canvas not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.setupCanvas();

    // Load the network data and images
    await this.loadAssets();

    // Setup animation
    this.setupAnimatedPaths();
    
    // Setup resize handler
    window.addEventListener('resize', () => this.handleResize());
  }

  setupCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // Use device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    
    this.ctx.scale(dpr, dpr);
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
  }

  handleResize() {
    if (!this.isVisible) return;
    this.setupCanvas();
    this.render();
  }

  async loadAssets() {
    try {
      // Load network JSON data
      const response = await fetch('./artifacts/blog_network.json');
      this.networkData = await response.json();

      // Load pre-rendered images
      await Promise.all([
        this.loadImage('./artifacts/blog_bg_base.png').then(img => this.baseImage = img),
        this.loadImage('./artifacts/blog_bg_glow.png').then(img => this.glowImage = img)
      ]);

      this.loaded = true;
      console.log('✓ Blog network assets loaded');
    } catch (error) {
      console.error('Failed to load blog network assets:', error);
    }
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  setupAnimatedPaths() {
    if (!this.networkData) return;

    const { paths, paths_meta } = this.networkData;
    
    // Select a subset of paths to animate (flowing energy)
    const animationCandidates = [];
    
    paths.forEach((path, idx) => {
      const meta = paths_meta[idx] || {};
      const kind = meta.kind || '';
      
      // Animate fusion paths and some branches
      if (kind === 'fusion' || (kind === 'branch' && Math.random() < 0.15)) {
        animationCandidates.push({
          path,
          meta,
          speed: 0.3 + Math.random() * 0.7, // Vary animation speed
          offset: Math.random() * Math.PI * 2, // Phase offset
        });
      }
    });

    this.animatedPaths = animationCandidates;
  }

  show() {
    this.isVisible = true;
    if (this.loaded) {
      this.startAnimation();
    }
  }

  hide() {
    this.isVisible = false;
    this.stopAnimation();
  }

  startAnimation() {
    if (this.animationFrame) return;
    this.lastFrame = performance.now();
    this.animate();
  }

  stopAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  animate() {
    if (!this.isVisible) return;

    const now = performance.now();
    const elapsed = now - this.lastFrame;

    if (elapsed >= this.frameInterval) {
      this.time += elapsed * 0.001; // Convert to seconds
      this.render();
      this.lastFrame = now - (elapsed % this.frameInterval);
    }

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  render() {
    if (!this.loaded || !this.ctx) return;

    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Scale factor to fit 1920x1080 network into canvas
    const scaleX = w / 1920;
    const scaleY = h / 1080;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (w - 1920 * scale) / 2;
    const offsetY = (h - 1080 * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw glow layer with reduced opacity for subtlety
    if (this.glowImage) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(this.glowImage, 0, 0, 1920, 1080);
      ctx.globalAlpha = 1.0;
    }

    // Draw base network
    if (this.baseImage) {
      ctx.drawImage(this.baseImage, 0, 0, 1920, 1080);
    }

    // Draw animated flowing energy along selected paths
    this.drawFlowingEnergy(ctx);

    // Draw hub labels
    this.drawHubLabels(ctx);

    ctx.restore();
  }

  drawFlowingEnergy(ctx) {
    if (!this.animatedPaths.length) return;

    this.animatedPaths.forEach(({ path, meta, speed, offset }) => {
      if (path.length < 2) return;

      const phase = (this.time * speed + offset) % 1;
      const segmentCount = path.length - 1;
      
      // Draw multiple energy particles along the path
      for (let i = 0; i < 3; i++) {
        const particlePhase = (phase + i * 0.33) % 1;
        const position = particlePhase * segmentCount;
        const segmentIdx = Math.floor(position);
        const t = position - segmentIdx;

        if (segmentIdx >= segmentCount) continue;

        const [x1, y1] = path[segmentIdx];
        const [x2, y2] = path[segmentIdx + 1];
        
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;

        // Draw glowing particle
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 8);
        
        if (meta.kind === 'fusion') {
          gradient.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
          gradient.addColorStop(0.5, 'rgba(180, 120, 100, 0.5)');
        } else {
          gradient.addColorStop(0, 'rgba(82, 121, 111, 0.8)');
          gradient.addColorStop(0.5, 'rgba(82, 121, 111, 0.3)');
        }
        gradient.addColorStop(1, 'rgba(82, 121, 111, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x - 8, y - 8, 16, 16);
      }
    });
  }

  drawHubLabels(ctx) {
    if (!this.networkData || !this.networkData.hubs) return;

    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.networkData.hubs.forEach(hub => {
      if (hub.id === 'source') return; // Skip source label

      const { x, y, label } = hub;
      
      // Pulsing glow effect
      const pulse = Math.sin(this.time * 2) * 0.5 + 0.5;
      const glowSize = 30 + pulse * 10;
      
      // Draw glow
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      gradient.addColorStop(0, `rgba(82, 121, 111, ${0.3 + pulse * 0.2})`);
      gradient.addColorStop(1, 'rgba(82, 121, 111, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x - glowSize, y - glowSize, glowSize * 2, glowSize * 2);

      // Draw label text
      ctx.fillStyle = 'rgba(200, 220, 210, 0.9)';
      ctx.strokeStyle = 'rgba(11, 12, 13, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, x, y - 25);
      ctx.fillText(label, x, y - 25);
    });
  }

  destroy() {
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
    this.networkData = null;
    this.glowImage = null;
    this.baseImage = null;
  }
}

// Export singleton instance
const blogNetwork = new BlogNetwork();
export default blogNetwork;
