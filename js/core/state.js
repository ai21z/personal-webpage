/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * GLOBAL STATE MANAGEMENT
 * Single source of truth for application state
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Background Cover Transform
 * SINGLE source of truth for cover transform calculations
 */
export const COVER = { 
  s: 1,        // scale
  dx: 0,       // x offset
  dy: 0,       // y offset
  baseW: 0,    // image natural width
  baseH: 0,    // image natural height
  ready: false // initialization flag
};

/**
 * Mycelium Network Data
 * Loaded from artifacts/network.json
 */
export let MYC_MAP = null; // {seed, width, height, paths, junctions, strategic}

/**
 * Graph Data Structure
 * Built from mycelium paths for pathfinding
 */
export let GRAPH = null; // { nodes: Array<{x,y}>, neighbors(id)->id[], nearestId(x,y) }

/**
 * Path Cache
 * Memoized A* pathfinding results
 */
export const PATH_CACHE = new Map(); // "fromId->toId" => [{x,y}, …]

/**
 * Navigation State
 */
export const NODE_IDS = {};      // id -> graph node index
export const NAV_OFFSETS = {};   // id -> {nx, ny} in image space
export let LOCKED_ROUTES = {};   // id -> {imgPts, projPts, cum, len, s, dir, speed}

/**
 * Ritual State
 */
export let ritualActive = false;
export let followerSparks = [];  // [{ id, alpha }]

/**
 * User Preferences
 */
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Debug/HUD State
 */
export let hudEnabled = new URLSearchParams(window.location.search).has('hud');
export let hudCanvas = null;
export let hudCtx = null;

/**
 * Setters for state that needs to be modified from other modules
 */
export function setMycMap(data) {
  MYC_MAP = data;
}

export function setGraph(graphData) {
  GRAPH = graphData;
}

export function setRitualActive(active) {
  ritualActive = active;
}

export function setFollowerSparks(sparks) {
  followerSparks = sparks;
}

export function setHudCanvas(canvas) {
  hudCanvas = canvas;
  hudCtx = canvas ? canvas.getContext('2d') : null;
}

export function setLockedRoutes(routes) {
  LOCKED_ROUTES = routes;
}
