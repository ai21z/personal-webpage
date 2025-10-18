/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MAIN ENTRY POINT
 * Necrography — Vissarion Zounarakis
 * Modular architecture with ES6 modules
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// Import configuration
import { NAV_COORDS, NAV_ORDER } from './core/config.js';

// Import state management
import { COVER, setMycMap, setGraph } from './core/state.js';

// Import utilities
import { computeCoverFromImage, coverMap, sizeCanvas } from './utils/geometry.js';

/**
 * A11y: Insert current year in footer
 */
const yearElement = document.getElementById('yr');
if (yearElement) yearElement.textContent = new Date().getFullYear();

/**
 * Initialize application
 */
async function init() {
  console.log('🌿 Initializing Necrography...');
  console.log('📦 Loaded modules:', { NAV_COORDS, NAV_ORDER });
  console.log('🎨 COVER state:', COVER);
  
  // Test geometry utilities
  const bgImg = document.getElementById('bg-front-img');
  if (bgImg) {
    if (bgImg.complete && bgImg.naturalWidth) {
      computeCoverFromImage(bgImg);
    } else {
      bgImg.addEventListener('load', () => computeCoverFromImage(bgImg));
    }
  }
  
  // TODO: Load mycelium data
  // TODO: Initialize graph
  // TODO: Initialize canvases
  // TODO: Initialize navigation
  // TODO: Initialize sections
  
  console.log('✅ Modular initialization complete');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.DEBUG = {
  COVER,
  NAV_COORDS,
  coverMap,
  sizeCanvas
};
