/**
 * ━━━ MYCELIAL GLOBE - RAW WEBGL2 IMPLEMENTATION ━━━
 * No libraries - pure WebGL2 for maximum control and performance
 * 
 * Architecture:
 * - UV sphere geometry (procedural)
 * - Custom matrix math (mat4 utilities)
 * - Shader-based necrographic aesthetic
 * - Trackball rotation with inertia
 * - Ray-picking for pins
 * - Instanced rendering for spores
 */

// Work location data
const WORK_LOCATIONS = {
  larissa: {
    name: 'Larissa, Greece',
    coords: { lat: 39.6390, lng: 22.4181 },
    color: [0.48, 0.68, 0.54], // decay-green RGB
    entries: [
      {
        company: 'MSc Environmental Engineering',
        position: 'Research & Thesis',
        period: '2015 — 2017',
        responsibilities: [
          'Water & soil quality analysis',
          'Laboratory methods & calibration',
          'Environmental compliance research'
        ]
      },
      {
        company: 'Freelance & Early Career',
        position: 'Multiple Roles',
        period: '2015 — 2020',
        responsibilities: [
          'Environmental data analysis',
          'Greek ↔ English translation',
          'Early software development'
        ]
      }
    ]
  },
  barcelona: {
    name: 'Barcelona, Spain',
    coords: { lat: 41.3874, lng: 2.1686 },
    color: [1.0, 0.48, 0.2], // orange RGB
    entries: [
      {
        company: 'ADP',
        position: 'Senior Software Engineer',
        period: '2023 — Present',
        responsibilities: [
          'Backend architecture & system design',
          'API development & integration',
          'Technical leadership & mentoring'
        ]
      },
      {
        company: 'Netcompany-Intrasoft',
        position: 'Software Engineer',
        period: '2021 — 2023',
        responsibilities: [
          'Full-stack development (Java, React)',
          'RESTful web services',
          'Test-driven development'
        ]
      },
      {
        company: 'Freelance Work',
        position: 'Developer & Translator',
        period: '2020 — Present',
        responsibilities: [
          'Data annotation for AI training',
          'i18n/l10n services',
          'Custom web development'
        ]
      }
    ]
  }
};

// ━━━ MATRIX UTILITIES ━━━
const mat4 = {
  create() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  },

  perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  },

  lookAt(eye, center, up) {
    let z0 = eye[0] - center[0];
    let z1 = eye[1] - center[1];
    let z2 = eye[2] - center[2];
    let len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    if (len > 0) {
      len = 1 / len;
      z0 *= len; z1 *= len; z2 *= len;
    }

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (len > 0) {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;

    return new Float32Array([
      x0, y0, z0, 0,
      x1, y1, z1, 0,
      x2, y2, z2, 0,
      -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]),
      -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
      -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
      1
    ]);
  },

  multiply(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return out;
  },

  rotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  },

  rotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }
};

// ━━━ GLOBE STATE ━━━
let gl, canvas;
let globeProgram, atmosphereProgram, fogProgram, lightningProgram, myceliumProgram, myceliumCoreProgram, sporeProgram;
let globeVAO, sphereVertexCount;
let myceliumVAO, myceliumVertexCount, myceliumGrowthTime = 0;
let sporeSystem = null;
let projectionMatrix, viewMatrix, modelMatrix;
let rotation = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };
let isDragging = false;
let lastPointerPos = { x: 0, y: 0 };
let animationFrameId = null;
let autoRotate = true;
let time = 0;

// Textures
let earthTexture = null;
let fogTexture = null;
let lightningTexture = null;
let texturesReady = false;

// ━━━ DEBUG TOGGLES (change these to isolate issues) ━━━
const DEBUG_DISABLE_FOG_LIGHTNING = false; // ✅ Enabled - state management is fixed!
const DEBUG_DISABLE_CULLING = false;       // Set to true to test if culling is the issue
const DEBUG_FORCE_SOLID_COLOR = false;     // Set to true to test without textures

// ━━━ SHADER SOURCES ━━━
const globeVertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 vNormal;
out vec3 vPosition;
out vec2 vUv;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

void main() {
  vNormal = mat3(uModel) * normal;
  vPosition = (uModel * vec4(position, 1.0)).xyz;
  vUv = uv;
  gl_Position = uProjection * uView * uModel * vec4(position, 1.0);
}
`;

const globeFragmentShader = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;

out vec4 fragColor;

uniform float uTime;
uniform sampler2D uDaymap;
uniform bool uUseDaymap;

void main() {
  vec3 baseColor;
  
  if (uUseDaymap) {
    // Sample Earth albedo texture
    vec3 sampledColor = texture(uDaymap, vUv).rgb;
    
    // SIMPLIFIED: No linearization - texture is already sRGB, work directly
    // Most Earth textures are pre-processed for display
    
    // Subtle palette shift (much lighter touch - 10% instead of 25%)
    float luminance = dot(sampledColor, vec3(0.299, 0.587, 0.114));
    float landness = smoothstep(0.15, 0.40, luminance);
    
    // Target palette: slightly darker oceans, preserve land colors
    vec3 oceanTarget = vec3(0.08, 0.12, 0.13);   // Subtle dark teal
    vec3 landTarget = vec3(0.55, 0.75, 0.60);    // Keep land brighter
    
    // Very subtle remap (10% strength - mostly shows original texture)
    vec3 targetColor = mix(oceanTarget, landTarget, landness);
    baseColor = mix(sampledColor, targetColor, 0.10);
    
  } else {
    // Fallback: procedural land/ocean
    float v = sin(vUv.x * 12.0 + sin(vUv.y * 8.0)) * 
              sin(vUv.y * 10.0 + sin(vUv.x * 6.0));
    float land = step(0.2, v);
    vec3 oceanColor = vec3(0.08, 0.12, 0.13);
    vec3 landColor = vec3(0.55, 0.75, 0.60);
    baseColor = mix(oceanColor, landColor, land);
  }
  
  // Lambert lighting: balanced ambient + diffuse
  vec3 lightDir = normalize(vec3(0.5, 0.3, 0.5));
  float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
  float ambient = 0.15;  // Increased from 0.08 - brighter overall
  float lighting = ambient + diffuse * 0.65;
  
  // Apply lighting
  vec3 color = baseColor * lighting;
  
  // Micro-grain: very subtle (2% instead of 3%)
  float grain = sin(vUv.x * 20.0 + uTime * 0.5) * 
                sin(vUv.y * 15.0 + uTime * 0.3);
  color += vec3(grain) * 0.02;
  
  // Slight emissive glow
  color += vec3(0.05, 0.08, 0.06) * 0.10;
  
  // NO gamma correction - texture is already in correct space
  // If it looks too dark/bright, adjust lighting instead
  
  fragColor = vec4(color, 1.0);
}
`;

const atmosphereVertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;

out vec3 vNormal;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

void main() {
  vNormal = normalize(mat3(uModel) * normal);
  gl_Position = uProjection * uView * uModel * vec4(position * 1.04, 1.0);
}
`;

const atmosphereFragmentShader = `#version 300 es
precision highp float;

in vec3 vNormal;
out vec4 fragColor;

void main() {
  // Rim lighting effect
  float intensity = pow(0.5 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.5);
  vec3 glowColor = vec3(0.29, 0.60, 0.54); // Soft teal
  fragColor = vec4(glowColor, intensity * 0.4);
}
`;

// ━━━ FOG SHADER (alpha-blended layer) ━━━
const fogVertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec2 vUv;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

void main() {
  vUv = uv;
  gl_Position = uProjection * uView * uModel * vec4(position, 1.0);
}
`;

const fogFragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uFogTex;
uniform vec3 uFogTint;
uniform float uFogStrength;
uniform vec2 uFogScroll;
uniform float uTime;

void main() {
  // Sample fog with slow scroll + seam guard
  vec2 scrollUv = fract(vUv + uFogScroll * uTime); // fract() prevents seam artifacts
  float fogAlpha = texture(uFogTex, scrollUv).a;
  
  // Clamp to prevent hiding continents (max 60% coverage)
  fogAlpha = min(fogAlpha * uFogStrength, 0.6);
  
  // Output tinted fog
  vec3 fogColor = uFogTint * fogAlpha;
  fragColor = vec4(fogColor, fogAlpha);
}
`;

// ━━━ LIGHTNING SHADER (additive emissive) ━━━
const lightningVertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec2 vUv;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

void main() {
  vUv = uv;
  gl_Position = uProjection * uView * uModel * vec4(position, 1.0);
}
`;

const lightningFragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uLightningTex;
uniform vec3 uLightningColor;
uniform float uLightningGain;
uniform vec2 uLightningScroll;
uniform float uTime;
uniform float uFlickerFreq;
uniform float uFlickerDuty;

// Simple hash for pseudo-random flicker
float hash(float t) {
  return fract(sin(t * 127.1) * 43758.5453);
}

void main() {
  // Sample lightning mask with scroll + seam guard
  vec2 scrollUv = fract(vUv + uLightningScroll * uTime); // fract() prevents seam
  float mask = texture(uLightningTex, scrollUv).r;
  
  // Create flicker: base slow pulse + sharp strobe
  float slowPulse = hash(floor(uTime * uFlickerFreq * 0.3)) * 0.5 + 0.5;
  float strobePhase = fract(uTime * uFlickerFreq);
  float strobe = step(strobePhase, uFlickerDuty) * 2.0;
  
  // Combine with jitter
  float jitter = hash(uTime * 10.0) * 0.3 + 0.7;
  float pulse = slowPulse * (0.3 + strobe * 0.7) * jitter;
  
  // Emissive output (additive)
  vec3 emissive = uLightningColor * mask * pulse * uLightningGain;
  fragColor = vec4(emissive, 1.0);
}
`;

// ━━━ MYCELIUM HYPHAE SHADERS (Body + Core Split) ━━━
const myceliumVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 uv;
layout(location = 3) in float age;

out vec3 vNormal;
out vec3 vPosition;
out vec2 vUv;
out float vAge;
out float vDepth;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;
uniform float uGrowthTime; // Animated reveal

void main() {
  vNormal = normalize(mat3(uModel) * normal);
  vPosition = (uModel * vec4(position, 1.0)).xyz;
  vUv = uv;
  vAge = age;
  
  vec4 viewPos = uView * uModel * vec4(position, 1.0);
  vDepth = -viewPos.z;
  
  gl_Position = uProjection * viewPos;
}
`;

const myceliumFragmentShader = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in float vAge;
in float vDepth;

out vec4 fragColor;

uniform float uTime;
uniform vec3 uBodyColor;      // Dark fibrous base
uniform vec3 uCoreColor;      // Subtle core glint
uniform float uCoreGain;      // Core intensity (≤0.18)
uniform float uGrowthTime;    // Growth reveal
uniform float uOpacityNoise;  // Micro-noise modulation

// Simple noise for opacity variation
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Growth reveal: fade in based on age
  float reveal = smoothstep(0.0, 50.0, uGrowthTime - vAge);
  if (reveal < 0.01) discard;
  
  // Directional lighting (from upper-right)
  vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  
  // Ambient occlusion from radial UV
  float ao = 0.6 + 0.4 * (1.0 - abs(vUv.x * 2.0 - 1.0));
  
  // Body color: dark fibrous mass
  vec3 bodyLit = uBodyColor * (0.3 + diffuse * 0.5) * ao;
  
  // Core glint: only at centerline (vUv.x near 0.5 or 0.0/1.0 for wrapped)
  float coreStrength = 1.0 - abs(vUv.x * 2.0 - 1.0); // Peaks at center
  coreStrength = pow(coreStrength, 4.0); // Narrow core
  vec3 coreGlint = uCoreColor * coreStrength * uCoreGain;
  
  // Micro-noise opacity modulation (2-3%)
  float opacityNoise = hash(vPosition.xy * 100.0) * uOpacityNoise;
  float baseAlpha = 0.70 + opacityNoise;
  
  // Depth fade
  float depthFade = smoothstep(800.0, 300.0, vDepth);
  
  // Final: body (alpha) + core (will be additive in separate pass)
  vec3 finalColor = bodyLit;
  float alpha = baseAlpha * depthFade * reveal;
  
  fragColor = vec4(finalColor, alpha);
}
`;

// Core glint shader (additive pass for centerline)
const myceliumCoreFragmentShader = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in float vAge;
in float vDepth;

out vec4 fragColor;

uniform float uTime;
uniform vec3 uCoreColor;
uniform float uCoreGain;
uniform float uGrowthTime;

void main() {
  // Growth reveal
  float reveal = smoothstep(0.0, 50.0, uGrowthTime - vAge);
  if (reveal < 0.01) discard;
  
  // Core only at centerline
  float coreStrength = 1.0 - abs(vUv.x * 2.0 - 1.0);
  coreStrength = pow(coreStrength, 6.0); // Very narrow line
  
  // Pulse at tips (high age)
  float tipPulse = smoothstep(100.0, 150.0, vAge) * (sin(uTime * 2.0) * 0.3 + 0.7);
  
  vec3 emissive = uCoreColor * coreStrength * uCoreGain * (0.5 + tipPulse * 0.5);
  
  fragColor = vec4(emissive, 1.0);
}
`;

