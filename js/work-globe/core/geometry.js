/**
 * 3D geometry generation utilities
 * Functions for creating sphere, pin, and mycelium geometries
 */

export function createSphereGeometry(radius, segments, rings) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let ring = 0; ring <= rings; ring++) {
    const theta = ring * Math.PI / rings;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let seg = 0; seg <= segments; seg++) {
      const phi = seg * 2 * Math.PI / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = radius * cosPhi * sinTheta;
      const y = radius * cosTheta;
      const z = radius * sinPhi * sinTheta;

      positions.push(x, y, z);
      normals.push(x / radius, y / radius, z / radius);
      
      // UV mapping: flip U horizontally (1 - seg/segments) to correct mirroring
      uvs.push(1.0 - (seg / segments), ring / rings);
    }
  }

  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = ring * (segments + 1) + seg;
      const b = a + segments + 1;

      // Reverse winding order for outward-facing triangles (CW when viewed from outside)
      indices.push(a, a + 1, b);
      indices.push(b, a + 1, b + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
}

export function createPinGeometry(baseRadius = 0.02, height = 1.0, sides = 6) {
  const positions = [];
  const normals = [];
  const indices = [];
  
  // Create hexagonal crystal pin pointing outward
  // Base at y=0, tip at y=height
  
  // Bottom cap (at globe surface)
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * baseRadius;
    const z = Math.sin(angle) * baseRadius;
    positions.push(x, 0, z);
    normals.push(0, -1, 0);
  }
  
  // Top cap (tapered to point)
  const tipRadius = baseRadius * 0.2; // Sharp tip
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * tipRadius;
    const z = Math.sin(angle) * tipRadius;
    positions.push(x, height, z);
    normals.push(0, 1, 0);
  }
  
  // Tip point
  const tipIdx = positions.length / 3;
  positions.push(0, height * 1.2, 0);
  normals.push(0, 1, 0);
  
  // Build faces
  for (let i = 0; i < sides; i++) {
    const curr = i;
    const next = (i + 1) % sides;
    const currTop = sides + i;
    const nextTop = sides + ((i + 1) % sides);
    
    // Side face (quad)
    indices.push(curr, next, nextTop);
    indices.push(curr, nextTop, currTop);
    
    // Calculate side normal
    const idx = curr * 3;
    const x = positions[idx];
    const z = positions[idx + 2];
    const nx = x / baseRadius;
    const nz = z / baseRadius;
    normals[idx] = nx;
    normals[idx + 1] = 0.3; // Slight upward angle
    normals[idx + 2] = nz;
    
    // Tip triangle
    indices.push(currTop, nextTop, tipIdx);
  }
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: indices.length
  };
}

// ━━━ MYCELIUM HYPHAE GENERATOR ━━━
// Noise-advected surface paths with branching, merging, and tapering

