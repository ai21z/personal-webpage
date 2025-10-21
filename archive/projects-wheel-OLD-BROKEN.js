/**
 * Ritual Wheel - Projects Section
 * 
 * Apothecary jars arranged in a mystical wheel with portal-to-body magnification.
 * FOLLOWS THE EXACT PAPER PATTERN FROM app.js - no custom transforms.
 * 
 * Architecture:
 * - Portal pattern: jar → placeholder → body → animate
 * - Existing backdrop system (#paper-backdrop + .has-paper-open-global)
 * - Existing cursor ring system
 * - Standard z-index hierarchy
 * 
 * Performance: Transform/opacity only, 60fps
 * Accessibility: Roving tabindex, keyboard navigation, focus management
 */

// ━━━ Project Data ━━━

const projects = [
  {
    id: 'mycelij',
    title: 'MyceliJ — JVM-Native LLM',
    img: 'artifacts/projects/mycelij-no-bg.svg',
    blurb: 'Pure-Java language model leveraging Vector API and Structured Concurrency. Local-first, no Python dependencies.',
    featured: true,
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
  focusIndex: 0,
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

  // Create panel element (was missing!)
  createPanelElement(stage);
  
  // Build wheel structure
  buildWheel(container);
  
  // Position jars using CSS custom properties
  positionJars();
  
  // Set up event listeners
  attachEventListeners();
  
  // Set up resize observer
  setupResizeObserver();
  
  state.initialized = true;
  console.log('[Ritual Wheel] Initialized with', projects.length, 'jars');
}

export function destroyProjectsWheel() {
  if (!state.initialized) return;
  
  // Remove event listeners
  state.jarElements.forEach(jar => {
    jar.removeEventListener('mouseenter', handleJarMouseEnter);
    jar.removeEventListener('mouseleave', handleJarMouseLeave);
    jar.removeEventListener('click', handleJarClick);
    jar.removeEventListener('keydown', handleJarKeydown);
  });
  
  // Disconnect observer
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
  }
  
  // Close any open panel
  closePanel();
  
  // Clear state
  state = {
    initialized: false,
    activeJarId: null,
    focusIndex: 0,
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
  // Build SVG ritual rings
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
  
  // Create gradient for spokes
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
  gradient.setAttribute('id', 'rw-spoke-gradient');
  
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', 'transparent');
  
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', '#2DD4BF');
  
  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);
  svg.appendChild(defs);
  
  // Create rings group
  const ringsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  ringsGroup.classList.add('rw-rings');
  
  // Inner ritual circle
  const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  innerCircle.setAttribute('cx', '50');
  innerCircle.setAttribute('cy', '50');
  innerCircle.setAttribute('r', '40');
  innerCircle.classList.add('rw-ring-inner');
  
  // Outer ritual circle
  const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  outerCircle.setAttribute('cx', '50');
  outerCircle.setAttribute('cy', '50');
  outerCircle.setAttribute('r', '48');
  outerCircle.classList.add('rw-ring-outer');
  
  ringsGroup.appendChild(innerCircle);
  ringsGroup.appendChild(outerCircle);
  svg.appendChild(ringsGroup);
  
  // Create spokes group
  const spokesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  spokesGroup.classList.add('rw-spokes');
  
  projects.forEach((project, index) => {
    const spoke = createSpoke(index);
    spokesGroup.appendChild(spoke);
  });
  
  svg.appendChild(spokesGroup);
}

function createSpoke(index) {
  const spoke = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  spoke.setAttribute('data-spoke-index', index);
  
  // Calculate angle for this jar (N,E,S,W for 4 jars)
  const angle = getJarAngle(index);
  const radius = 40; // Match jar positioning radius
  
  // Calculate end point
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  
  // Create path from center to jar
  spoke.setAttribute('d', `M 50,50 L ${x},${y}`);
  
  return spoke;
}