// ━━━ SPORE PARTICLE SHADERS ━━━
const sporeVertexShader = `#version 300 es
precision highp float;

// Per-vertex attributes
layout(location = 0) in vec3 position;  // Particle position
layout(location = 1) in vec3 velocity;  // Particle velocity
layout(location = 2) in float life;     // Particle life (0-1)
layout(location = 3) in float size;     // Particle size
layout(location = 4) in float phase;    // Random phase for variation

out float vLife;
out float vPhase;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;

void main() {
  vLife = life;
  vPhase = phase;
  
  // Apply physics (gravity, drag)
  vec3 pos = position;
  pos.y -= 0.5 * (1.0 - life) * (1.0 - life); // Gravity falloff
  
  vec4 viewPos = uView * uModel * vec4(pos, 1.0);
  
  // Pulsing size based on life and phase
  float pulse = sin(uTime * 3.0 + phase * 6.28) * 0.3 + 0.7;
  gl_PointSize = size * (8.0 + 4.0 * pulse) * life * life; // Fade as they die
  
  gl_Position = uProjection * viewPos;
}
`;

const sporeFragmentShader = `#version 300 es
precision highp float;

in float vLife;
in float vPhase;

out vec4 fragColor;

uniform float uTime;
uniform vec3 uSporeColor;    // Decay-green color
uniform vec3 uEmberColor;    // Bright ember color for core

void main() {
  // Distance from center of point sprite
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  // Soft circular falloff
  if (dist > 0.5) discard;
  
  float alpha = smoothstep(0.5, 0.0, dist) * vLife;
  
  // Pulsing glow
  float pulse = sin(uTime * 4.0 + vPhase * 6.28) * 0.3 + 0.7;
  
  // Two-tone: dark edge, bright core (like your spore rendering)
  vec3 edgeColor = uSporeColor * 0.6;
  vec3 coreColor = mix(uSporeColor, uEmberColor, 0.3);
  vec3 color = mix(edgeColor, coreColor, 1.0 - dist * 2.0);
  
  // Additive blending will be enabled
  fragColor = vec4(color * pulse, alpha);
}
`;

// ━━━ GEOMETRY GENERATION ━━━
function createSphereGeometry(radius, segments, rings) {
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

function createMyceliumHyphae(radius, seeds, options = {}) {
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
  
  console.log(`[Mycelium Generator] seeds=${seeds.length}, paths=${paths.length}, segments=${positions.length/3}, merges=${paths.filter(p => p.killed).length}`);
  
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

// ━━━ SPORE PARTICLE SYSTEM ━━━
class SporeSystem {
  constructor(gl, maxParticles = 2000) {
    this.gl = gl;
    this.maxParticles = maxParticles;
    this.activeParticles = 0;
    this.particles = [];
    this.lastLightningIntensity = 0;
    this.emissionCooldown = 0;
    
    // Initialize particle pool
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        life: 0,
        size: 1,
        phase: Math.random() * Math.PI * 2,
        active: false
      });
    }
    
    // Create buffers
    this.positionBuffer = gl.createBuffer();
    this.velocityBuffer = gl.createBuffer();
    this.lifeBuffer = gl.createBuffer();
    this.sizeBuffer = gl.createBuffer();
    this.phaseBuffer = gl.createBuffer();
    
    // Pre-allocate typed arrays
    this.positionData = new Float32Array(maxParticles * 3);
    this.velocityData = new Float32Array(maxParticles * 3);
    this.lifeData = new Float32Array(maxParticles);
    this.sizeData = new Float32Array(maxParticles);
    this.phaseData = new Float32Array(maxParticles);
    
    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    // Setup attributes
    this.setupAttribute(this.positionBuffer, 0, 3, this.positionData);
    this.setupAttribute(this.velocityBuffer, 1, 3, this.velocityData);
    this.setupAttribute(this.lifeBuffer, 2, 1, this.lifeData);
    this.setupAttribute(this.sizeBuffer, 3, 1, this.sizeData);
    this.setupAttribute(this.phaseBuffer, 4, 1, this.phaseData);
    
    gl.bindVertexArray(null);
  }
  
  setupAttribute(buffer, location, size, data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }
  
  emitBurst(originPositions, intensity = 1.0) {
    if (this.emissionCooldown > 0) return; // Prevent spam
    
    const particlesPerOrigin = Math.floor(15 + intensity * 25); // 15-40 per burst
    const emitted = [];
    
    for (const origin of originPositions) {
      for (let i = 0; i < particlesPerOrigin; i++) {
        const particle = this.getInactiveParticle();
        if (!particle) break;
        
        // Spherical explosion pattern
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 0.5 + Math.random() * 1.5; // Explosive velocity
        
        particle.position = [...origin];
        particle.velocity = [
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed + 0.3, // Slight upward bias
          Math.cos(phi) * speed
        ];
        particle.life = 1.0;
        particle.size = 0.8 + Math.random() * 0.4;
        particle.active = true;
        
        emitted.push(particle);
      }
    }
    
    this.emissionCooldown = 0.3; // 300ms cooldown between bursts
    return emitted.length;
  }
  
  getInactiveParticle() {
    return this.particles.find(p => !p.active);
  }
  
  update(dt, lightningIntensity = 0) {
    // Detect lightning strikes (rising edge)
    if (lightningIntensity > 0.7 && this.lastLightningIntensity < 0.3) {
      // Get mycelium branch tip positions (sample from actual geometry)
      const tipPositions = this.getMyceliumTips();
      if (tipPositions.length > 0) {
        const numEmitted = this.emitBurst(tipPositions, lightningIntensity);
        if (numEmitted > 0) {
          console.log(`⚡ [Spores] Lightning strike! Emitted ${numEmitted} spores`);
        }
      }
    }
    this.lastLightningIntensity = lightningIntensity;
    
    // Update cooldown
    if (this.emissionCooldown > 0) {
      this.emissionCooldown -= dt;
    }
    
    // Update physics for all particles
    this.activeParticles = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      
      // Update life
      p.life -= dt * 0.4; // 2.5 second lifetime
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      
      // Apply physics
      p.velocity[1] -= dt * 0.8; // Gravity
      p.velocity[0] *= 0.98; // Drag
      p.velocity[1] *= 0.98;
      p.velocity[2] *= 0.98;
      
      // Update position
      p.position[0] += p.velocity[0] * dt;
      p.position[1] += p.velocity[1] * dt;
      p.position[2] += p.velocity[2] * dt;
      
      // Copy to typed arrays
      const idx = this.activeParticles * 3;
      this.positionData[idx] = p.position[0];
      this.positionData[idx + 1] = p.position[1];
      this.positionData[idx + 2] = p.position[2];
      
      this.velocityData[idx] = p.velocity[0];
      this.velocityData[idx + 1] = p.velocity[1];
      this.velocityData[idx + 2] = p.velocity[2];
      
      this.lifeData[this.activeParticles] = p.life;
      this.sizeData[this.activeParticles] = p.size;
      this.phaseData[this.activeParticles] = p.phase;
      
      this.activeParticles++;
    }
    
    // Update GPU buffers
    if (this.activeParticles > 0) {
      this.updateBuffers();
    }
  }
  
  updateBuffers() {
    const gl = this.gl;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positionData.subarray(0, this.activeParticles * 3));
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.velocityBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.velocityData.subarray(0, this.activeParticles * 3));
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lifeData.subarray(0, this.activeParticles));
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sizeData.subarray(0, this.activeParticles));
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.phaseData.subarray(0, this.activeParticles));
  }
  
  getMyceliumTips() {
    // Sample random positions from mycelium branches
    // In real implementation, we'd track actual branch endpoints
    const tips = [];
    const numTips = 3 + Math.floor(Math.random() * 5); // 3-7 emission points
    
    for (let i = 0; i < numTips; i++) {
      // Random positions on sphere surface (will be replaced with actual branch tips)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 1.02; // Slightly above globe surface
      
      tips.push([
        r * Math.cos(phi) * Math.cos(theta),
        r * Math.sin(phi),
        r * Math.cos(phi) * Math.sin(theta)
      ]);
    }
    
    return tips;
  }
  
  render(program) {
    if (this.activeParticles === 0) return;
    
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.activeParticles);
    gl.bindVertexArray(null);
  }
}

