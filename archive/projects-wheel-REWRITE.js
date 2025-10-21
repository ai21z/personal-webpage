/**
 * Ritual Wheel - Projects Section (PROPER REWRITE)
 * 
 * Apothecary jars arranged in a mystical wheel with portal-to-body magnification.
 * FOLLOWS THE EXACT PAPER PATTERN FROM app.js
 * 
 * Architecture:
 * - Portal pattern: jar → placeholder → body → animate (same as papers)
 * - Existing backdrop system (#paper-backdrop + .has-paper-open-global)
 * - Standard z-index hierarchy
 * 
 * Performance: Transform/opacity only, 60fps
 * Accessibility: Roving tabindex, keyboard navigation, ARIA
 */

// ━━━ Project Data ━━━

const projects = [
  {
    id: 'mycelij',
    title: 'MyceliJ — JVM-Native LLM',
    img: 'artifacts/projects/mycelij-no-bg.svg',
    blurb: 'Pure-Java language model leveraging Vector API and Structured Concurrency. Local-first, no Python dependencies.',
    links: [
      { label: 'Documentation', url: '/projects/mycelij' },
      { label: 'GitHub', url: '#' }
    ]
  },
  {
    id: 'loqj',
    title: 'LOQJ — CLI Framework',
    img: 'artifacts/projects/jar-loqj-no-bg.svg',
    blurb: 'Developer toolkit for rapid prototyping with intelligent code generation.',
    links: [
      { label: 'NPM Package', url: '#' },
      { label: 'Docs', url: '/projects/loqj' }
    ]
  },
  {
    id: 'truerolls',
    title: 'True Rolls — Dice System',
    img: 'artifacts/projects/true-rolls-no-bg.svg',
    blurb: 'Cryptographically fair dice rolling with beautiful physics simulation.',
    links: [
      { label: 'Live Demo', url: '/projects/truerolls' },
      { label: 'Source', url: '#' }
    ]
  }
];

// ━━━ State ━━━

let state = {
  initialized: false,
  activeJar: null,
  panelElement: null,
  jarElements: [],
  resizeObserver: null
};

// ━━━ Initialization ━━━

export function initProjectsWheel() {
  if (state.initialized) {
    console.warn('[Ritual Wheel] Already initialized');
    return;
  }

  const container = document.querySelector('.rw-jar-constellation');
  const stage = document.querySelector('.rw-projects-stage');
  
  if (!container || !stage) {
    console.error('[Ritual Wheel] Required elements not found');
    return;
  }

  // Create panel element
  createPanelElement(stage);
  
  // Build wheel
  buildWheel(container);
  
  // Position jars
  positionJars();
  
  // Attach events
  attachEventListeners();
  
  // Resize observer
  setupResizeObserver();
  
  state.initialized = true;
  console.log('[Ritual Wheel] Initialized with', projects.length, 'jars');
}

export function destroyProjectsWheel() {
  if (!state.initialized) return;
  
  // Close if open
  if (state.activeJar) {
    closePanel();
  }
  
  // Remove listeners
  state.jarElements.forEach(jar => {
    jar.removeEventListener('click', handleJarClick);
    jar.removeEventListener('keydown', handleJarKeydown);
  });
  
  const backdrop = document.getElementById('paper-backdrop');
  if (backdrop) {
    backdrop.removeEventListener('click', closePanel);
  }
  
  // Disconnect observer
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
  }
  
  // Reset state
  state = {
    initialized: false,
    activeJar: null,
    panelElement: null,
    jarElements: [],
    resizeObserver: null
  };
  
  console.log('[Ritual Wheel] Destroyed');
}

// ━━━ DOM Building ━━━

function createPanelElement(stage) {
  const panel = document.createElement('article');
  panel.className = 'rw-parchment-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'rw-panel-title');
  panel.innerHTML = `
    <h2 class="rw-panel-title" id="rw-panel-title"></h2>
    <p class="rw-panel-blurb"></p>
    <nav class="rw-panel-actions" aria-label="Project links"></nav>
  `;
  stage.appendChild(panel);
  state.panelElement = panel;
}

function buildWheel(container) {
  // Build SVG rings
  buildRitualRings();
  
  // Build jars
  projects.forEach((project, index) => {
    const jar = createJarElement(project, index);
    container.appendChild(jar);
    state.jarElements.push(jar);
  });
}

