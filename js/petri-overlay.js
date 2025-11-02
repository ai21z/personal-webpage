// petri-overlay.js — Petri Dish navigation overlay for blog map
// Draws a clean HiDPI ring with cardinal navigation buttons
// Emits/consumes blog events to stay decoupled from WebGL layer

(() => {
  console.log('[Petri] Module loaded');
  
  const root   = document.getElementById('petri');
  const canvas = document.getElementById('petriCanvas');
  if (!root || !canvas) {
    console.warn('[Petri] Required elements not found');
    return;
  }
  
  const ctx    = canvas.getContext('2d');
  const DPR    = Math.max(1, Math.floor(window.devicePixelRatio || 1)); // HiDPI scaling
  let radiusPx = 0, center=[0,0], running=true;

  // HUD wiring (motion + map)
  const btnMotion = document.getElementById('btnMotion');
  const btnMap    = document.getElementById('btnMap');
  const mqReduce  = window.matchMedia('(prefers-reduced-motion: reduce)'); // A11y

  if (!btnMotion || !btnMap) {
    console.warn('[Petri] HUD buttons not found');
    return;
  }

  function setRunning(on) {
    running = on && !mqReduce.matches;
    btnMotion.setAttribute('aria-pressed', running ? 'true' : 'false');
    btnMotion.style.opacity = running ? '1' : '0.6';
    console.log('[Petri] Motion:', running);
  }

  btnMotion.addEventListener('click', () => {
    const isPressed = btnMotion.getAttribute('aria-pressed') === 'true';
    setRunning(!isPressed);
  });
  
  btnMap.addEventListener('click', () => {
    console.log('[Petri] Map button clicked');
    window.dispatchEvent(new CustomEvent('blog:map'));
  });

  // Scale canvas for crisp ring (HiDPI)
  function resize() {
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    canvas.width  = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    center = [cssW * 0.5, cssH * 0.5];
    radiusPx = Math.min(cssW, cssH) * 0.48;
    draw();
    console.log('[Petri] Resized:', { cssW, cssH, DPR, radiusPx });
    
    // Tell WebGL layer our central anchor changed (no Y inversion)
    window.dispatchEvent(new CustomEvent('blog:transform', { 
      detail: { scale: 1, offset: [0, 0] }
    }));
  }
  
  window.addEventListener('resize', resize);

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [cx, cy] = center, r = radiusPx;
    
    // Frosted disk (subtle background fill)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(160, 190, 180, 0.03)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    
    // Outer ring
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    
    // Tick marks at cardinal points
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = 'rgba(255, 130, 60, 0.35)';
    const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2]; // N, E, S, W
    cardinals.forEach(a => {
      const x1 = cx + Math.cos(a) * (r - 14);
      const y1 = cy + Math.sin(a) * (r - 14);
      const x2 = cx + Math.cos(a) * (r + 10);
      const y2 = cy + Math.sin(a) * (r + 10);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
  }

  // Hover -> highlight hub (WebGL controls the glow)
  function handleHover(e) {
    const hubId = e.currentTarget.dataset.hub;
    console.log('[Petri] Hover:', hubId);
    window.dispatchEvent(new CustomEvent('blog:hover', { 
      detail: { hubId, source: 'petri' }
    }));
    
    // aria-current for visual affordance
    document.querySelectorAll('.petri-label').forEach(b => b.removeAttribute('aria-current'));
    e.currentTarget.setAttribute('aria-current', 'true');
  }
  
  function handleHoverOff(e) {
    const hubId = e.currentTarget.dataset.hub;
    window.dispatchEvent(new CustomEvent('blog:hover-off', { 
      detail: { hubId }
    }));
    e.currentTarget.removeAttribute('aria-current');
  }
  
  // Click -> enter category
  function handleClick(e) {
    const hubId = e.currentTarget.dataset.hub;
    console.log('[Petri] Click:', hubId);
    window.dispatchEvent(new CustomEvent('blog:navigate', {
      detail: { hubId }
    }));
  }
  
  // Wire up all curved text labels
  document.querySelectorAll('.petri-label').forEach(label => {
    label.addEventListener('mouseenter', handleHover);
    label.addEventListener('mouseleave', handleHoverOff);
    label.addEventListener('focus', handleHover); // keyboard focus mirrors hover
    label.addEventListener('blur', handleHoverOff);
    label.addEventListener('click', handleClick);
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    });
  });

  // Public lifecycle
  window.addEventListener('blog:visible', (e) => {
    console.log('[Petri] Blog visible:', e.detail);
    resize();
  }, { once: true });
  
  // Reduced motion changes at runtime
  if (mqReduce.addEventListener) {
    mqReduce.addEventListener('change', () => setRunning(running));
  }

  // Init
  setRunning(!mqReduce.matches);
  
  console.log('[Petri] Initialized');
})();