// ━━━ SHADER UTILITIES ━━━
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource, attribLocations = {}) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  
  // Bind attribute locations before linking
  if (attribLocations.position !== undefined) {
    gl.bindAttribLocation(program, attribLocations.position, 'position');
  }
  if (attribLocations.normal !== undefined) {
    gl.bindAttribLocation(program, attribLocations.normal, 'normal');
  }
  if (attribLocations.uv !== undefined) {
    gl.bindAttribLocation(program, attribLocations.uv, 'uv');
  }
  
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}

// ━━━ TEXTURE UTILITIES ━━━
function loadTexture(gl, url, options = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // Placeholder pixel while loading
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]));
  
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Don't flip Y - we handle orientation in UV generation
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // Set filters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, 
      options.mipmap !== false ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    // Set wrapping - REPEAT for longitude (S), CLAMP for latitude (T) to avoid pole artifacts
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // Generate mipmaps
    if (options.mipmap !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    
    // Anisotropic filtering if available
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const maxAniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 
        Math.min(8, maxAniso));
    }
    
    console.log(`[Work Globe] Texture loaded: ${url}`);
    
    if (options.onLoad) {
      options.onLoad();
    }
  };
  
  image.onerror = () => {
    console.error(`[Work Globe] Failed to load texture: ${url}`);
  };
  
  image.src = url;
  return texture;
}

function checkAllTexturesLoaded() {
  // Simple check - if all three textures are non-null, consider them ready
  // (actual image loading happens async via onLoad callbacks)
  if (earthTexture && fogTexture && lightningTexture) {
    texturesReady = true;
    console.log('[Work Globe] All textures initialized');
  }
}

// ━━━ INITIALIZATION ━━━
export function initWorkGlobe() {
  canvas = document.getElementById('work-globe-canvas');
  if (!canvas) {
    console.error('[Work Globe] Canvas not found');
    return;
  }

  console.log('[Work Globe] Initializing WebGL2...');
  console.log('[Work Globe] Debug flags:', {
    'Fog/Lightning disabled': DEBUG_DISABLE_FOG_LIGHTNING,
    'Culling disabled': DEBUG_DISABLE_CULLING,
    'Force solid color': DEBUG_FORCE_SOLID_COLOR
  });

  // Get WebGL2 context
  gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    console.error('[Work Globe] WebGL2 not supported, falling back...');
    // TODO: Implement Canvas 2D fallback
    return;
  }

  // Setup canvas size
  resizeCanvas();

  // Create shader programs with bound attributes
  globeProgram = createProgram(gl, globeVertexShader, globeFragmentShader, {
    position: 0,
    normal: 1,
    uv: 2
  });
  atmosphereProgram = createProgram(gl, atmosphereVertexShader, atmosphereFragmentShader, {
    position: 0,
    normal: 1
  });
  fogProgram = createProgram(gl, fogVertexShader, fogFragmentShader, {
    position: 0,
    normal: 1,
    uv: 2
  });
  lightningProgram = createProgram(gl, lightningVertexShader, lightningFragmentShader, {
    position: 0,
    normal: 1,
    uv: 2
  });
  
  myceliumProgram = createProgram(gl, myceliumVertexShader, myceliumFragmentShader, {
    position: 0,
    normal: 1,
    uv: 2,
    age: 3
  });
  
  myceliumCoreProgram = createProgram(gl, myceliumVertexShader, myceliumCoreFragmentShader, {
    position: 0,
    normal: 1,
    uv: 2,
    age: 3
  });
  
  sporeProgram = createProgram(gl, sporeVertexShader, sporeFragmentShader, {
    position: 0,
    velocity: 1,
    life: 2,
    size: 3,
    phase: 4
  });

  // Create sphere geometry
  const sphere = createSphereGeometry(1.0, 40, 40);
  sphereVertexCount = sphere.indices.length;
  
  // Create mycelium hyphae network
  // Convert degrees to radians: lat in [-π/2, π/2], lon in [-π, π]
  const toRad = deg => deg * Math.PI / 180;
  const myceliumSeeds = [
    { lat: toRad(39.6), lon: toRad(22.4) },   // Larissa, Greece
    { lat: toRad(41.4), lon: toRad(2.2) }     // Barcelona, Spain
  ];
  
  // Add fewer random land seeds for cleaner look
  for (let i = 0; i < 6; i++) {
    myceliumSeeds.push({
      lat: (Math.random() - 0.5) * Math.PI * 0.6,  // ±54 degrees (avoid poles)
      lon: (Math.random() - 0.5) * Math.PI * 2     // ±180 degrees
    });
  }
  
  const mycelium = createMyceliumHyphae(1.0, myceliumSeeds, {
    stepSize: 0.008,
    minLength: 120,
    maxLength: 220,
    branchProb: 0.08,
    killRadius: 0.025,
    mergeRadius: 0.015,
    widthBase: 0.010,
    widthNode: 0.016,
    tubeSegments: 6
  });
  
  myceliumVertexCount = mycelium.indices.length;

  // Create VAO for globe
  globeVAO = gl.createVertexArray();
  gl.bindVertexArray(globeVAO);

  // Position buffer
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  // Normal buffer
  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  // UV buffer
  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

  // Index buffer
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  
  // Create VAO for mycelium
  myceliumVAO = gl.createVertexArray();
  gl.bindVertexArray(myceliumVAO);
  
  // Position buffer
  const myceliumPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, myceliumPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mycelium.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  
  // Normal buffer
  const myceliumNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, myceliumNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mycelium.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  
  // UV buffer
  const myceliumUvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, myceliumUvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mycelium.uvs, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  
  // Age buffer (for growth animation)
  const myceliumAgeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, myceliumAgeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mycelium.ages, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
  
  // Index buffer
  const myceliumIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, myceliumIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mycelium.indices, gl.STATIC_DRAW);
  
  gl.bindVertexArray(null);
  
  console.log(`[Work Globe] Created mycelium network: ${mycelium.stats.paths} paths, ${mycelium.stats.segments} segments`);

  // Initialize spore particle system
  sporeSystem = new SporeSystem(gl, 2000);
  console.log('[Work Globe] Spore particle system initialized');

  // Setup matrices
  projectionMatrix = mat4.perspective(
    Math.PI / 4,
    canvas.width / canvas.height,
    0.1,
    100.0
  );
  viewMatrix = mat4.lookAt([0, 0, 3], [0, 0, 0], [0, 1, 0]);
  modelMatrix = mat4.create();

  // GL settings
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  
  console.log('[Work Globe] Initial GL state set: DEPTH_TEST=true, BLEND=true (will disable for globe base pass)');

  // Load textures
  let loadedCount = 0;
  const onTextureLoad = () => {
    loadedCount++;
    console.log(`[Work Globe] Texture ${loadedCount}/3 loaded`);
    if (loadedCount === 3) {
      texturesReady = true;
      console.log('[Work Globe] ✅ All textures ready - Earth should be visible now');
      console.log('[Work Globe] texturesReady flag is now:', texturesReady);
      console.log('[Work Globe] earthTexture is:', earthTexture);
    }
  };
  
  console.log('[Work Globe] Starting texture loading...');
  
  earthTexture = loadTexture(gl, './artifacts/work-page/ominus-earth.png', {
    mipmap: true,
    onLoad: onTextureLoad
  });
  
  fogTexture = loadTexture(gl, './artifacts/work-page/ominus-fog-cloud.png', {
    mipmap: true,
    onLoad: onTextureLoad
  });
  
  lightningTexture = loadTexture(gl, './artifacts/work-page/lightning.png', {
    mipmap: true,
    onLoad: onTextureLoad
  });

  // Event listeners
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  window.addEventListener('resize', resizeCanvas);

  // Start animation
  animate();

  console.log('[Work Globe] WebGL2 initialization complete');
}