function buildRitualRings() {
  const svg = document.querySelector('.rw-ritual-rings');
  if (!svg) return;
  
  // Rings group
  const ringsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  ringsGroup.classList.add('rw-rings');
  
  // Inner circle
  const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  inner.setAttribute('cx', '50');
  inner.setAttribute('cy', '50');
  inner.setAttribute('r', '40');
  
  // Outer circle
  const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  outer.setAttribute('cx', '50');
  outer.setAttribute('cy', '50');
  outer.setAttribute('r', '48');
  outer.classList.add('rw-ring-outer');
  
  ringsGroup.appendChild(inner);
  ringsGroup.appendChild(outer);
  svg.appendChild(ringsGroup);
}

function createJarElement(project, index) {
  const button = document.createElement('button');
  button.classList.add('rw-jar');
  button.setAttribute('data-jar-id', project.id);
  button.setAttribute('data-jar-index', index);
  button.setAttribute('aria-label', `${project.title} - Click to view details`);
  button.setAttribute('tabindex', index === 0 ? '0' : '-1');
  
  // Image
  const img = document.createElement('img');
  img.src = project.img;
  img.alt = '';
  img.loading = 'lazy';
  
  // Label
  const label = document.createElement('span');
  label.classList.add('rw-jar-label');
  label.textContent = project.title.split('—')[0].trim();
  
  button.appendChild(img);
  button.appendChild(label);
  
  return button;
}

// ━━━ Positioning ━━━

function getJarAngle(index) {
  // Triangle formation for 3 jars
  if (projects.length === 3) {
    const angles = [
      -Math.PI / 2,        // Top (North)
      Math.PI / 6,         // Bottom-right (30°)
      (5 * Math.PI) / 6    // Bottom-left (150°)
    ];
    return angles[index];
  }
  
  // Even spacing for other counts
  const baseAngle = -Math.PI / 2;
  const angleStep = (Math.PI * 2) / projects.length;
  return baseAngle + (index * angleStep);
}

function positionJars() {
  const radiusPercent = 40; // 40% of container
  
  state.jarElements.forEach((jar, index) => {
    const angle = getJarAngle(index);
    const xPercent = 50 + Math.cos(angle) * radiusPercent;
    const yPercent = 50 + Math.sin(angle) * radiusPercent;
    
    // Use CSS custom properties (matching CSS)
    jar.style.setProperty('--jar-x', `${xPercent}%`);
    jar.style.setProperty('--jar-y', `${yPercent}%`);
  });
}

// ━━━ Event Handling ━━━

function attachEventListeners() {
  // Jar interactions
  state.jarElements.forEach(jar => {
    jar.addEventListener('click', handleJarClick);
    jar.addEventListener('keydown', handleJarKeydown);
  });
  
  // Backdrop close
  const backdrop = document.getElementById('paper-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closePanel);
  }
  
  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeJar) {
      closePanel();
    }
  });
}

function handleJarClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const jar = e.currentTarget;
  const projectId = jar.dataset.jarId;
  const project = projects.find(p => p.id === projectId);
  
  if (!project) return;
  
  openJar(jar, project);
}

function handleJarKeydown(e) {
  const currentIndex = parseInt(e.currentTarget.dataset.jarIndex);
  
  switch (e.key) {
    case 'Enter':
    case ' ':
      e.preventDefault();
      handleJarClick(e);
      break;
      
    case 'ArrowRight':
      e.preventDefault();
      moveFocus((currentIndex + 1) % state.jarElements.length);
      break;
      
    case 'ArrowLeft':
      e.preventDefault();
      moveFocus((currentIndex - 1 + state.jarElements.length) % state.jarElements.length);
      break;
  }
}

function moveFocus(newIndex) {
  state.jarElements.forEach((jar, i) => {
    jar.setAttribute('tabindex', i === newIndex ? '0' : '-1');
  });
  state.jarElements[newIndex].focus();
}

// ━━━ Portal Pattern (Exact Copy from app.js paper system) ━━━

