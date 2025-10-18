/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CONFIGURATION & CONSTANTS
 * Central location for all magic numbers, design anchors, and settings
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Navigation Anchors (1920×1080 image space reference)
 * LOCKED-ROUTE: Fixed design coordinates - DO NOT CHANGE
 */
export const NAV_COORDS = {
  intro:   { x: 1640, y: 160 },
  about:   { x: 1466, y: 179 },
  work:    { x: 1463, y: 275 },
  projects:{ x: 1170, y: 404 },
  contact: { x: 1524, y: 411 },
  blog:    { x: 1624, y: 429 },
  resume:  { x:  1432, y: 637 },
  skills:  { x:  1119, y: 240 }
};

export const NAV_ORDER = ['intro','about','work','projects','contact','blog','resume','skills'];

/**
 * Label positioning offsets (pixels from anchor point)
 */
export const LABEL_OFFSET_PX = {
  intro: 34, about: 26, work: 24, projects: 22,
  contact: 24, blog: 26, resume: 20, skills: 24
};

/**
 * Label animation speeds (pixels per second)
 */
export const LABEL_SPEEDS = { 
  about: 65, work: 70, projects: 75, contact: 68, 
  blog: 72, resume: 66, skills: 74
};

export const DEFAULT_SPEED = 68; // fallback

/**
 * Ritual/Animation Constants
 */
export const RITUAL_RETURN_MS = 420;      // Duration to glide home (ms)
export const NAV_SPEED_WHEN_ACTIVE = 48;  // Reduced speed during ritual for clickability

/**
 * Graph Building Constants
 */
export const GRAPH_QUANT = 3; // Spatial quantization for node deduplication

/**
 * Pathfinding Constants
 */
export const NEAREST_NODE_RADIUS = 80;  // Search radius for nearest node
export const NEAREST_NODE_STEP = 24;    // Step size for nearest node search