// ━━━ RENDERING ━━━
let firstRenderLogged = false;
let firstTextureRenderLogged = false;
function render() {
  if (!firstRenderLogged) {
    console.log('[Work Globe] First render frame - globe should be visible');
    console.log(`[Work Globe] Textures ready: ${texturesReady}, Time: ${time}`);
    firstRenderLogged = true;
  }
  
  // Log once when textures become ready
  if (texturesReady && !firstTextureRenderLogged) {
    console.log('[Work Globe] 🎨 First render WITH textures!');
    console.log('[Work Globe] earthTexture exists:', !!earthTexture);
    firstTextureRenderLogged = true;
  }
  
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Update time
  time += 0.01;

  // Update rotation with velocity (inertia)
  if (!isDragging) {
    rotation.y += rotationVelocity.x;
    rotation.x += rotationVelocity.y;

    // Apply damping
    rotationVelocity.x *= 0.95;
    rotationVelocity.y *= 0.95;

    // Auto-rotate
    if (autoRotate && Math.abs(rotationVelocity.x) < 0.001) {
      rotation.y += 0.002;
    }
  }

  // Clamp X rotation (don't flip upside down)
  rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.x));

  // Update model matrix
  const rotX = mat4.rotateX(rotation.x);
  const rotY = mat4.rotateY(rotation.y);
  modelMatrix = mat4.multiply(rotY, rotX);

  // ━━━ Draw Globe ━━━
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  
  // Debug toggle: disable culling if testing
  if (DEBUG_DISABLE_CULLING) {
    gl.disable(gl.CULL_FACE);
  }
  
  gl.useProgram(globeProgram);
  gl.bindVertexArray(globeVAO);

  const uProjection = gl.getUniformLocation(globeProgram, 'uProjection');
  const uView = gl.getUniformLocation(globeProgram, 'uView');
  const uModel = gl.getUniformLocation(globeProgram, 'uModel');
  const uTime = gl.getUniformLocation(globeProgram, 'uTime');
  const uDaymap = gl.getUniformLocation(globeProgram, 'uDaymap');
  const uUseDaymap = gl.getUniformLocation(globeProgram, 'uUseDaymap');
  
  // DEBUG: Log uniform locations once
  if (!firstRenderLogged) {
    console.log('[Work Globe] Uniform locations:', {
      uProjection, uView, uModel, uTime, uDaymap, uUseDaymap
    });
  }

  gl.uniformMatrix4fv(uProjection, false, projectionMatrix);
  gl.uniformMatrix4fv(uView, false, viewMatrix);
  gl.uniformMatrix4fv(uModel, false, modelMatrix);
  gl.uniform1f(uTime, time);
  
  // Debug toggle: force solid color mode
  if (DEBUG_FORCE_SOLID_COLOR) {
    gl.uniform1i(uUseDaymap, 0); // Use procedural fallback (solid colors)
    if (!firstRenderLogged && texturesReady) {
      console.log('⚠️ [DEBUG] FORCING SOLID COLOR MODE - textures disabled');
    }
  }
  // Bind Earth texture if ready
  else if (texturesReady && earthTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.uniform1i(uDaymap, 0);
    gl.uniform1i(uUseDaymap, 1);
    
    // Check for WebGL errors
    const error = gl.getError();
    if (error !== gl.NO_ERROR && !firstRenderLogged) {
      console.error('[Work Globe] WebGL error after texture binding:', error);
    }
  } else {
    // Using procedural fallback
    gl.uniform1i(uUseDaymap, 0);
  }
  
  // ━━━ COMPREHENSIVE DEBUG (log once per page load) ━━━
  if (!firstRenderLogged && texturesReady) {
    console.group('🔍 [Work Globe] FULL WEBGL STATE DIAGNOSTIC');
    
    // 0) Canvas/DOM check
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
    const computedStyle = window.getComputedStyle(canvas);
    console.log('Canvas CSS:', {
      display: computedStyle.display,
      opacity: computedStyle.opacity,
      visibility: computedStyle.visibility,
      zIndex: computedStyle.zIndex,
      position: computedStyle.position
    });
    
    // 1) Draw call sanity
    console.log('Sphere vertex count:', sphereVertexCount);
    console.log('Current program in use:', gl.getParameter(gl.CURRENT_PROGRAM) === globeProgram);
    
    // 2) GL state snapshot
    const viewport = gl.getParameter(gl.VIEWPORT);
    console.log('VIEWPORT:', viewport);
    console.log('DEPTH_TEST:', gl.getParameter(gl.DEPTH_TEST));
    console.log('CULL_FACE:', gl.getParameter(gl.CULL_FACE));
    console.log('FRONT_FACE:', gl.getParameter(gl.FRONT_FACE), '(CCW=2305, CW=2304)');
    console.log('BLEND:', gl.getParameter(gl.BLEND));
    console.log('COLOR_WRITEMASK:', gl.getParameter(gl.COLOR_WRITEMASK));
    console.log('DEPTH_WRITEMASK:', gl.getParameter(gl.DEPTH_WRITEMASK));
    console.log('SCISSOR_TEST:', gl.getParameter(gl.SCISSOR_TEST));
    
    // 3) Camera & matrices
    console.log('Camera distance:', cameraDistance);
    console.log('Camera rotation:', rotation);
    console.log('Near/Far planes: 0.1 / 100');
    console.log('Model matrix scale check (should be ~1):', 
      Math.sqrt(modelMatrix[0]*modelMatrix[0] + modelMatrix[1]*modelMatrix[1] + modelMatrix[2]*modelMatrix[2])
    );
    
    // 4) Program/attribute binding
    const aPosition = gl.getAttribLocation(globeProgram, 'aPosition');
    const aNormal = gl.getAttribLocation(globeProgram, 'aNormal');
    const aUv = gl.getAttribLocation(globeProgram, 'aUv');
    console.log('Attribute locations:', { aPosition, aNormal, aUv });
    
    // 5) Sampler bindings & booleans
    console.log('ACTIVE_TEXTURE:', gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0);
    gl.activeTexture(gl.TEXTURE0);
    console.log('TEXTURE_BINDING_2D on unit 0:', gl.getParameter(gl.TEXTURE_BINDING_2D));
    console.log('Uniform values set: uDaymap=0, uUseDaymap=1');
    
    // 6) Texture upload details
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    console.log('Earth texture MIN_FILTER:', gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER));
    console.log('Earth texture MAG_FILTER:', gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER));
    console.log('Earth texture WRAP_S:', gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S));
    console.log('Earth texture WRAP_T:', gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T));
    console.log('UNPACK_FLIP_Y_WEBGL:', gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL));
    
    // Final error check
    const finalError = gl.getError();
    console.log('gl.getError() before draw:', finalError === gl.NO_ERROR ? 'NO_ERROR ✅' : finalError);
    
    console.groupEnd();
  }
  
  // Check shader compilation/link errors
  if (!firstRenderLogged) {
    const programError = gl.getProgramParameter(globeProgram, gl.LINK_STATUS);
    if (!programError) {
      console.error('[Work Globe] Program not linked:', gl.getProgramInfoLog(globeProgram));
    }
  }

  gl.drawElements(gl.TRIANGLES, sphereVertexCount, gl.UNSIGNED_SHORT, 0);
  
  // Post-draw diagnostic
  if (!firstRenderLogged && texturesReady) {
    const drawError = gl.getError();
    console.log('🎨 [Draw] gl.getError() after globe draw:', drawError === gl.NO_ERROR ? 'NO_ERROR ✅' : drawError);
    console.log('📊 [Globe Pass] State:', {
      BLEND: gl.getParameter(gl.BLEND),
      DEPTH_TEST: gl.getParameter(gl.DEPTH_TEST),
      DEPTH_WRITEMASK: gl.getParameter(gl.DEPTH_WRITEMASK),
      CULL_FACE: gl.getParameter(gl.CULL_FACE)
    });
  }

  // ━━━ Draw Atmosphere (back-face) ━━━
  if (!DEBUG_DISABLE_FOG_LIGHTNING) {
    // Atmosphere needs blending for glow effect
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); // Don't write depth for atmosphere glow
    
    gl.useProgram(atmosphereProgram);
    gl.cullFace(gl.FRONT); // Render back faces
    gl.enable(gl.CULL_FACE);

    const uProjectionAtm = gl.getUniformLocation(atmosphereProgram, 'uProjection');
    const uViewAtm = gl.getUniformLocation(atmosphereProgram, 'uView');
    const uModelAtm = gl.getUniformLocation(atmosphereProgram, 'uModel');

    gl.uniformMatrix4fv(uProjectionAtm, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewAtm, false, viewMatrix);
    gl.uniformMatrix4fv(uModelAtm, false, modelMatrix);

    gl.drawElements(gl.TRIANGLES, sphereVertexCount, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.CULL_FACE);
    
    // Log atmosphere state
    if (!firstRenderLogged && texturesReady) {
      console.log('🌫️ [Atmosphere Pass] State:', {
        BLEND: gl.getParameter(gl.BLEND),
        BLEND_FUNC: [gl.getParameter(gl.BLEND_SRC_ALPHA), gl.getParameter(gl.BLEND_DST_ALPHA)],
        DEPTH_WRITEMASK: gl.getParameter(gl.DEPTH_WRITEMASK)
      });
    }
    // State will be restored at end of render()
  } else if (!firstRenderLogged && texturesReady) {
    console.log('⚠️ [DEBUG] FOG/LIGHTNING/ATMOSPHERE DISABLED for isolation test');
  }
  
  // ━━━ Draw Mycelium Hyphae - Body Pass (alpha-blended, dark fibrous) ━━━
  if (myceliumProgram && myceliumVAO && myceliumVertexCount > 0) {
    myceliumGrowthTime += 0.5; // Slower growth speed (~5-6 seconds to fully reveal)
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false); // Don't write depth - sit on surface
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    
    gl.useProgram(myceliumProgram);
    gl.bindVertexArray(myceliumVAO);
    
    const uProjectionMyc = gl.getUniformLocation(myceliumProgram, 'uProjection');
    const uViewMyc = gl.getUniformLocation(myceliumProgram, 'uView');
    const uModelMyc = gl.getUniformLocation(myceliumProgram, 'uModel');
    const uTimeMyc = gl.getUniformLocation(myceliumProgram, 'uTime');
    const uBodyColor = gl.getUniformLocation(myceliumProgram, 'uBodyColor');
    const uCoreColor = gl.getUniformLocation(myceliumProgram, 'uCoreColor');
    const uCoreGain = gl.getUniformLocation(myceliumProgram, 'uCoreGain');
    const uGrowthTime = gl.getUniformLocation(myceliumProgram, 'uGrowthTime');
    const uOpacityNoise = gl.getUniformLocation(myceliumProgram, 'uOpacityNoise');
    
    gl.uniformMatrix4fv(uProjectionMyc, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewMyc, false, viewMatrix);
    gl.uniformMatrix4fv(uModelMyc, false, modelMatrix);
    gl.uniform1f(uTimeMyc, time);
    // Using intro page palette: darker necrotic for body, bright decay-green for highlights
    gl.uniform3f(uBodyColor, 0.35, 0.50, 0.40); // Darkened necrotic - fibrous mass
    gl.uniform3f(uCoreColor, 0.247, 1.0, 0.624); // rgb(63, 255, 159) - decay-green glow!
    gl.uniform1f(uCoreGain, 0.0); // No core in body pass
    gl.uniform1f(uGrowthTime, myceliumGrowthTime);
    gl.uniform1f(uOpacityNoise, 0.025); // 2.5% opacity variation
    
    gl.drawElements(gl.TRIANGLES, myceliumVertexCount, gl.UNSIGNED_SHORT, 0);
    
    if (!firstRenderLogged && texturesReady) {
      console.log('🍄 [Mycelium Body Pass] Dark fibrous mass, alpha-blended');
    }
  }
  
  // ━━━ Draw Mycelium Core - Additive Pass (thin centerline glint) ━━━
  if (myceliumCoreProgram && myceliumVAO && myceliumVertexCount > 0) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // Additive for core glint
    gl.depthMask(false);
    
    gl.useProgram(myceliumCoreProgram);
    gl.bindVertexArray(myceliumVAO);
    
    const uProjectionCore = gl.getUniformLocation(myceliumCoreProgram, 'uProjection');
    const uViewCore = gl.getUniformLocation(myceliumCoreProgram, 'uView');
    const uModelCore = gl.getUniformLocation(myceliumCoreProgram, 'uModel');
    const uTimeCore = gl.getUniformLocation(myceliumCoreProgram, 'uTime');
    const uCoreColorCore = gl.getUniformLocation(myceliumCoreProgram, 'uCoreColor');
    const uCoreGainCore = gl.getUniformLocation(myceliumCoreProgram, 'uCoreGain');
    const uGrowthTimeCore = gl.getUniformLocation(myceliumCoreProgram, 'uGrowthTime');
    
    gl.uniformMatrix4fv(uProjectionCore, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewCore, false, viewMatrix);
    gl.uniformMatrix4fv(uModelCore, false, modelMatrix);
    gl.uniform1f(uTimeCore, time);
    gl.uniform3f(uCoreColorCore, 0.247, 1.0, 0.624); // Decay-green glint - memorable!
    gl.uniform1f(uCoreGainCore, 0.15); // Slightly brighter for visibility
    gl.uniform1f(uGrowthTimeCore, myceliumGrowthTime);
    
    gl.drawElements(gl.TRIANGLES, myceliumVertexCount, gl.UNSIGNED_SHORT, 0);
    
    if (!firstRenderLogged && texturesReady) {
      console.log('✨ [Mycelium Core Pass] Subtle centerline glint, additive gain=0.12');
    }
  }
  
  // ━━━ Draw Fog Layer (alpha-blended, scaled sphere) ━━━
  if (!DEBUG_DISABLE_FOG_LIGHTNING && texturesReady && fogTexture) {
    gl.depthMask(false); // Don't write depth
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    gl.useProgram(fogProgram);
    gl.bindVertexArray(globeVAO);
    
    // Scale model matrix slightly (1.012x) to sit above surface
    const fogScale = 1.012;
    const scaledModel = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      scaledModel[i] = modelMatrix[i];
      if (i === 0 || i === 5 || i === 10) {
        scaledModel[i] *= fogScale;
      }
    }
    
    const uProjectionFog = gl.getUniformLocation(fogProgram, 'uProjection');
    const uViewFog = gl.getUniformLocation(fogProgram, 'uView');
    const uModelFog = gl.getUniformLocation(fogProgram, 'uModel');
    const uFogTex = gl.getUniformLocation(fogProgram, 'uFogTex');
    const uFogTint = gl.getUniformLocation(fogProgram, 'uFogTint');
    const uFogStrength = gl.getUniformLocation(fogProgram, 'uFogStrength');
    const uFogScroll = gl.getUniformLocation(fogProgram, 'uFogScroll');
    const uTimeFog = gl.getUniformLocation(fogProgram, 'uTime');
    
    gl.uniformMatrix4fv(uProjectionFog, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewFog, false, viewMatrix);
    gl.uniformMatrix4fv(uModelFog, false, scaledModel);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fogTexture);
    gl.uniform1i(uFogTex, 1);
    
    gl.uniform3f(uFogTint, 0.15, 0.22, 0.20); // Lighter, more subtle green
    gl.uniform1f(uFogStrength, 0.20); // Reduced from 0.35 - much more transparent
    gl.uniform2f(uFogScroll, 0.002, 0.0007);
    gl.uniform1f(uTimeFog, time);
    
    gl.drawElements(gl.TRIANGLES, sphereVertexCount, gl.UNSIGNED_SHORT, 0);
    
    // Log fog state
    if (!firstRenderLogged && texturesReady) {
      console.log('☁️ [Fog Pass] Uniforms:', {
        uFogTint: [0.15, 0.22, 0.20],
        uFogStrength: 0.20,
        uFogScroll: [0.002, 0.0007]
      });
      console.log('☁️ [Fog Pass] State:', {
        BLEND: gl.getParameter(gl.BLEND),
        BLEND_FUNC: [gl.getParameter(gl.BLEND_SRC_RGB), gl.getParameter(gl.BLEND_DST_RGB)],
        DEPTH_WRITEMASK: gl.getParameter(gl.DEPTH_WRITEMASK),
        ACTIVE_TEXTURE: gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0
      });
    }
  }
  
  // ━━━ Draw Lightning Layer (additive, scaled sphere) ━━━
  if (!DEBUG_DISABLE_FOG_LIGHTNING && texturesReady && lightningTexture) {
    gl.depthMask(false); // Don't write depth
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // Additive blending
    
    gl.useProgram(lightningProgram);
    gl.bindVertexArray(globeVAO);
    
    // Use same scaled model as fog
    const lightningScale = 1.012;
    const scaledModel = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      scaledModel[i] = modelMatrix[i];
      if (i === 0 || i === 5 || i === 10) {
        scaledModel[i] *= lightningScale;
      }
    }
    
    const uProjectionLightning = gl.getUniformLocation(lightningProgram, 'uProjection');
    const uViewLightning = gl.getUniformLocation(lightningProgram, 'uView');
    const uModelLightning = gl.getUniformLocation(lightningProgram, 'uModel');
    const uLightningTex = gl.getUniformLocation(lightningProgram, 'uLightningTex');
    const uLightningColor = gl.getUniformLocation(lightningProgram, 'uLightningColor');
    const uLightningGain = gl.getUniformLocation(lightningProgram, 'uLightningGain');
    const uLightningScroll = gl.getUniformLocation(lightningProgram, 'uLightningScroll');
    const uTimeLightning = gl.getUniformLocation(lightningProgram, 'uTime');
    const uFlickerFreq = gl.getUniformLocation(lightningProgram, 'uFlickerFreq');
    const uFlickerDuty = gl.getUniformLocation(lightningProgram, 'uFlickerDuty');
    
    gl.uniformMatrix4fv(uProjectionLightning, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewLightning, false, viewMatrix);
    gl.uniformMatrix4fv(uModelLightning, false, scaledModel);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, lightningTexture);
    gl.uniform1i(uLightningTex, 2);
    
    gl.uniform3f(uLightningColor, 0.35, 0.70, 0.60); // Softer teal
    gl.uniform1f(uLightningGain, 0.50); // Reduced from 0.9 - much more subtle
    gl.uniform2f(uLightningScroll, 0.005, -0.001);
    gl.uniform1f(uTimeLightning, time);
    gl.uniform1f(uFlickerFreq, 0.5); // Slower - 0.5Hz instead of 0.8Hz
    gl.uniform1f(uFlickerDuty, 0.04); // Shorter flashes - 4% instead of 6%
    
    gl.drawElements(gl.TRIANGLES, sphereVertexCount, gl.UNSIGNED_SHORT, 0);
    
    // Log lightning state
    if (!firstRenderLogged && texturesReady) {
      console.log('⚡ [Lightning Pass] Uniforms:', {
        uLightningColor: [0.35, 0.70, 0.60],
        uLightningGain: 0.50,
        uFlickerFreq: 0.5,
        uFlickerDuty: 0.04
      });
      console.log('⚡ [Lightning Pass] State:', {
        BLEND: gl.getParameter(gl.BLEND),
        BLEND_FUNC: [gl.getParameter(gl.BLEND_SRC_RGB), gl.getParameter(gl.BLEND_DST_RGB)],
        DEPTH_WRITEMASK: gl.getParameter(gl.DEPTH_WRITEMASK),
        ACTIVE_TEXTURE: gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0
      });
    }
  }
  
  // ━━━ Update Spore Particles ━━━
  if (sporeSystem) {
    // Calculate lightning intensity from current flicker state (matches lightning shader logic)
    const lightningTime = time;
    const slowPulse = Math.sin(lightningTime * 0.5 * 2.0 * Math.PI) * 0.5 + 0.5; // 0.5Hz
    const strobePhase = (lightningTime * 2.0) % 1.0;
    const strobe = strobePhase < 0.04 ? 1.0 : 0.0; // 4% duty cycle
    const lightningIntensity = slowPulse * (0.3 + strobe * 0.7);
    
    sporeSystem.update(0.016, lightningIntensity); // Assume ~60fps (16ms)
  }
  
  // ━━━ Draw Spore Particles (additive blend) ━━━
  if (sporeProgram && sporeSystem && sporeSystem.activeParticles > 0) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // Additive for glow
    gl.depthMask(false);
    gl.enable(gl.PROGRAM_POINT_SIZE); // Enable point size from vertex shader
    
    gl.useProgram(sporeProgram);
    
    // Set uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(sporeProgram, 'uProjection'), false, projectionMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(sporeProgram, 'uView'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(sporeProgram, 'uModel'), false, modelMatrix);
    gl.uniform1f(gl.getUniformLocation(sporeProgram, 'uTime'), time);
    
    // Use intro page color palette
    gl.uniform3f(gl.getUniformLocation(sporeProgram, 'uSporeColor'), 0.247, 1.0, 0.624); // Decay-green #3FFF9F
    gl.uniform3f(gl.getUniformLocation(sporeProgram, 'uEmberColor'), 0.784, 1.0, 0.863); // Ember color #C8FFDC
    
    // Render particles
    sporeSystem.render(sporeProgram);
    
    if (!firstRenderLogged && texturesReady) {
      console.log('🍄 [Spore Particles] Explosive bursts on lightning strikes');
    }
  }
  
  // ━━━ RESTORE STATE FOR NEXT FRAME ━━━
  // Critical: Reset all state so next frame's globe base pass starts clean
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
  
  // Log final state restoration
  if (!firstRenderLogged && texturesReady) {
    console.log('🔄 [State Restored] Ready for next frame:', {
      BLEND: gl.getParameter(gl.BLEND),
      DEPTH_WRITEMASK: gl.getParameter(gl.DEPTH_WRITEMASK)
    });
  }
  
  // Mark first render complete
  if (!firstRenderLogged && texturesReady) {
    firstRenderLogged = true;
    console.log('✅ [Work Globe] First complete render cycle finished!');
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  render();
}