function createJarElement(project, index) {
  const button = document.createElement('button');
  button.classList.add('rw-jar');
  button.setAttribute('data-jar-id', project.id);
  button.setAttribute('data-jar-index', index);
  button.setAttribute('aria-label', `${project.title} - Click to view details`);
  button.setAttribute('tabindex', index === 0 ? '0' : '-1');
  
  // Jar image
  const img = document.createElement('img');
  img.src = project.img;
  img.alt = '';
  img.loading = 'lazy';
  
  console.log(`[Ritual Wheel] Creating jar: ${project.id}, img: ${project.img}`);
  
  img.onload = () => {
    console.log(`[Ritual Wheel] ✅ Image loaded: ${project.id}`);
  };
  
  img.onerror = () => {
    console.error(`[Ritual Wheel] ❌ Failed to load image: ${project.img}`);
    // Make jar visible even without image
    button.style.border = '3px solid red';
    button.style.background = 'rgba(255, 0, 0, 0.2)';
    button.innerHTML = `<div style="color: red; font-size: 12px; text-align: center;">${project.id}<br>IMAGE FAILED</div>`;
  };
  
  // Jar label
  const label = document.createElement('span');
  label.classList.add('rw-jar-label');
  label.textContent = project.title.split('—')[0].trim(); // Show just the name
  
  button.appendChild(img);
  button.appendChild(label);
  
  return button;
}

function buildParchmentPanel() {
  const panel = document.createElement('article');
  panel.classList.add('rw-parchment-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'rw-panel-title');
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-hidden', 'true');
  
  document.querySelector('.rw-projects-stage').appendChild(panel);
}

// ━━━ Positioning ━━━

function getJarAngle(index) {
  // For N=3: Position in triangle (top, bottom-right, bottom-left)
  // Top is -90° (North), then clockwise for triangle
  if (projects.length === 3) {
    const angles = [
      -Math.PI / 2,           // 0: Top (North) - MyceliJ
      Math.PI / 6,            // 1: Bottom-right (30°) - LOQJ
      (5 * Math.PI) / 6       // 2: Bottom-left (150°) - True Rolls
    ];
    return angles[index];
  }
  
  // For other counts: even spacing
  const baseAngle = -Math.PI / 2; // Start at North
  const angleStep = (Math.PI * 2) / projects.length;
  return baseAngle + (index * angleStep);
}

function positionJars() {
  const chamber = document.querySelector('.rw-wheel-chamber');
  if (!chamber) {
    console.error('[Ritual Wheel] Chamber not found!');
    return;
  }
  
  const chamberSize = chamber.offsetWidth;
  const radiusPercent = 40; // 40% of container
  
  console.log(`[Ritual Wheel] Positioning ${state.jarElements.length} jars in chamber (size: ${chamberSize}px)`);
  
  state.jarElements.forEach((jar, index) => {
    const angle = getJarAngle(index);
    
    // Convert polar to cartesian (percentage-based)
    const xPercent = 50 + Math.cos(angle) * radiusPercent;
    const yPercent = 50 + Math.sin(angle) * radiusPercent;
    
    jar.style.setProperty('--jar-x', `${xPercent}%`);
    jar.style.setProperty('--jar-y', `${yPercent}%`);
    
    console.log(`[Ritual Wheel] Jar ${index} (${jar.dataset.jarId}): x=${xPercent.toFixed(1)}%, y=${yPercent.toFixed(1)}%`);
  });
}

// ━━━ Event Handlers ━━━

function attachEventListeners() {
  state.jarElements.forEach(jar => {
    jar.addEventListener('mouseenter', handleJarMouseEnter);
    jar.addEventListener('mouseleave', handleJarMouseLeave);
    jar.addEventListener('click', handleJarClick);
    jar.addEventListener('keydown', handleJarKeydown);
  });
  
  // Backdrop click to close
  const backdrop = document.getElementById('paper-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closePanel);
  }
  
  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeJarId) {
      closePanel();
    }
  });
}

function handleJarMouseEnter(e) {
  // Activate breathing ring cursor (reuse existing system)
  document.body.classList.add('hovering-paper');
  
  // Activate spoke
  const index = e.currentTarget.dataset.jarIndex;
  const spoke = document.querySelector(`[data-spoke-index="${index}"]`);
  if (spoke) {
    spoke.classList.add('rw-spoke-active');
  }
}

function handleJarMouseLeave(e) {
  // Deactivate cursor ring
  document.body.classList.remove('hovering-paper');
  
  // Deactivate spoke
  const index = e.currentTarget.dataset.jarIndex;
  const spoke = document.querySelector(`[data-spoke-index="${index}"]`);
  if (spoke) {
    spoke.classList.remove('rw-spoke-active');
  }
}

