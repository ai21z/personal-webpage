/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * GRAPH & PATHFINDING
 * Image-space graph building and A* pathfinding for mycelium navigation
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { GRAPH_QUANT, NEAREST_NODE_RADIUS, NEAREST_NODE_STEP } from '../core/config.js';
import { GRAPH, PATH_CACHE, setGraph } from '../core/state.js';

/**
 * Build graph from mycelium paths for pathfinding
 * Creates a spatial graph with nodes and edges from polyline paths
 * @param {Array<Array<Array<number>>>} paths - Array of polylines [[x,y], ...]
 * @returns {{nodes: Array, neighbors: Function, nearestId: Function}}
 */
export function buildGraphFromPaths(paths) {
  const QUANT = GRAPH_QUANT;
  const key = (x, y) => `${Math.round(x / QUANT)},${Math.round(y / QUANT)}`;

  const nodes = [];
  const keyToId = new Map();
  const adj = [];

  const addNode = (x, y) => {
    const k = key(x, y);
    if (!keyToId.has(k)) {
      keyToId.set(k, nodes.length);
      nodes.push({ x, y });
    }
    return keyToId.get(k);
  };

  const link = (a, b) => {
    if (a === b) return;
    (adj[a] ??= new Set()).add(b);
    (adj[b] ??= new Set()).add(a);
  };

  for (const poly of paths) {
    if (!poly || poly.length === 0) continue;
    let prev = addNode(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      const cur = addNode(poly[i][0], poly[i][1]);
      link(prev, cur);
      prev = cur;
    }
  }

  const neighborCache = new Map();
  const neighbors = (id) => {
    if (!neighborCache.has(id)) neighborCache.set(id, Array.from(adj[id] ?? []));
    return neighborCache.get(id);
  };

  const nearestId = (x, y, radius = NEAREST_NODE_RADIUS, step = NEAREST_NODE_STEP) => {
    let best = -1;
    let bestD2 = Infinity;

    const tryPoint = (px, py) => {
      const id = keyToId.get(key(px, py));
      if (id != null) {
        const dx = nodes[id].x - x;
        const dy = nodes[id].y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          best = id;
          bestD2 = d2;
        }
      }
    };

    for (let r = 0; r <= radius; r += step) {
      for (let dx = -r; dx <= r; dx += step) {
        tryPoint(x + dx, y - r);
        tryPoint(x + dx, y + r);
      }
      for (let dy = -r + step; dy <= r - step; dy += step) {
        tryPoint(x - r, y + dy);
        tryPoint(x + r, y + dy);
      }
    }
    return best;
  };

  const graph = { nodes, neighbors, nearestId };
  setGraph(graph); // Update global state
  return graph;
}

/**
 * A* pathfinding between two node IDs
 * @param {number} idA - Start node ID
 * @param {number} idB - End node ID
 * @returns {Array<{x: number, y: number}>|null} - Path or null if not found
 */
export function aStarPath(idA, idB) {
  if (!GRAPH || idA < 0 || idB < 0) return null;
  
  const cacheKey = `${idA}->${idB}`;
  if (PATH_CACHE.has(cacheKey)) return PATH_CACHE.get(cacheKey);

  const nodes = GRAPH.nodes;
  const neighbors = GRAPH.neighbors;

  const open = new Set([idA]);
  const came = new Map();
  const g = new Map([[idA, 0]]);
  const f = new Map([[idA, 0]]);

  const h = (id) => {
    const A = nodes[id];
    const B = nodes[idB];
    const dx = A.x - B.x;
    const dy = A.y - B.y;
    return dx * dx + dy * dy;
  };

  while (open.size) {
    let current = null;
    let best = Infinity;
    for (const id of open) {
      const fi = f.get(id) ?? Infinity;
      if (fi < best) {
        best = fi;
        current = id;
      }
    }

    if (current === idB) {
      const out = [];
      for (let c = current; c != null; c = came.get(c)) out.push(nodes[c]);
      out.reverse();
      PATH_CACHE.set(cacheKey, out);
      return out;
    }

    open.delete(current);

    for (const nb of neighbors(current)) {
      const tentative = (g.get(current) ?? Infinity) + 1;
      if (tentative < (g.get(nb) ?? Infinity)) {
        came.set(nb, current);
        g.set(nb, tentative);
        f.set(nb, tentative + h(nb));
        open.add(nb);
      }
    }
  }

  return null;
}

/**
 * Get nearest node ID to a point
 * Convenience wrapper around graph's nearestId
 * @param {{x: number, y: number}} pt - Point to search from
 * @returns {number} - Nearest node ID or -1 if not found
 */
export function nearestNodeId(pt) {
  if (!GRAPH || !GRAPH.nearestId) return -1;
  return GRAPH.nearestId(pt.x, pt.y);
}