// ━━━ INPUT HANDLING ━━━
function onPointerDown(e) {
  isDragging = true;
  autoRotate = false;
  lastPointerPos = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = 'grabbing';
}

function onPointerMove(e) {
  if (!isDragging) return;

  const deltaX = e.clientX - lastPointerPos.x;
  const deltaY = e.clientY - lastPointerPos.y;

  rotationVelocity.x = deltaX * 0.005;
  rotationVelocity.y = deltaY * 0.005;

  rotation.y += rotationVelocity.x;
  rotation.x += rotationVelocity.y;

  lastPointerPos = { x: e.clientX, y: e.clientY };
}

function onPointerUp() {
  isDragging = false;
  canvas.style.cursor = 'grab';

  // Re-enable auto-rotate after 3 seconds of no interaction
  setTimeout(() => {
    if (!isDragging && Math.abs(rotationVelocity.x) < 0.001) {
      autoRotate = true;
    }
  }, 3000);
}

function resizeCanvas() {
  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = container.clientHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  console.log(`[Work Globe] Canvas resized: ${width}×${height} (DPR: ${dpr}, buffer: ${canvas.width}×${canvas.height})`);

  if (gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    projectionMatrix = mat4.perspective(
      Math.PI / 4,
      width / height,
      0.1,
      100.0
    );
  }
}

// ━━━ CLEANUP ━━━
export function cleanupWorkGlobe() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (gl) {
    // Clean up GL resources
    gl.deleteProgram(globeProgram);
    gl.deleteProgram(atmosphereProgram);
    gl.deleteProgram(fogProgram);
    gl.deleteProgram(lightningProgram);
    gl.deleteVertexArray(globeVAO);
    
    // Delete textures
    if (earthTexture) gl.deleteTexture(earthTexture);
    if (fogTexture) gl.deleteTexture(fogTexture);
    if (lightningTexture) gl.deleteTexture(lightningTexture);
  }

  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerup', onPointerUp);
  canvas.removeEventListener('pointerleave', onPointerUp);
  window.removeEventListener('resize', resizeCanvas);

  console.log('[Work Globe] Cleanup complete');
}
