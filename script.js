/* ━━━ Necrography — Vissarion Zounarakis ━━━
 * Minimal, framework-free JS for:
 * - Simple sigil rotation on click
 * - Basic particle effect
 * - Social links reveal
 * - Accessibility support
 */

// ━━━ A11y: Insert current year in footer ━━━
document.getElementById('yr').textContent = new Date().getFullYear();

// ━━━ PRM Gate: Detect user preference ━━━
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ━━━ Sigil Interaction: Simple Rotation + Particle Effect ━━━
const sigilWrap = document.querySelector('.sigil-wrap');
const sigilImg  = document.getElementById('sigil');
let flipped = false;

/**
 * Simple Particle Effect
 * Creates ~12 lightweight particles that fly outward and fade
 */
function simpleParticles(x, y) {
  if (prefersReducedMotion) return;
  
  const layer = document.createElement('div');
  Object.assign(layer.style, {
    position:'absolute', 
    inset:0, 
    overflow:'hidden', 
    pointerEvents:'none',
    zIndex:999
  });
  document.body.appendChild(layer);
  
  const count = 12;
  for (let i=0; i<count; i++){
    const particle = document.createElement('span');
    const angle = (Math.PI * 2) * (i / count);
    const distance = 50 + Math.random() * 30;
    const size = 3;
    
    Object.assign(particle.style, {
      position:'absolute',
      left: x + 'px', 
      top: y + 'px',
      width: size + 'px', 
      height: size + 'px',
      borderRadius:'50%',
      background:'rgba(230,227,216,.7)',
      transform:'translate(-50%,-50%)',
      transition:'transform .5s ease-out, opacity .5s ease-out'
    });
    
    layer.appendChild(particle);
    
    // Animate in next frame
    requestAnimationFrame(() => {
      particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
      particle.style.opacity = '0';
    });
  }
  
  // Clean up after animation
  setTimeout(() => layer.remove(), 600);
}

/**
 * Sigil Activation Handler
 * Simple rotation + particle effect
 */
function onActivate(e) {
  e.preventDefault();
  
  // Get sigil center for particles
  const rect = sigilImg.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  // Toggle rotation state
  flipped = !flipped;
  sigilImg.style.transform = `rotate(${flipped ? 180 : 0}deg)`;

  // Simple particle effect
  simpleParticles(cx, cy);

  // A11y: Announce state change to screen readers
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = flipped 
    ? 'Sigil rotated 180 degrees.' 
    : 'Sigil restored to original position.';
  
  // Visually hidden but accessible to screen readers
  Object.assign(announcement.style, {
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden'
  });
  
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

// Click handler
sigilWrap.addEventListener('click', onActivate);

// Keyboard handler (Enter or Space)
sigilWrap.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    onActivate(e);
  }
});

/* ━━━ NOTES ━━━
 * 
 * Background:
 * - fungi-01.png: Base ambient texture (very dim)
 * 
 * Animations:
 * - Text reveals smoothly over 3 seconds
 * - Sigil rotates 180° on click
 * - Simple particle effect (12 particles)
 * - All animations respect prefers-reduced-motion
 */
