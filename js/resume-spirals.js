/**
 * ━━━ MYCELIAL RESUME - SPACE-TIME SPIRAL TIMELINE ━━━
 * Four career paths as gravitational time spirals
 * Each spiral represents a career timeline with distorted clock numbers
 */

// Career data with milestones (year/position on spiral)
const CAREER_DATA = {
  environmental: {
    title: "Environmental",
    color: "rgba(122,174,138,1)",
    milestones: [
      { year: 2015, position: 0.2, label: "Water/Soil Analysis" },
      { year: 2016, position: 0.35, label: "Lab Technician" },
      { year: 2017, position: 0.5, label: "Wastewater Treatment" },
      { year: 2018, position: 0.65, label: "Environmental Compliance" },
      { year: 2019, position: 0.8, label: "Research Methods" }
    ]
  },
  'ui-i18n': {
    title: "UI/i18n/l10n",
    color: "rgba(143,180,255,1)",
    milestones: [
      { year: 2017, position: 0.25, label: "Greek ↔ English Translation" },
      { year: 2018, position: 0.4, label: "UX Engineering" },
      { year: 2019, position: 0.55, label: "Internationalization" },
      { year: 2020, position: 0.7, label: "Localization Systems" },
      { year: 2021, position: 0.85, label: "UI Translation Lead" }
    ]
  },
  developer: {
    title: "Developer",
    color: "rgba(255,122,51,1)",
    milestones: [
      { year: 2018, position: 0.15, label: "Python & SQL" },
      { year: 2019, position: 0.3, label: "React & TypeScript" },
      { year: 2020, position: 0.45, label: "Full-Stack Engineer" },
      { year: 2021, position: 0.6, label: "Backend Architecture" },
      { year: 2022, position: 0.75, label: "Senior Developer" },
      { year: 2023, position: 0.9, label: "System Design" }
    ]
  },
  music: {
    title: "Music Artist",
    color: "rgba(186,85,211,1)",
    milestones: [
      { year: 2010, position: 0.2, label: "Guitar & Piano" },
      { year: 2014, position: 0.35, label: "Music Composition" },
      { year: 2017, position: 0.5, label: "Sound Design" },
      { year: 2020, position: 0.65, label: "Audio Production" },
      { year: 2023, position: 0.8, label: "Horror Soundscapes" }
    ]
  }
};

let activeTooltip = null;

/**
 * Initialize the resume spiral system
 */
export function initResumeSpirals() {
  const spiralField = document.querySelector('.resume-spiral-field');
  if (!spiralField) return;

  // Create all four career spirals
  Object.entries(CAREER_DATA).forEach(([career, data]) => {
    const spiralElement = spiralField.querySelector(`[data-career="${career}"]`);
    if (spiralElement) {
      renderCareerSpiral(spiralElement, career, data);
    }
  });

  // Add mycelium connecting strands
  renderMyceliumStrands(spiralField);

  // Initialize cosmic particles
  initCosmicParticles();

  console.log('[Resume] Space-time spirals initialized');
}

/**
 * Render a single career spiral with clock numbers and milestones
 */
function renderCareerSpiral(container, career, data) {
  const svg = container.querySelector('.spiral-canvas');
  if (!svg) return;

  const viewBox = 400; // SVG viewBox size
  svg.setAttribute('viewBox', `0 0 ${viewBox} ${viewBox}`);

  const centerX = viewBox / 2;
  const centerY = viewBox / 2;

  // Generate spiral path with gravitational distortion
  const spiralPath = generateGravitationalSpiral(centerX, centerY, career);
  
  // Create spiral path element
  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('class', 'spiral-path');
  pathEl.setAttribute('d', spiralPath.d);
  svg.appendChild(pathEl);

  // Add clock numbers (1-12) along spiral with distortion
  for (let i = 1; i <= 12; i++) {
    const t = i / 12; // Position along spiral (0 to 1)
    const point = getPointOnSpiral(spiralPath.points, t);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'spiral-clock-number');
    text.setAttribute('x', point.x);
    text.setAttribute('y', point.y);
    text.textContent = i;
    svg.appendChild(text);
  }

  // Add career milestones
  data.milestones.forEach((milestone, index) => {
    const point = getPointOnSpiral(spiralPath.points, milestone.position);
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'career-milestone');
    circle.setAttribute('cx', point.x);
    circle.setAttribute('cy', point.y);
    circle.setAttribute('data-year', milestone.year);
    circle.setAttribute('data-label', milestone.label);
    circle.setAttribute('data-career', career);
    
    // Add hover events for tooltip
    circle.addEventListener('mouseenter', (e) => showMilestoneTooltip(e, milestone, data.title));
    circle.addEventListener('mouseleave', hideMilestoneTooltip);
    
    svg.appendChild(circle);
  });

  // Add career title
  const titleEl = document.createElement('div');
  titleEl.className = 'career-title';
  titleEl.textContent = data.title;
  container.appendChild(titleEl);
}

/**
 * Generate a gravitationally-distorted logarithmic spiral
 * Space-time warping effect near the center
 */
