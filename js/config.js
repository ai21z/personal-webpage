/**
 * Configuration constants for Necrography
 * All design anchors, speeds, and layout parameters
 */

// ━━━ Ritual Animation ━━━
export const RITUAL_RETURN_MS = 420;          // duration to glide home
export const NAV_SPEED_WHEN_ACTIVE = 48;      // reduced by ~17% for better clickability

// ━━━ Design Anchors (1920×1080 reference) ━━━
// [LOCKED-ROUTE] Fixed design anchors in image space - DO NOT CHANGE
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

// Resume disabled for now - removed from NAV_ORDER
export const NAV_ORDER = ['intro','about','work','projects','contact','blog','skills'];

export const LABEL_OFFSET_PX = {
  intro: 34, about: 26, work: 24, projects: 22,
  contact: 24, blog: 26, resume: 20, skills: 24
};

// ━━━ Label Animation Speeds ━━━
export const LABEL_SPEEDS = { 
  about: 65, work: 70, projects: 75, contact: 68, 
  blog: 72, resume: 66, skills: 74
};
export const DEFAULT_SPEED = 68; // fallback if label not in LABEL_SPEEDS

// ━━━ Spark System ━━━
export const MAX_SPARKS = 12;

// ━━━ Locked Route Parameters ━━━
export const MIN_ROUTE_LEN_PX     = 320;  // generous travel
export const MAX_ROUTE_LEN_PX     = 900;  // don't span the whole canvas
export const RESAMPLE_STEP_PX     = 18;   // output spacing in pixels
export const RESAMPLE_MIN_POINTS  = 64;   // guarantee enough samples