function handleJarClick(e) {
  const jarId = e.currentTarget.dataset.jarId;
  const project = projects.find(p => p.id === jarId);
  
  if (!project) return;
  
  openJar(e.currentTarget, project);
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
      
    case 'Tab':
      // Let natural tab order work (roving tabindex handles it)
      break;
  }
}

function moveFocus(newIndex) {
  // Update tabindex (roving pattern)
  state.jarElements.forEach((jar, i) => {
    jar.setAttribute('tabindex', i === newIndex ? '0' : '-1');
  });
  
  // Focus new jar
  state.jarElements[newIndex].focus();
  state.focusIndex = newIndex;
}

// ━━━ Jar Magnification (Portal Pattern) ━━━

function openJar(jarElement, project) {
  if (state.activeJarId) return; // Already open
  
  state.activeJarId = project.id;
  
  // Freeze dimensions
  const rect = jarElement.getBoundingClientRect();
  jarElement.style.width = `${rect.width}px`;
  jarElement.style.height = `${rect.height}px`;
  
  // Add magnified class
  jarElement.classList.add('rw-jar-magnified');
  
  // Set custom properties for transform
  jarElement.style.setProperty('--jar-mag-width', `${rect.width}px`);
  jarElement.style.setProperty('--jar-mag-height', `${rect.height}px`);
  jarElement.style.setProperty('--jar-mag-left', `${rect.left}px`);
  jarElement.style.setProperty('--jar-mag-top', `${rect.top}px`);
  
  // Calculate center translation
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const jarCenterX = rect.left + rect.width / 2;
  const jarCenterY = rect.top + rect.height / 2;
  
  jarElement.style.setProperty('--jar-tx', `${centerX - jarCenterX}px`);
  jarElement.style.setProperty('--jar-ty', `${centerY - jarCenterY}px`);
  jarElement.style.setProperty('--jar-scale', '1.8');
  
  // Dim other jars
  state.jarElements.forEach(jar => {
    if (jar !== jarElement) {
      jar.classList.add('rw-jar-dimmed');
    }
  });
  
  // Activate backdrop (reuse existing)
  document.body.classList.add('has-paper-open-global');
  
  // Show panel with project details
  showParchmentPanel(project);
  
  // Remove cursor hover state
  document.body.classList.remove('hovering-paper');
}

function closePanel() {
  if (!state.activeJarId) return;
  
  const activeJar = document.querySelector(`[data-jar-id="${state.activeJarId}"]`);
  
  // Remove magnified class
  if (activeJar) {
    activeJar.classList.remove('rw-jar-magnified');
    activeJar.style.width = '';
    activeJar.style.height = '';
  }
  
  // Un-dim other jars
  state.jarElements.forEach(jar => {
    jar.classList.remove('rw-jar-dimmed');
  });
  
  // Deactivate backdrop
  document.body.classList.remove('has-paper-open-global');
  
  // Hide panel
  const panel = document.querySelector('.rw-parchment-panel');
  if (panel) {
    panel.classList.remove('rw-panel-visible');
    panel.setAttribute('aria-hidden', 'true');
  }
  
  // Restore focus to jar
  if (activeJar) {
    activeJar.focus();
  }
  
  state.activeJarId = null;
}

function showParchmentPanel(project) {
  const panel = document.querySelector('.rw-parchment-panel');
  if (!panel) return;
  
  // Build content
  panel.innerHTML = `
    <h2 id="rw-panel-title" class="rw-panel-title">${project.title}</h2>
    <p class="rw-panel-blurb">${project.blurb}</p>
    <nav class="rw-panel-actions">
      ${project.links.map(link => `
        <a href="${link.url}" class="rw-panel-link" target="${link.url.startsWith('http') ? '_blank' : '_self'}" rel="${link.url.startsWith('http') ? 'noopener noreferrer' : ''}">${link.label}</a>
      `).join('')}
    </nav>
  `;
  
  // Show panel
  setTimeout(() => {
    panel.classList.add('rw-panel-visible');
    panel.setAttribute('aria-hidden', 'false');
  }, 100);
}

// ━━━ Resize Observer ━━━

function setupResizeObserver() {
  const chamber = document.querySelector('.rw-wheel-chamber');
  if (!chamber) return;
  
  let resizeTimeout;
  
  state.resizeObserver = new ResizeObserver(() => {
    // Debounce reposition
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      positionJars();
    }, 100);
  });
  
  state.resizeObserver.observe(chamber);
}