function openJar(jar, project) {
  if (state.activeJar) return;
  
  state.activeJar = jar;
  
  // 1. Get current position
  const r = jar.getBoundingClientRect();
  
  // 2. Create placeholder
  const placeholder = document.createElement('div');
  placeholder.className = 'rw-jar-placeholder';
  placeholder.style.visibility = 'hidden';
  placeholder.style.pointerEvents = 'none';
  
  // 3. Portal to body
  jar.__portal = { parent: jar.parentNode, placeholder: placeholder };
  jar.__portal.parent.insertBefore(placeholder, jar);
  document.body.appendChild(jar);
  
  // 4. Make fixed with frozen position
  jar.classList.add('rw-jar-magnified');
  jar.style.position = 'fixed';
  jar.style.left = `${r.left}px`;
  jar.style.top = `${r.top}px`;
  jar.style.width = `${r.width}px`;
  jar.style.height = `${r.height}px`;
  
  // 5. Start with zero transform
  jar.style.setProperty('--open-tx', '0px');
  jar.style.setProperty('--open-ty', '0px');
  jar.style.setProperty('--open-scale', '1');
  
  // 6. Calculate center translation
  const vw = window.innerWidth, vh = window.innerHeight;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const tx = (vw / 2) - cx;
  const ty = (vh / 2) - cy;
  const scale = 1.8;
  
  // 7. Animate to center
  requestAnimationFrame(() => {
    jar.style.setProperty('--open-tx', `${tx}px`);
    jar.style.setProperty('--open-ty', `${ty}px`);
    jar.style.setProperty('--open-scale', `${scale}`);
  });
  
  // 8. Dim other jars
  state.jarElements.forEach(j => {
    if (j !== jar) {
      j.classList.add('rw-jar-dimmed');
      j.setAttribute('aria-hidden', 'true');
    }
  });
  
  // 9. Activate backdrop
  jar.setAttribute('role', 'dialog');
  jar.setAttribute('aria-modal', 'true');
  document.body.classList.add('has-paper-open-global');
  
  // 10. Show panel
  showPanel(project);
  
  // 11. Focus
  requestAnimationFrame(() => {
    jar.focus({ preventScroll: true });
  });
}

function closePanel() {
  if (!state.activeJar) return;
  
  const jar = state.activeJar;
  
  // 1. Animate back
  jar.style.setProperty('--open-tx', '0px');
  jar.style.setProperty('--open-ty', '0px');
  jar.style.setProperty('--open-scale', '1');
  
  // 2. Clean up on transition end
  const cleanup = () => {
    jar.classList.remove('rw-jar-magnified');
    jar.removeAttribute('role');
    jar.removeAttribute('aria-modal');
    jar.style.position = '';
    jar.style.left = '';
    jar.style.top = '';
    jar.style.width = '';
    jar.style.height = '';
    jar.style.removeProperty('--open-tx');
    jar.style.removeProperty('--open-ty');
    jar.style.removeProperty('--open-scale');
    
    // Portal return
    if (jar.__portal) {
      jar.__portal.parent.insertBefore(jar, jar.__portal.placeholder);
      jar.__portal.placeholder.remove();
      jar.__portal = null;
    }
    
    jar.removeEventListener('transitionend', cleanup);
  };
  
  jar.addEventListener('transitionend', cleanup, { once: true });
  
  // 3. Un-dim jars
  state.jarElements.forEach(j => {
    j.classList.remove('rw-jar-dimmed');
    j.removeAttribute('aria-hidden');
  });
  
  // 4. Hide panel
  hidePanel();
  
  // 5. Deactivate backdrop
  document.body.classList.remove('has-paper-open-global');
  
  // 6. Clear state
  state.activeJar = null;
}

// ━━━ Panel Management ━━━

function showPanel(project) {
  if (!state.panelElement) return;
  
  const panel = state.panelElement;
  
  // Populate content
  panel.querySelector('.rw-panel-title').textContent = project.title;
  panel.querySelector('.rw-panel-blurb').textContent = project.blurb;
  
  const actions = panel.querySelector('.rw-panel-actions');
  actions.innerHTML = '';
  project.links.forEach(link => {
    const a = document.createElement('a');
    a.href = link.url;
    a.className = 'rw-panel-link';
    a.textContent = link.label;
    actions.appendChild(a);
  });
  
  // Show
  panel.classList.add('rw-panel-visible');
  panel.removeAttribute('aria-hidden');
}

function hidePanel() {
  if (!state.panelElement) return;
  
  state.panelElement.classList.remove('rw-panel-visible');
  state.panelElement.setAttribute('aria-hidden', 'true');
}

// ━━━ Resize Observer ━━━

function setupResizeObserver() {
  if (!window.ResizeObserver) return;
  
  const chamber = document.querySelector('.rw-wheel-chamber');
  if (!chamber) return;
  
  state.resizeObserver = new ResizeObserver(() => {
    if (!state.activeJar) {
      positionJars();
    }
  });
  
  state.resizeObserver.observe(chamber);
}