function generateGravitationalSpiral(cx, cy, career) {
  const points = [];
  const turns = 3; // Number of spiral revolutions
  const maxRadius = 150; // Maximum radius in SVG units
  const minRadius = 20; // Minimum radius (near center)
  
  // Career-specific rotation offset for visual variety
  const rotationOffset = {
    environmental: 0,
    'ui-i18n': Math.PI / 4,
    developer: Math.PI / 2,
    music: (3 * Math.PI) / 4
  }[career] || 0;

  // Generate spiral points
  for (let i = 0; i <= 100; i++) {
    const t = i / 100; // Normalized position (0 to 1)
    
    // Logarithmic spiral with gravitational compression near center
    const angle = turns * 2 * Math.PI * t + rotationOffset;
    
    // Radius with exponential growth + gravitational warping
    const baseRadius = minRadius + (maxRadius - minRadius) * Math.pow(t, 0.7);
    
    // Gravitational distortion (stronger near center)
    const gravityFactor = 1 + 0.5 * Math.sin(angle * 2) * Math.exp(-t * 3);
    const radius = baseRadius * gravityFactor;
    
    // Convert polar to Cartesian coordinates
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    
    points.push({ x, y, t });
  }

  // Generate SVG path
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    // Use quadratic curves for smoothness
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    d += ` Q ${cpx} ${cpy}, ${curr.x} ${curr.y}`;
  }

  return { d, points };
}

/**
 * Get a point along the spiral at normalized position t (0 to 1)
 */
function getPointOnSpiral(points, t) {
  const index = Math.floor(t * (points.length - 1));
  const nextIndex = Math.min(index + 1, points.length - 1);
  const localT = (t * (points.length - 1)) - index;
  
  const p1 = points[index];
  const p2 = points[nextIndex];
  
  // Linear interpolation
  return {
    x: p1.x + (p2.x - p1.x) * localT,
    y: p1.y + (p2.y - p1.y) * localT
  };
}

/**
 * Render mycelium connecting strands between spirals
 */
function renderMyceliumStrands(container) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '1';
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Define connection points (center of each quadrant)
  const connections = [
    { x1: 25, y1: 25, x2: 75, y2: 25 }, // Top: env to ui
    { x1: 25, y1: 25, x2: 25, y2: 75 }, // Left: env to dev
    { x1: 75, y1: 25, x2: 75, y2: 75 }, // Right: ui to music
    { x1: 25, y1: 75, x2: 75, y2: 75 }, // Bottom: dev to music
    { x1: 25, y1: 25, x2: 75, y2: 75 }, // Diagonal: env to music
    { x1: 75, y1: 25, x2: 25, y2: 75 }  // Diagonal: ui to dev
  ];

  connections.forEach(({ x1, y1, x2, y2 }) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // Create organic curve
    const cpx = (x1 + x2) / 2 + (Math.random() - 0.5) * 20;
    const cpy = (y1 + y2) / 2 + (Math.random() - 0.5) * 20;
    const d = `M ${x1} ${y1} Q ${cpx} ${cpy}, ${x2} ${y2}`;
    
    path.setAttribute('class', 'mycelium-strand');
    path.setAttribute('d', d);
    path.style.animationDelay = `${Math.random() * 3}s`;
    
    svg.appendChild(path);
  });

  container.appendChild(svg);
}

/**
 * Show milestone tooltip on hover
 */
function showMilestoneTooltip(event, milestone, careerTitle) {
  const tooltip = getOrCreateTooltip();
  tooltip.innerHTML = `<strong>${milestone.year}</strong>${milestone.label}<br><small>${careerTitle}</small>`;
  
  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top}px`;
  tooltip.classList.add('visible');
  
  activeTooltip = tooltip;
}

/**
 * Hide milestone tooltip
 */
function hideMilestoneTooltip() {
  if (activeTooltip) {
    activeTooltip.classList.remove('visible');
  }
}

/**
 * Get or create the shared tooltip element
 */
function getOrCreateTooltip() {
  let tooltip = document.querySelector('.milestone-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'milestone-tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

/**
 * Initialize floating cosmic particles
 */
function initCosmicParticles() {
  const particleContainer = document.querySelector('.resume-particles');
  if (!particleContainer) return;

  const particleCount = 30;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'cosmic-particle';
    
    // Random starting position
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    
    // Random drift direction
    particle.style.setProperty('--drift-x', `${(Math.random() - 0.5) * 200}px`);
    particle.style.setProperty('--drift-y', `${(Math.random() - 0.5) * 200}px`);
    
    // Random animation delay
    particle.style.animationDelay = `${Math.random() * 15}s`;
    particle.style.animationDuration = `${12 + Math.random() * 8}s`;
    
    particleContainer.appendChild(particle);
  }
}

/**
 * Cleanup function (called when leaving resume page)
 */
export function cleanupResumeSpirals() {
  if (activeTooltip) {
    activeTooltip.remove();
    activeTooltip = null;
  }
  console.log('[Resume] Spirals cleaned up');
}