// Simple 2D Perlin-like noise for direction field
function noise2D(x, y) {
  // Simple pseudo-random noise (deterministic)
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function fbmNoise(lon, lat, octaves = 3) {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (noise2D(lon * frequency, lat * frequency) * 2 - 1);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

export function createMyceliumHyphae(radius, seeds, options = {}) {
  const {
    landBias = 0.15,          // Bias toward land (not implemented yet - optional)
    stepSize = 0.008,          // Radians per step (~0.5 degrees)
    minLength = 120,
    maxLength = 220,
    branchProb = 0.08,         // 8% chance per segment
    killRadius = 0.025,        // Stop when near existing path
    mergeRadius = 0.015,       // Merge when very close
    widthBase = 0.010,         // Base strand width
    widthNode = 0.016,         // Width at branch nodes
    tubeSegments = 6           // Cross-section resolution
  } = options;
  
  const paths = [];           // All generated paths
  const occupancyGrid = [];   // Spatial hash for kill/merge detection
  
  // Helper: Convert lat/lon to grid cell
  function toGridKey(lat, lon) {
    const gridSize = 20; // 20x20 degree cells
    const latCell = Math.floor((lat + Math.PI/2) / (Math.PI / gridSize));
    const lonCell = Math.floor((lon + Math.PI) / (Math.PI * 2 / (gridSize * 2)));
    return `${latCell},${lonCell}`;
  }
  
  // Helper: Check if position is near existing path
  function isNearPath(lat, lon, checkRadius) {
    const key = toGridKey(lat, lon);
    const nearby = occupancyGrid[key] || [];
    
    for (const point of nearby) {
      const dlat = lat - point.lat;
      const dlon = lon - point.lon;
      const dist = Math.sqrt(dlat * dlat + dlon * dlon);
      if (dist < checkRadius) {
        return point;
      }
    }
    return null;
  }
  
  // Helper: Add point to occupancy grid
  function addToGrid(lat, lon, pathId, segmentId) {
    const key = toGridKey(lat, lon);
    if (!occupancyGrid[key]) occupancyGrid[key] = [];
    occupancyGrid[key].push({ lat, lon, pathId, segmentId });
  }
  
  // Generate a single path with noise-advected growth
  function growPath(startLat, startLon, initialDir, pathId, depth = 0, maxDepth = 2) {
    // Prevent infinite recursion
    if (depth > maxDepth) return { segments: [], killed: false, pathId };
    
    const segments = [];
    let lat = startLat;
    let lon = startLon;
    let direction = initialDir;
    let age = 0;
    let width = widthBase;
    let killed = false;
    
    const length = minLength + Math.floor(Math.random() * (maxLength - minLength));
    
    for (let step = 0; step < length && !killed; step++) {
      // Sample noise field for direction advection
      const noiseVal = fbmNoise(lon * 3, lat * 3, 3);
      const noiseAngle = noiseVal * Math.PI * 0.3; // ±54 degrees influence
      
      // Advect direction
      direction += noiseAngle * 0.15 + (Math.random() - 0.5) * 0.1;
      
      // Move along direction
      const dlat = Math.sin(direction) * stepSize;
      const dlon = Math.cos(direction) * stepSize / Math.max(Math.cos(lat), 0.3); // Adjust for latitude compression
      
      lat += dlat;
      lon += dlon;
      
      // Wrap longitude
      if (lon > Math.PI) lon -= Math.PI * 2;
      if (lon < -Math.PI) lon += Math.PI * 2;
      
      // Clamp latitude (avoid poles)
      lat = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, lat));
      
      // Check for kill condition
      const nearPoint = isNearPath(lat, lon, killRadius);
      if (nearPoint && nearPoint.pathId !== pathId) {
        killed = true;
        // Mark as merge point if very close
        if (isNearPath(lat, lon, mergeRadius)) {
          width = widthNode; // Swell at merge
        }
        break;
      }
      
      // Taper width toward tip
      const tipTaper = 1.0 - (step / length) * 0.7; // 70% thinner at tip
      const currentWidth = width * tipTaper;
      
      // Convert to 3D position - match sphere geometry coordinate system
      // Lat: -π/2 (south) to +π/2 (north), Lon: -π to +π (wraps at date line)
      const r = radius * 1.008; // Very close to surface (0.8% above)
      const x = r * Math.cos(lat) * Math.cos(lon);
      const y = r * Math.sin(lat);
      const z = r * Math.cos(lat) * Math.sin(lon);
      
      segments.push({ x, y, z, lat, lon, width: currentWidth, age: age++ });
      addToGrid(lat, lon, pathId, segments.length - 1);
      
      // Branching (only if not at max depth)
      if (depth < maxDepth && step > 10 && step < length - 10 && Math.random() < branchProb) {
        // Spawn sub-branch with wide angle
        const branchAngle = direction + (Math.random() - 0.5) * Math.PI * 0.6; // ±108 degrees
        const branchLength = Math.floor(length * (0.4 + Math.random() * 0.3));
        const subPath = growPath(lat, lon, branchAngle, paths.length, depth + 1, maxDepth);
        if (subPath.segments.length > 5) {
          paths.push(subPath);
        }
        // Mark branch node with wider width
        segments[segments.length - 1].width = widthNode;
      }
    }
    
    return { segments, killed, pathId };
  }
  
  // Grow from all seed points
  seeds.forEach((seed, i) => {
    const { lat, lon } = seed;
    // Spawn 3-5 main branches from each seed
    const numBranches = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < numBranches; b++) {
      const direction = (b / numBranches) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const path = growPath(lat, lon, direction, paths.length, 0, 2); // Start at depth 0, max depth 2
      if (path.segments.length > 5) {
        paths.push(path);
      }
    }
  });
  
  // Build tube geometry from all paths
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const ages = []; // Per-vertex age for animation
  
  paths.forEach(path => {
    if (path.segments.length < 2) return;
    
    const vertexOffset = positions.length / 3;
    
    path.segments.forEach((seg, i) => {
      const t = i / (path.segments.length - 1);
      
      // Calculate tangent
      let tangent = { x: 0, y: 0, z: 1 };
      if (i < path.segments.length - 1) {
        const next = path.segments[i + 1];
        tangent.x = next.x - seg.x;
        tangent.y = next.y - seg.y;
        tangent.z = next.z - seg.z;
        const tLen = Math.sqrt(tangent.x**2 + tangent.y**2 + tangent.z**2);
        if (tLen > 0.001) {
          tangent.x /= tLen;
          tangent.y /= tLen;
          tangent.z /= tLen;
        }
      }
      
      // Create cross-section ring
      for (let s = 0; s < tubeSegments; s++) {
        const angle = (s / tubeSegments) * Math.PI * 2;
        
        // Perpendicular vectors
        const perpX = -tangent.z;
        const perpZ = tangent.x;
        const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ) || 1;
        
        const upX = perpX / perpLen;
        const upY = 0;
        const upZ = perpZ / perpLen;
        
        const rightX = tangent.y * upZ - tangent.z * upY;
        const rightY = tangent.z * upX - tangent.x * upZ;
        const rightZ = tangent.x * upY - tangent.y * upX;
        
        const r = seg.width;
        const offsetX = (Math.cos(angle) * upX + Math.sin(angle) * rightX) * r;
        const offsetY = (Math.cos(angle) * upY + Math.sin(angle) * rightY) * r;
        const offsetZ = (Math.cos(angle) * upZ + Math.sin(angle) * rightZ) * r;
        
        positions.push(seg.x + offsetX, seg.y + offsetY, seg.z + offsetZ);
        
        const nLen = Math.sqrt(offsetX**2 + offsetY**2 + offsetZ**2) || 1;
        normals.push(offsetX / nLen, offsetY / nLen, offsetZ / nLen);
        
        uvs.push(s / tubeSegments, t);
        ages.push(seg.age); // Store age for growth animation
      }
      
      // Create triangles
      if (i > 0) {
        for (let s = 0; s < tubeSegments; s++) {
          const current = vertexOffset + i * tubeSegments + s;
          const next = vertexOffset + i * tubeSegments + ((s + 1) % tubeSegments);
          const prevCurrent = current - tubeSegments;
          const prevNext = next - tubeSegments;
          
          indices.push(prevCurrent, current, prevNext);
          indices.push(current, next, prevNext);
        }
      }
    });
  });
  
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    ages: new Float32Array(ages),
    stats: {
      seeds: seeds.length,
      paths: paths.length,
      segments: positions.length / 3 / tubeSegments
    }
  };
}
