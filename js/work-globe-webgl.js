/**
 * Mycelial globe visualization with WebGL2.
 * Pure implementation without external libraries.
 */

// Work location data
const WORK_LOCATIONS = {
  larissa: {
    name: 'Larissa, Greece',
    imageCoords: { x: 777, y: 330 }, // Pin A position on texture
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
    imageCoords: { x: 689, y: 310 }, // Pin B position on texture
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

// Matrix utilities
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
  },

  transformPoint(mat, point) {
    const x = point[0], y = point[1], z = point[2];
    const w = mat[3] * x + mat[7] * y + mat[11] * z + mat[15] || 1.0;
    return [
      (mat[0] * x + mat[4] * y + mat[8] * z + mat[12]) / w,
      (mat[1] * x + mat[5] * y + mat[9] * z + mat[13]) / w,
      (mat[2] * x + mat[6] * y + mat[10] * z + mat[14]) / w,
      w
    ];
  }
};

// ━━━ GLOBE STATE ━━━
let gl, canvas;
let globeProgram, atmosphereProgram, fogProgram, lightningProgram, myceliumProgram, myceliumCoreProgram, sporeProgram, pinProgram, dataStreamProgram, textBillboardProgram;
let globeVAO, sphereVertexCount;
let myceliumVAO, myceliumVertexCount, myceliumGrowthTime = 0;
let sporeSystem = null;
let workPinSystem = null;
let dataStreamSystem = null;
let projectionMatrix, viewMatrix, modelMatrix;
let rotation = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };
let isDragging = false;
let lastPointerPos = { x: 0, y: 0 };
let clickStartPos = { x: 0, y: 0 };
let clickStartTime = 0;
let animationFrameId = null;
let autoRotate = true;
let time = 0;

// Textures
let earthTexture = null;
let fogTexture = null;
let lightningTexture = null;
let texturesReady = false;

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
layout(location = 5) in vec3 color;     // Per-particle color

out float vLife;
out float vPhase;
out float vIsOrbital; // Flag for orbital particles (larger/brighter)
out vec3 vColor; // Pass color to fragment shader

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;

void main() {
  vLife = life;
  vPhase = phase;
  vColor = color;
  
  // Detect orbital particles: they have zero velocity AND larger size
  float velMag = length(velocity);
  vIsOrbital = (velMag < 0.001 && size > 1.0) ? 1.0 : 0.0;
  
  // Cloud particles: no additional gravity (handled in CPU physics)
  vec3 pos = position;
  
  vec4 viewPos = uView * uModel * vec4(pos, 1.0);
  
  // Size-based rendering with special handling for orbital particles
  float baseSize = size < 0.2 ? 2.0 : 4.0; // Tiny particles get smaller base
  float pulseMult = size < 0.2 ? 0.5 : 2.0; // Less pulse on tiny particles
  
  // Orbital particles: MUCH MUCH bigger and stronger pulse
  if (vIsOrbital > 0.5) {
    baseSize = 40.0; // Massive base size
    pulseMult = 10.0; // Very strong pulse
  }
  
  float pulse = sin(uTime * 3.0 + phase * 6.28) * 0.3 + 0.7;
  gl_PointSize = size * (baseSize + pulseMult * pulse) * life * life;
  
  gl_Position = uProjection * viewPos;
}
`;

const sporeFragmentShader = `#version 300 es
precision highp float;

in float vLife;
in float vPhase;
in float vIsOrbital; // Flag for orbital particles
in vec3 vColor; // Per-particle color

out vec4 fragColor;

uniform float uTime;
uniform vec3 uSporeColor;    // Decay-green color (fallback)
uniform vec3 uEmberColor;    // Bright ember color for core

void main() {
  // Distance from center of point sprite
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  // Soft circular falloff
  if (dist > 0.5) discard;
  
  float alpha = smoothstep(0.5, 0.0, dist) * vLife;
  
  // Pulsing glow - stronger for orbital particles
  float pulseSpeed = vIsOrbital > 0.5 ? 6.0 : 4.0;
  float pulseAmount = vIsOrbital > 0.5 ? 0.5 : 0.3;
  float pulse = sin(uTime * pulseSpeed + vPhase * 6.28) * pulseAmount + (1.0 - pulseAmount);
  
  // Use per-particle color if available (non-zero), otherwise use uniform color
  vec3 baseColor = length(vColor) > 0.01 ? vColor : uSporeColor;
  
  // Orbital particles: much brighter with stronger core
  vec3 edgeColor, coreColor;
  float brightness;
  
  if (vIsOrbital > 0.5) {
    // Orbital particles: brighter, more ember-like, using particle color
    brightness = 2.5; // Much brighter
    edgeColor = mix(baseColor, uEmberColor, 0.4) * brightness;
    coreColor = mix(baseColor, uEmberColor, 0.7) * brightness; // More color in core
  } else {
    // Regular spores: normal brightness
    brightness = 1.0;
    edgeColor = baseColor * 0.6;
    coreColor = mix(baseColor, uEmberColor, 0.3);
  }
  
  vec3 color = mix(edgeColor, coreColor, 1.0 - dist * 2.0);
  
  // Additive blending will be enabled
  fragColor = vec4(color * pulse, alpha);
}
`;

// ━━━ WORK PIN SHADERS ━━━
const pinVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec3 instancePos;    // Pin base position
layout(location = 3) in vec3 instanceColor;  // Pin color
layout(location = 4) in float instanceHeight; // Animated height
layout(location = 5) in float instancePhase;  // Pulse phase
layout(location = 6) in float instanceScale;  // Hover scale

out vec3 vNormal;
out vec3 vWorldPos;
out vec3 vColor;
out float vHeight;
out float vPhase;
out float vScale;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;

void main() {
  vColor = instanceColor;
  vHeight = instanceHeight;
  vPhase = instancePhase;
  vScale = instanceScale;
  
  // Calculate orientation vector (pin points outward from globe center)
  vec3 upVector = normalize(instancePos);
  vec3 tangent = normalize(cross(upVector, vec3(0.0, 1.0, 0.0)));
  vec3 bitangent = cross(upVector, tangent);
  
  // Build rotation matrix to orient pin
  mat3 orientation = mat3(tangent, upVector, bitangent);
  
  // Scale and orient geometry
  vec3 localPos = position * instanceScale; // Apply scale
  localPos.y *= instanceHeight; // Stretch along pin axis
  vec3 rotatedPos = orientation * localPos;
  
  // Position at base
  vec3 worldPos = instancePos + rotatedPos;
  
  vNormal = mat3(uModel) * (orientation * normal);
  vWorldPos = (uModel * vec4(worldPos, 1.0)).xyz;
  
  gl_Position = uProjection * uView * uModel * vec4(worldPos, 1.0);
}
`;

const pinFragmentShader = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec3 vColor;
in float vHeight;
in float vPhase;
in float vScale;

out vec4 fragColor;

uniform float uTime;
uniform vec3 uCameraPos;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  
  // IDLE PULSING GLOW - slow, subtle breathing effect
  float idlePulse = sin(uTime * 1.5 + vPhase) * 0.15 + 0.85; // Range: 0.7 - 1.0
  
  // HOVER BOOST - when scaled up, pulse faster and brighter
  float hoverBoost = smoothstep(1.0, 1.4, vScale); // 0 when idle, 1 when fully hovered
  float hoverPulse = sin(uTime * 3.0 + vPhase) * 0.2 + 0.8;
  float finalPulse = mix(idlePulse, hoverPulse, hoverBoost);
  
  // Rim lighting (edges glow more)
  float rim = 1.0 - max(0.0, dot(normal, viewDir));
  rim = pow(rim, 3.0);
  
  // Height-based gradient (brighter at tip)
  float heightGradient = length(vWorldPos) - 1.0; // Distance from globe center
  heightGradient = smoothstep(0.0, vHeight, heightGradient);
  
  // Combine effects
  vec3 baseColor = vColor * 0.4;
  vec3 glowColor = vColor * 2.2;
  vec3 finalColor = mix(baseColor, glowColor, rim * 0.5 + heightGradient * 0.5);
  finalColor *= finalPulse;
  
  // Add core glow (boosted on hover)
  float coreBrightness = heightGradient * rim * (1.0 + hoverBoost * 0.5);
  finalColor += vColor * coreBrightness * finalPulse;
  
  fragColor = vec4(finalColor, 0.8 + rim * 0.2);
}
`;

// ━━━ DATA STREAM PARTICLE SHADERS ━━━
const dataStreamVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in float life;
layout(location = 2) in float phase;

out float vLife;
out float vPhase;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uTime;

void main() {
  vLife = life;
  vPhase = phase;
  
  vec4 viewPos = uView * uModel * vec4(position, 1.0);
  
  // Pulsing size
  float pulse = sin(uTime * 4.0 + phase * 6.28) * 0.3 + 0.7;
  gl_PointSize = (2.0 + pulse) * life;
  
  gl_Position = uProjection * viewPos;
}
`;

const dataStreamFragmentShader = `#version 300 es
precision highp float;

in float vLife;
in float vPhase;

out vec4 fragColor;

uniform vec3 uStreamColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  if (dist > 0.5) discard;
  
  float alpha = smoothstep(0.5, 0.0, dist) * vLife;
  fragColor = vec4(uStreamColor, alpha);
}
`;

// Text Billboard Shaders
const textBillboardVertexShader = `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUv;

out vec2 vUv;

uniform mat4 uProjection;
uniform mat4 uView;
uniform vec3 uWorldPos;
uniform vec2 uSize;
uniform float uHoverProgress;

void main() {
  vUv = aUv;
  
  // Extract camera right and up vectors from view matrix
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up = vec3(uView[0][1], uView[1][1], uView[2][1]);
  
  // Offset above pin with hover animation
  vec3 worldPos = uWorldPos + vec3(0.0, 0.2 + uHoverProgress * 0.1, 0.0);
  
  // Billboard calculation
  vec3 billboardPos = worldPos + 
    right * aPosition.x * uSize.x * 0.5 + 
    up * aPosition.y * uSize.y * 0.5;
  
  gl_Position = uProjection * uView * vec4(billboardPos, 1.0);
}
`;

const textBillboardFragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTextTexture;
uniform float uAlpha;

void main() {
  vec4 texColor = texture(uTextTexture, vUv);
  // Simple pass-through with alpha multiplication
  fragColor = vec4(texColor.rgb, texColor.a * uAlpha);
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

function createPinGeometry(baseRadius = 0.02, height = 1.0, sides = 6) {
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

// Spore particle system
class SporeSystem {
  constructor(gl, maxParticles = 10000) {
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
    this.colorBuffer = gl.createBuffer(); // Per-particle color
    
    // Pre-allocate typed arrays
    this.positionData = new Float32Array(maxParticles * 3);
    this.velocityData = new Float32Array(maxParticles * 3);
    this.lifeData = new Float32Array(maxParticles);
    this.sizeData = new Float32Array(maxParticles);
    this.phaseData = new Float32Array(maxParticles);
    this.colorData = new Float32Array(maxParticles * 3); // RGB per particle
    
    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    // Setup attributes
    this.setupAttribute(this.positionBuffer, 0, 3, this.positionData);
    this.setupAttribute(this.velocityBuffer, 1, 3, this.velocityData);
    this.setupAttribute(this.lifeBuffer, 2, 1, this.lifeData);
    this.setupAttribute(this.sizeBuffer, 3, 1, this.sizeData);
    this.setupAttribute(this.phaseBuffer, 4, 1, this.phaseData);
    this.setupAttribute(this.colorBuffer, 5, 3, this.colorData); // Color attribute
    
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
    if (this.emissionCooldown > 0) return;
    
    const tinyParticles = Math.floor(250 + intensity * 350);
    const regularParticles = Math.floor(50 + intensity * 100);
    const emitted = [];
    
    for (const origin of originPositions) {
      const radius = Math.sqrt(origin[0]**2 + origin[1]**2 + origin[2]**2);
      const normal = [origin[0]/radius, origin[1]/radius, origin[2]/radius];
      
      // Tiny particles with surface-biased spread
      for (let i = 0; i < tinyParticles; i++) {
        const particle = this.getInactiveParticle();
        if (!particle) break;
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        // Create random direction
        let dir = [
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ];
        
        // Project to surface tangent (remove 70% radial component)
        const radialComponent = dir[0]*normal[0] + dir[1]*normal[1] + dir[2]*normal[2];
        dir[0] -= normal[0] * radialComponent * 0.7;
        dir[1] -= normal[1] * radialComponent * 0.7;
        dir[2] -= normal[2] * radialComponent * 0.7;
        
        const len = Math.sqrt(dir[0]**2 + dir[1]**2 + dir[2]**2);
        const speed = 0.4 + Math.random() * 0.6;
        dir[0] = (dir[0]/len) * speed;
        dir[1] = (dir[1]/len) * speed;
        dir[2] = (dir[2]/len) * speed;
        
        dir[0] += normal[0] * 0.08;
        dir[1] += normal[1] * 0.08;
        dir[2] += normal[2] * 0.08;
        
        const jitter = 0.05;
        particle.position = [
          origin[0] + (Math.random() - 0.5) * jitter,
          origin[1] + (Math.random() - 0.5) * jitter,
          origin[2] + (Math.random() - 0.5) * jitter
        ];
        particle.velocity = dir;
        particle.life = 1.0;
        particle.size = 0.03 + Math.random() * 0.06; // Super tiny (0.03-0.09)
        particle.active = true;
        
        emitted.push(particle);
      }
      
      // Regular particles
      for (let i = 0; i < regularParticles; i++) {
        const particle = this.getInactiveParticle();
        if (!particle) break;
        
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        let dir = [
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        ];
        
        const radialComponent = dir[0]*normal[0] + dir[1]*normal[1] + dir[2]*normal[2];
        dir[0] -= normal[0] * radialComponent * 0.7;
        dir[1] -= normal[1] * radialComponent * 0.7;
        dir[2] -= normal[2] * radialComponent * 0.7;
        
        const len = Math.sqrt(dir[0]**2 + dir[1]**2 + dir[2]**2);
        const speed = 0.5 + Math.random() * 0.7; // 0.5-1.2
        dir[0] = (dir[0]/len) * speed;
        dir[1] = (dir[1]/len) * speed;
        dir[2] = (dir[2]/len) * speed;
        
        dir[0] += normal[0] * 0.1;
        dir[1] += normal[1] * 0.1;
        dir[2] += normal[2] * 0.1;
        
        const jitter = 0.05;
        particle.position = [
          origin[0] + (Math.random() - 0.5) * jitter,
          origin[1] + (Math.random() - 0.5) * jitter,
          origin[2] + (Math.random() - 0.5) * jitter
        ];
        particle.velocity = dir;
        particle.life = 1.0;
        particle.size = 0.12 + Math.random() * 0.15;
        particle.active = true;
        
        emitted.push(particle);
      }
    }
    
    this.emissionCooldown = 0.35;
    return emitted.length;
  }
  
  getInactiveParticle() {
    return this.particles.find(p => !p.active);
  }
  
  update(dt, lightningIntensity = 0) {
    if (lightningIntensity > 0.7 && this.lastLightningIntensity < 0.5) {
      // Get mycelium branch tip positions (sample from actual geometry)
      const tipPositions = this.getMyceliumTips();
      if (tipPositions.length > 0) {
        this.emitBurst(tipPositions, lightningIntensity);
      }
    }
    this.lastLightningIntensity = lightningIntensity;
    
    // Update cooldown
    if (this.emissionCooldown > 0) {
      this.emissionCooldown -= dt;
    }
    
    // Update physics for all particles
    this.activeParticles = 0;
    this.orbitalInjectionPoint = 0; // Mark where burst particles end
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      
      p.life -= dt * 0.35;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      
      // Three-phase motion: expansion, peak spread, gravity fall
      
      if (p.life > 0.7) {
        // Expansion phase: Light drag, particles still moving fast
        const drag = 0.96;
        p.velocity[0] *= drag;
        p.velocity[1] *= drag;
        p.velocity[2] *= drag;
      } else if (p.life > 0.3) {
        const drag = 0.93;
        p.velocity[0] *= drag;
        p.velocity[1] *= drag;
        p.velocity[2] *= drag;
        p.velocity[1] -= dt * 0.3;
      } else {
        const drag = 0.90;
        p.velocity[0] *= drag;
        p.velocity[1] *= drag;
        p.velocity[2] *= drag;
        p.velocity[1] -= dt * 1.2;
      }
      
      p.position[0] += p.velocity[0] * dt;
      p.position[1] += p.velocity[1] * dt;
      p.position[2] += p.velocity[2] * dt;
      
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
      
      // Default color (0,0,0) means use uniform color
      this.colorData[idx] = 0;
      this.colorData[idx + 1] = 0;
      this.colorData[idx + 2] = 0;
      
      this.activeParticles++;
    }
    
    // Mark end of burst particles (orbitals will be injected after)
    this.orbitalInjectionPoint = this.activeParticles;
  }
  
  injectOrbitalParticles(orbitals) {
    // Add orbital particles after burst particles
    orbitals.forEach(orbital => {
      if (this.activeParticles >= this.maxParticles) return;
      
      const idx = this.activeParticles * 3;
      this.positionData[idx] = orbital.position[0];
      this.positionData[idx + 1] = orbital.position[1];
      this.positionData[idx + 2] = orbital.position[2];
      
      this.velocityData[idx] = 0;
      this.velocityData[idx + 1] = 0;
      this.velocityData[idx + 2] = 0;
      
      this.lifeData[this.activeParticles] = orbital.life;
      this.sizeData[this.activeParticles] = orbital.size * 8.0; // MUCH MUCH bigger than regular spores
      this.phaseData[this.activeParticles] = orbital.phase;
      
      // Use pin color for orbital particles
      this.colorData[idx] = orbital.color[0];
      this.colorData[idx + 1] = orbital.color[1];
      this.colorData[idx + 2] = orbital.color[2];
      
      this.activeParticles++;
    });
    
    // Update GPU buffers after orbital injection
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
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colorData.subarray(0, this.activeParticles * 3));
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

// Text Renderer
class TextRenderer {
  constructor(gl) {
    this.gl = gl;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.textureCache = new Map();
  }
  
  createTextTexture(company, role, period, color = '#3FFF9F') {
    const key = `${company}_${role}_${period}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);
    
    const width = 512;
    const height = 128;
    this.canvas.width = width;
    this.canvas.height = height;
    
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);
    
    // Dark background with transparency
    ctx.fillStyle = 'rgba(20, 30, 28, 0.9)';
    ctx.fillRect(0, 0, width, height);
    
    // Border glow
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeRect(4, 4, width-8, height-8);
    ctx.shadowBlur = 0;
    
    // Company name (large)
    ctx.fillStyle = '#C8FFDC';
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.fillText(company, 20, 45);
    
    // Role (medium)
    ctx.fillStyle = color;
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(role, 20, 75);
    
    // Period (small)
    ctx.fillStyle = '#7AAE8A';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(period, 20, 100);
    
    // Create WebGL texture
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    this.textureCache.set(key, texture);
    return texture;
  }
}

// Work Pin System
class WorkPinSystem {
  constructor(gl, locations, pinGeometry) {
    this.gl = gl;
    this.locations = locations;
    this.pins = [];
    this.hoveredPin = null;
    this.selectedPin = null;
    this.pinGeometry = pinGeometry;
    
    this.textRenderer = new TextRenderer(gl);
    this.textQuads = new Map();
    
    // Orbital particle system for hover effect
    this.orbitalParticles = [];
    this.maxOrbitalsPerPin = 8; // 8 particles orbit each hovered pin
    
    this.initializePins();
    this.setupBuffers();
    this.createBillboardGeometry();
    this.generateTextTextures(); // Must be after initializePins
    this.setupOrbitalParticles();
  }
  
  initializePins() {
    for (const [key, loc] of Object.entries(this.locations)) {
      const { imageCoords, name, color } = loc;
      
      if (!imageCoords) {
        console.warn(`[WorkPinSystem] No image coordinates for ${key}`);
        continue;
      }
      
      // Convert image coordinates to UV (matching sphere geometry UV mapping)
      // Image dimensions: 1536×1024
      const u = 1.0 - (imageCoords.x / 1536.0); // Flip U to match sphere UV
      const v = imageCoords.y / 1024.0;
      
      // Convert UV to spherical coordinates
      // U maps to longitude (0-1 → 0-2π)
      // V maps to latitude (0-1 → π-0)
      const theta = u * Math.PI * 2.0;  // Longitude in radians
      const phi = v * Math.PI;           // Latitude in radians
      
      // Convert spherical to cartesian (matching sphere geometry)
      const r = 1.0;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      
      const basePos = [
        r * cosTheta * sinPhi,  // X
        r * cosPhi,              // Y (up)
        r * sinTheta * sinPhi
      ];
      
      this.pins.push({
        key,
        name: name || key,
        basePos,
        color: color || [0.247, 1.0, 0.624],
        targetHeight: 0.12,
        currentHeight: 0.12,
        targetScale: 1.0,      // For hover scale animation
        currentScale: 1.0,     // Smooth interpolated scale
        pulsePhase: Math.random() * Math.PI * 2,
        hovered: false,
        selected: false,
        imageCoords,
        orbitals: []           // Orbital particles for this pin
      });
    }
  }
  
  setupBuffers() {
    const gl = this.gl;
    const numInstances = this.pins.length;
    
    // Instance data arrays
    this.instancePosData = new Float32Array(numInstances * 3);
    this.instanceColorData = new Float32Array(numInstances * 3);
    this.instanceHeightData = new Float32Array(numInstances);
    this.instancePhaseData = new Float32Array(numInstances);
    this.instanceScaleData = new Float32Array(numInstances);
    
    // Fill initial data
    this.pins.forEach((pin, i) => {
      this.instancePosData[i * 3] = pin.basePos[0];
      this.instancePosData[i * 3 + 1] = pin.basePos[1];
      this.instancePosData[i * 3 + 2] = pin.basePos[2];
      
      this.instanceColorData[i * 3] = pin.color[0];
      this.instanceColorData[i * 3 + 1] = pin.color[1];
      this.instanceColorData[i * 3 + 2] = pin.color[2];
      
      this.instanceHeightData[i] = pin.currentHeight;
      this.instancePhaseData[i] = pin.pulsePhase;
      this.instanceScaleData[i] = pin.currentScale;
    });
    
    // Create VAO for instanced rendering
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    // Base geometry (shared across all instances)
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.pinGeometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.pinGeometry.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    
    // Instance attributes
    this.instancePosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instancePosBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instancePosData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    
    this.instanceColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceColorData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(3, 1);
    
    this.instanceHeightBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceHeightBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceHeightData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(4, 1);
    
    this.instancePhaseBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instancePhaseBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instancePhaseData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(5, 1);
    
    this.instanceScaleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceScaleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceScaleData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(6, 1);
    
    // Index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.pinGeometry.indices, gl.STATIC_DRAW);
    
    gl.bindVertexArray(null);
  }
  
  update(dt, time) {
    // Animate pin heights and scales
    this.pins.forEach((pin, i) => {
      // Height animation (subtle on hover)
      const targetHeight = pin.hovered ? pin.targetHeight * 1.2 : pin.targetHeight;
      pin.currentHeight += (targetHeight - pin.currentHeight) * 0.12;
      this.instanceHeightData[i] = pin.currentHeight;
      
      // Scale animation (clear hover feedback)
      const targetScale = pin.hovered ? 1.4 : 1.0;
      pin.currentScale += (targetScale - pin.currentScale) * 0.15;
      this.instanceScaleData[i] = pin.currentScale;
      
      // Update orbital particles
      pin.orbitals.forEach(orbital => {
        // Fade in when hovered, fade out when not
        orbital.targetActive = pin.hovered ? 1.0 : 0.0;
        
        // Fast fade-in (instant), slower fade-out (smooth)
        if (pin.hovered && orbital.active < 1.0) {
          orbital.active += (orbital.targetActive - orbital.active) * 0.5; // Fast fade-in
        } else if (!pin.hovered && orbital.active > 0.0) {
          orbital.active += (orbital.targetActive - orbital.active) * 0.08; // Slower fade-out
        }
        
        // Rotate around pin
        if (orbital.active > 0.001) {
          orbital.angle += orbital.speed * dt;
        }
      });
    });
    
    // Update GPU buffers
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceHeightBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceHeightData);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceScaleBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceScaleData);
    
    // Animate text billboards
    this.pins.forEach((pin, i) => {
      const quad = this.textQuads.get(pin.key);
      if (quad) {
        quad.targetAlpha = pin.hovered ? 1.0 : 0.0;
        quad.alpha += (quad.targetAlpha - quad.alpha) * 0.15;
      }
    });
  }
  
  getOrbitalParticles(time) {
    // Return active orbital particles as world positions for rendering
    const particles = [];
    
    this.pins.forEach(pin => {
      if (pin.hovered) {
        pin.orbitals.forEach(orbital => {
          if (orbital.active > 0.001) { // Lower threshold for visibility
            // Calculate orbital position in 3D space
            // Create a local tangent plane at the pin
            const pinPos = pin.basePos;
            const normal = [pinPos[0], pinPos[1], pinPos[2]]; // Pin normal (outward)
            const len = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
            const n = [normal[0]/len, normal[1]/len, normal[2]/len];
            
            // Create two perpendicular vectors in the tangent plane
            let tangent = [0, 0, 0];
            if (Math.abs(n[1]) < 0.9) {
              tangent = [0, 1, 0]; // Use up vector
            } else {
              tangent = [1, 0, 0]; // Use right vector
            }
            
            // Cross product to get first tangent basis vector
            const t1 = [
              tangent[1]*n[2] - tangent[2]*n[1],
              tangent[2]*n[0] - tangent[0]*n[2],
              tangent[0]*n[1] - tangent[1]*n[0]
            ];
            const t1Len = Math.sqrt(t1[0]**2 + t1[1]**2 + t1[2]**2);
            t1[0] /= t1Len; t1[1] /= t1Len; t1[2] /= t1Len;
            
            // Cross product to get second tangent basis vector
            const t2 = [
              n[1]*t1[2] - n[2]*t1[1],
              n[2]*t1[0] - n[0]*t1[2],
              n[0]*t1[1] - n[1]*t1[0]
            ];
            
            // Calculate orbital position
            const angle = orbital.angle;
            const radius = orbital.radius * 1.05; // Slightly above surface
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            
            // World position: pin + offset in tangent plane + slight outward push
            const worldPos = [
              pinPos[0] * 1.15 + t1[0] * offsetX + t2[0] * offsetY + n[0] * 0.03,
              pinPos[1] * 1.15 + t1[1] * offsetX + t2[1] * offsetY + n[1] * 0.03,
              pinPos[2] * 1.15 + t1[2] * offsetX + t2[2] * offsetY + n[2] * 0.03
            ];
            
            particles.push({
              position: worldPos,
              life: orbital.active,
              size: 0.08 + Math.sin(time * 3 + orbital.phaseOffset) * 0.02,
              phase: orbital.phaseOffset,
              color: pin.color
            });
          }
        });
      }
    });
    
    return particles;
  }
  
  render(program, projMatrix, viewMatrix, modelMatrix, time, cameraPos) {
    if (this.pins.length === 0) return;
    
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjection'), false, projMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uView'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, modelMatrix);
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform3fv(gl.getUniformLocation(program, 'uCameraPos'), cameraPos);
    
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      this.pinGeometry.vertexCount,
      gl.UNSIGNED_SHORT,
      0,
      this.pins.length
    );
    
    gl.bindVertexArray(null);
  }
  
  createBillboardGeometry() {
    const gl = this.gl;
    
    // Simple quad: 4 vertices forming 2 triangles
    const positions = new Float32Array([
      -1.0,  1.0,  // top-left
       1.0,  1.0,  // top-right
       1.0, -1.0,  // bottom-right
      -1.0, -1.0   // bottom-left
    ]);
    
    const uvs = new Float32Array([
      0.0, 1.0,  // top-left
      1.0, 1.0,  // top-right
      1.0, 0.0,  // bottom-right
      0.0, 0.0   // bottom-left
    ]);
    
    const indices = new Uint16Array([
      0, 1, 2,  // first triangle
      0, 2, 3   // second triangle
    ]);
    
    // Create VAO for billboard quad
    this.billboardVAO = gl.createVertexArray();
    gl.bindVertexArray(this.billboardVAO);
    
    // Position buffer (aPosition = location 0)
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    
    // UV buffer (aUv = location 1)
    const uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    
    // Index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    
    gl.bindVertexArray(null);
  }
  
  setupOrbitalParticles() {
    // Create orbital particles for each pin
    this.pins.forEach(pin => {
      for (let i = 0; i < this.maxOrbitalsPerPin; i++) {
        const orbital = {
          angle: (i / this.maxOrbitalsPerPin) * Math.PI * 2, // Evenly spaced
          speed: 1.5 + Math.random() * 0.5, // Rotation speed (radians/sec)
          radius: 0.15 + Math.random() * 0.05, // Distance from pin
          phaseOffset: Math.random() * Math.PI * 2,
          active: 0.0, // Fade in/out (0-1)
          targetActive: 0.0
        };
        pin.orbitals.push(orbital);
      }
    });
  }
  
  generateTextTextures() {
    // Pre-generate textures for all work locations
    console.log(`[WorkPinSystem] Generating text textures for ${Object.keys(this.locations).length} locations`);
    
    for (const [key, loc] of Object.entries(this.locations)) {
      const entry = loc.entries[0]; // Get first/current job
      const texture = this.textRenderer.createTextTexture(
        entry.company,
        entry.position,
        entry.period,
        loc.color
      );
      
      this.textQuads.set(key, {
        texture: texture,
        alpha: 0.0,
        targetAlpha: 0.0
      });
      
      console.log(`  ✅ Generated texture for ${key}: ${entry.company} - ${entry.position}`);
    }
    
    console.log(`[WorkPinSystem] Text textures ready: ${this.textQuads.size} quads`);
  }
  
  renderText(program, projMatrix, viewMatrix) {
    const gl = this.gl;
    
    if (!program) {
      console.error('❌ Text billboard program is null!');
      return;
    }
    
    if (!this.billboardVAO) {
      console.error('❌ Billboard VAO not created!');
      return;
    }
    
    // Enable blending for transparent text backgrounds
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST); // Render on top of everything
    
    gl.useProgram(program);
    gl.bindVertexArray(this.billboardVAO);
    
    // Set matrices
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjection'), false, projMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uView'), false, viewMatrix);
    
    // Render each visible text quad
    let renderedCount = 0;
    this.pins.forEach((pin, i) => {
      const quad = this.textQuads.get(pin.key);
      if (!quad || quad.alpha < 0.01) return;
      
      if (renderedCount === 0) {
        console.log(`📝 Rendering billboard for ${pin.key}: alpha=${quad.alpha.toFixed(3)}, hovered=${pin.hovered}`);
      }
      renderedCount++;
      
      // Set uniforms for this billboard
      gl.uniform3fv(gl.getUniformLocation(program, 'uWorldPos'), new Float32Array(pin.basePos));
      gl.uniform2f(gl.getUniformLocation(program, 'uSize'), 5.0, 2.0); // DEBUG: 5x larger for visibility testing
      gl.uniform1f(gl.getUniformLocation(program, 'uHoverProgress'), pin.hovered ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(program, 'uAlpha'), quad.alpha);
      
      // Bind text texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, quad.texture);
      gl.uniform1i(gl.getUniformLocation(program, 'uTextTexture'), 0); // FIX: Correct uniform name
      
      // Check for WebGL errors
      const error = gl.getError();
      if (error !== gl.NO_ERROR && renderedCount === 1) {
        console.error(`❌ WebGL Error after binding texture: ${error}`);
      }
      
      // Draw billboard
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    });
    
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST); // Re-enable depth test
    gl.disable(gl.BLEND);
  }
  
  checkHover(ray, cameraPos) {
    // Ray-sphere intersection for pin selection
    // Will implement proper picking in next step
    this.pins.forEach(pin => {
      pin.hovered = false;
    });
  }
}

// ━━━ DATA STREAM SYSTEM ━━━
class DataStreamSystem {
  constructor(gl, maxParticles = 500) {
    this.gl = gl;
    this.maxParticles = maxParticles;
    this.particles = [];
    this.activeParticles = 0;
    this.emitting = false;
    this.emissionPoint = [0, 0, 0];
    this.emissionColor = [0.247, 1.0, 0.624];
    
    // Initialize particle pool
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        life: 0,
        phase: Math.random() * Math.PI * 2,
        active: false
      });
    }
    
    // Create buffers
    this.positionBuffer = gl.createBuffer();
    this.lifeBuffer = gl.createBuffer();
    this.phaseBuffer = gl.createBuffer();
    
    this.positionData = new Float32Array(maxParticles * 3);
    this.lifeData = new Float32Array(maxParticles);
    this.phaseData = new Float32Array(maxParticles);
    
    // Setup VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lifeData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.phaseData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    
    gl.bindVertexArray(null);
  }
  
  startEmission(point, color) {
    this.emitting = true;
    this.emissionPoint = point;
    this.emissionColor = color;
  }
  
  stopEmission() {
    this.emitting = false;
  }
  
  update(dt) {
    // Emit new particles if active
    if (this.emitting && Math.random() < 0.5) {
      const particle = this.particles.find(p => !p.active);
      if (particle) {
        const spread = 0.02;
        particle.position = [
          this.emissionPoint[0] + (Math.random() - 0.5) * spread,
          this.emissionPoint[1] + (Math.random() - 0.5) * spread,
          this.emissionPoint[2] + (Math.random() - 0.5) * spread
        ];
        
        // Flow upward from pin (inverted gravity)
        const upDir = [
          this.emissionPoint[0] * 0.8,
          this.emissionPoint[1] * 0.8 + 0.5,
          this.emissionPoint[2] * 0.8
        ];
        
        particle.velocity = [
          upDir[0] * (0.5 + Math.random() * 0.5),
          upDir[1] * (0.5 + Math.random() * 0.5),
          upDir[2] * (0.5 + Math.random() * 0.5)
        ];
        particle.life = 1.0;
        particle.active = true;
      }
    }
    
    // Update active particles
    this.activeParticles = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      
      p.life -= dt * 0.8; // 1.25 second lifetime
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      
      // Upward flow with slight drag
      p.velocity[0] *= 0.99;
      p.velocity[1] *= 0.99;
      p.velocity[2] *= 0.99;
      
      p.position[0] += p.velocity[0] * dt;
      p.position[1] += p.velocity[1] * dt;
      p.position[2] += p.velocity[2] * dt;
      
      // Copy to buffers
      const idx = this.activeParticles * 3;
      this.positionData[idx] = p.position[0];
      this.positionData[idx + 1] = p.position[1];
      this.positionData[idx + 2] = p.position[2];
      this.lifeData[this.activeParticles] = p.life;
      this.phaseData[this.activeParticles] = p.phase;
      
      this.activeParticles++;
    }
    
    // Update GPU
    if (this.activeParticles > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positionData.subarray(0, this.activeParticles * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lifeData.subarray(0, this.activeParticles));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.phaseBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.phaseData.subarray(0, this.activeParticles));
    }
  }
  
  render(program, projMatrix, viewMatrix, modelMatrix, time) {
    if (this.activeParticles === 0) return;
    
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjection'), false, projMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uView'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, modelMatrix);
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
    gl.uniform3fv(gl.getUniformLocation(program, 'uStreamColor'), this.emissionColor);
    
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
    
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const maxAniso = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 
        Math.min(8, maxAniso));
    }
    
    if (options.onLoad) {
      options.onLoad();
    }
  };
  
  image.onerror = () => {
    console.error(`Failed to load texture: ${url}`);
  };
  
  image.src = url;
  return texture;
}

function checkAllTexturesLoaded() {
  if (earthTexture && fogTexture && lightningTexture) {
    texturesReady = true;
  }
}

// Initialization
export function initWorkGlobe() {
  canvas = document.getElementById('work-globe-canvas');
  if (!canvas) {
    console.error('[Work Globe] Canvas not found');
    return;
  }
  
  gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    console.error('WebGL2 not supported');
    return;
  }

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
  
  pinProgram = createProgram(gl, pinVertexShader, pinFragmentShader, {
    position: 0,
    normal: 1,
    instancePos: 2,
    instanceColor: 3,
    instanceHeight: 4,
    instancePhase: 5
  });
  
  dataStreamProgram = createProgram(gl, dataStreamVertexShader, dataStreamFragmentShader, {
    position: 0,
    life: 1,
    phase: 2
  });
  
  textBillboardProgram = createProgram(gl, textBillboardVertexShader, textBillboardFragmentShader, {
    aPosition: 0,
    aUv: 1
  });
  
  if (!textBillboardProgram) {
    console.error('❌ Failed to create text billboard shader program!');
  } else {
    console.log('✅ Text billboard shader program created successfully');
  }

  // Create sphere geometry
  const sphere = createSphereGeometry(1.0, 40, 40);
  sphereVertexCount = sphere.indices.length;
  
  // Create mycelium hyphae network
  // Use image coordinates directly for accurate positioning
  const imageToSpherical = (x, y) => {
    const u = 1.0 - (x / 1536.0); // Flip U to match sphere UV
    const v = y / 1024.0;
    const lon = u * Math.PI * 2.0 - Math.PI;  // -π to π
    const lat = (0.5 - v) * Math.PI;          // -π/2 to π/2
    return { lat, lon };
  };
  
  const myceliumSeeds = [
    imageToSpherical(777, 330),  // Greece (Pin A)
    imageToSpherical(689, 310)   // Barcelona (Pin B)
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
  
  sporeSystem = new SporeSystem(gl, 4000);
  
  const pinGeometry = createPinGeometry(0.02, 1.0, 6);
  workPinSystem = new WorkPinSystem(gl, WORK_LOCATIONS, pinGeometry);
  
  dataStreamSystem = new DataStreamSystem(gl, 500);

  projectionMatrix = mat4.perspective(
    Math.PI / 4,
    canvas.width / canvas.height,
    0.1,
    100.0
  );
  viewMatrix = mat4.lookAt([0, 0, 3], [0, 0, 0], [0, 1, 0]);
  modelMatrix = mat4.create();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let loadedCount = 0;
  const onTextureLoad = () => {
    loadedCount++;
    if (loadedCount === 3) {
      texturesReady = true;
    }
  };
  
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
  
  // Touch-specific handling for tap-to-show info on mobile
  let touchStartTime = 0;
  let touchStartPos = { x: 0, y: 0 };
  
  canvas.addEventListener('touchstart', (e) => {
    touchStartTime = Date.now();
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  
  canvas.addEventListener('touchend', (e) => {
    const touchDuration = Date.now() - touchStartTime;
    const touch = e.changedTouches[0];
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPos.x, 2) + 
      Math.pow(touch.clientY - touchStartPos.y, 2)
    );
    
    // If it's a quick tap (< 200ms) and minimal movement (< 10px), treat as tap
    if (touchDuration < 200 && moveDistance < 10) {
      const tappedPin = checkPinHover(touch.clientX, touch.clientY, true);
      if (!tappedPin) {
        // Tapped elsewhere - close info bubble
        hideLocationInfo();
      }
    }
  }, { passive: true });
  
  window.addEventListener('resize', resizeCanvas);

  // Start animation
  animate();
  
  console.log('[Work Globe] Initialization complete');

}

function render() {
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
  
  gl.useProgram(globeProgram);
  gl.bindVertexArray(globeVAO);

  const uProjection = gl.getUniformLocation(globeProgram, 'uProjection');
  const uView = gl.getUniformLocation(globeProgram, 'uView');
  const uModel = gl.getUniformLocation(globeProgram, 'uModel');
  const uTime = gl.getUniformLocation(globeProgram, 'uTime');
  const uDaymap = gl.getUniformLocation(globeProgram, 'uDaymap');
  const uUseDaymap = gl.getUniformLocation(globeProgram, 'uUseDaymap');

  gl.uniformMatrix4fv(uProjection, false, projectionMatrix);
  gl.uniformMatrix4fv(uView, false, viewMatrix);
  gl.uniformMatrix4fv(uModel, false, modelMatrix);
  gl.uniform1f(uTime, time);
  
  if (texturesReady && earthTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.uniform1i(uDaymap, 0);
    gl.uniform1i(uUseDaymap, 1);
  } else {
    gl.uniform1i(uUseDaymap, 0);
  }
  
  gl.drawElements(gl.TRIANGLES, sphereVertexCount, gl.UNSIGNED_SHORT, 0);

  // Atmosphere (back-face)
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
  
  // Mycelium Hyphae - Body Pass
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
  }
  
  // Mycelium Core - Additive Pass
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
  }
  
  // Fog Layer
  if (texturesReady && fogTexture) {
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
  }
  
  // Lightning Layer
  if (texturesReady && lightningTexture) {
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
    gl.uniform1f(uFlickerFreq, 0.5);
    gl.uniform1f(uFlickerDuty, 0.04);
    
    gl.drawElements(gl.TRIANGLES, sphereVertexCount, gl.UNSIGNED_SHORT, 0);
  }
  
  // Update Spore Particles
  if (sporeSystem) {
    // Calculate lightning intensity from current flicker state (matches lightning shader logic)
    const lightningTime = time;
    const slowPulse = Math.sin(lightningTime * 0.5 * 2.0 * Math.PI) * 0.5 + 0.5; // 0.5Hz
    const strobePhase = (lightningTime * 2.0) % 1.0;
    const strobe = strobePhase < 0.04 ? 1.0 : 0.0; // 4% duty cycle
    const lightningIntensity = slowPulse * (0.3 + strobe * 0.7);
    
    sporeSystem.update(0.016, lightningIntensity); // Assume ~60fps (16ms)
  }
  
  // Update Work Pin System and inject orbital particles BEFORE rendering
  if (workPinSystem) {
    workPinSystem.update(0.016, time);
    
    // Get orbital particles and inject into spore system
    if (sporeSystem) {
      const orbitals = workPinSystem.getOrbitalParticles(time);
      if (orbitals.length > 0) {
        sporeSystem.injectOrbitalParticles(orbitals);
      }
    }
  }
  
  // ━━━ Draw Spore Particles (additive blend) ━━━
  if (sporeProgram && sporeSystem && sporeSystem.activeParticles > 0) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // Additive for glow
    gl.depthMask(false);
    
    gl.useProgram(sporeProgram);
    
    // Set uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(sporeProgram, 'uProjection'), false, projectionMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(sporeProgram, 'uView'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(sporeProgram, 'uModel'), false, modelMatrix);
    gl.uniform1f(gl.getUniformLocation(sporeProgram, 'uTime'), time);
    
    // Use intro page color palette
    gl.uniform3f(gl.getUniformLocation(sporeProgram, 'uSporeColor'), 0.247, 1.0, 0.624); // Decay-green #3FFF9F
    gl.uniform3f(gl.getUniformLocation(sporeProgram, 'uEmberColor'), 0.784, 1.0, 0.863); // Ember color #C8FFDC
    
    sporeSystem.render(sporeProgram);
  }
  
  // ━━━ Draw Work Location Pins (alpha-blended crystals) ━━━
  if (pinProgram && workPinSystem) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    
    gl.useProgram(pinProgram);
    
    const cameraPos = [0, 0, 3];
    workPinSystem.render(pinProgram, projectionMatrix, viewMatrix, modelMatrix, time, cameraPos);
    
    // Render text billboards on top of pins
    workPinSystem.renderText(textBillboardProgram, projectionMatrix, viewMatrix);
  }
  
  // Update Data Stream System
  if (dataStreamSystem) {
    dataStreamSystem.update(0.016);
    
    // Emit streams from hovered pins
    if (workPinSystem && workPinSystem.hoveredPin) {
      const pin = workPinSystem.pins.find(p => p.key === workPinSystem.hoveredPin);
      if (pin) {
        const emitPoint = [
          pin.basePos[0] * 1.15,
          pin.basePos[1] * 1.15,
          pin.basePos[2] * 1.15
        ];
        dataStreamSystem.startEmission(emitPoint, pin.color);
      }
    } else {
      dataStreamSystem.stopEmission();
    }
  }
  
  // ━━━ Draw Data Streams (additive particles) ━━━
  if (dataStreamProgram && dataStreamSystem && dataStreamSystem.activeParticles > 0) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    
    gl.useProgram(dataStreamProgram);
    dataStreamSystem.render(dataStreamProgram, projectionMatrix, viewMatrix, modelMatrix, time);
  }
  
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  render();
}

// Input handling
function onPointerDown(e) {
  isDragging = true;
  autoRotate = false;
  lastPointerPos = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = 'grabbing';
  
  // Store click position to detect if it's a click vs drag
  clickStartPos = { x: e.clientX, y: e.clientY };
  clickStartTime = Date.now();
}

function onPointerMove(e) {
  // Don't do hover effects if card is visible
  const infoBubble = document.querySelector('.work-location-info');
  const cardIsVisible = infoBubble && infoBubble.classList.contains('visible');
  
  // Check pin hover (even when not dragging) - visual feedback only
  if (workPinSystem && !isDragging && !cardIsVisible) {
    checkPinHover(e.clientX, e.clientY, false); // Don't show info on hover
  }
  
  if (!isDragging) return;

  const deltaX = e.clientX - lastPointerPos.x;
  const deltaY = e.clientY - lastPointerPos.y;

  rotationVelocity.x = deltaX * 0.005;
  rotationVelocity.y = deltaY * 0.005;

  rotation.y += rotationVelocity.x;
  rotation.x += rotationVelocity.y;

  lastPointerPos = { x: e.clientX, y: e.clientY };
}

function checkPinHover(mouseX, mouseY, showInfo = false) {
  if (!workPinSystem) return;
  
  console.log('[Work Globe] checkPinHover called, showInfo:', showInfo);
  
  // Convert mouse to NDC
  const rect = canvas.getBoundingClientRect();
  const x = ((mouseX - rect.left) / rect.width) * 2 - 1;
  const y = -((mouseY - rect.top) / rect.height) * 2 + 1;
  
  // Simple 2D screen-space distance check
  let closestPin = null;
  let closestDist = 0.25; // Hover radius in NDC space (increased for easier detection)
  
  workPinSystem.pins.forEach(pin => {
    // Project pin position to screen space
    const worldPos = [
      pin.basePos[0] * 1.1, // Slightly above surface
      pin.basePos[1] * 1.1,
      pin.basePos[2] * 1.1
    ];
    
    // Manual MVP transform
    const modelPos = mat4.transformPoint(modelMatrix, worldPos);
    const viewPos = mat4.transformPoint(viewMatrix, modelPos);
    const clipPos = mat4.transformPoint(projectionMatrix, viewPos);
    
    // Perspective divide
    const ndcX = clipPos[0] / clipPos[3];
    const ndcY = clipPos[1] / clipPos[3];
    
    // Check if behind camera
    if (clipPos[3] < 0) return;
    
    // Distance to mouse
    const dist = Math.sqrt((ndcX - x) ** 2 + (ndcY - y) ** 2);
    
    if (dist < closestDist) {
      closestDist = dist;
      closestPin = pin;
    }
  });
  
  console.log('[Work Globe] Closest pin:', closestPin ? closestPin.key : 'none', 'distance:', closestDist);
  
  // Update hover state
  const previousHoveredKey = workPinSystem.hoveredPin;
  workPinSystem.pins.forEach(pin => {
    pin.hovered = (pin === closestPin);
  });
  
  workPinSystem.hoveredPin = closestPin ? closestPin.key : null;
  
  // Only show info if explicitly requested (on click)
  if (showInfo && closestPin) {
    console.log('[Work Globe] Showing info for:', closestPin.key);
    showLocationInfo(closestPin);
  }
  
  // Change cursor
  canvas.style.cursor = closestPin ? 'pointer' : 'grab';
  
  return closestPin;
}

// ━━━ INFO BUBBLE MANAGEMENT ━━━
function projectToScreen(worldPos) {
  // Transform world position through matrices
  const modelPos = mat4.transformPoint(modelMatrix, worldPos);
  const viewPos = mat4.transformPoint(viewMatrix, modelPos);
  const clipPos = mat4.transformPoint(projectionMatrix, viewPos);
  
  // Perspective divide
  const ndcX = clipPos[0] / clipPos[3];
  const ndcY = clipPos[1] / clipPos[3];
  
  // Convert from clip space (-1 to 1) to screen space
  const rect = canvas.getBoundingClientRect();
  const x = (ndcX * 0.5 + 0.5) * rect.width + rect.left;
  const y = (1 - (ndcY * 0.5 + 0.5)) * rect.height + rect.top;
  
  return { x, y };
}

function showLocationInfo(pin) {
  console.log('[Work Globe] showLocationInfo called for:', pin.key);
  
  let infoBubble = document.querySelector('.work-location-info');
  if (!infoBubble) {
    console.log('[Work Globe] Creating new info bubble element');
    infoBubble = document.createElement('div');
    infoBubble.className = 'work-location-info';
    document.body.appendChild(infoBubble);
    
    // Add click handler to close when clicking outside
    document.addEventListener('click', (e) => {
      const bubble = document.querySelector('.work-location-info');
      if (bubble && bubble.classList.contains('visible')) {
        // Check if click is outside the bubble
        if (!bubble.contains(e.target)) {
          hideLocationInfo();
        }
      }
    });
  }

  const location = WORK_LOCATIONS[pin.key];
  const icon = pin.key === 'barcelona' ? '📍' : '🏛️';
  
  console.log('[Work Globe] Building content for:', location.name);
  
  // Build content
  let html = `
    <div class="work-location-header">
      <span class="work-location-icon">${icon}</span>
      ${location.name}
    </div>
  `;

  location.entries.forEach(entry => {
    html += `
      <div class="work-entry">
        <div class="work-company">${entry.company}</div>
        <div class="work-position">${entry.position}</div>
        <div class="work-period">${entry.period}</div>
        <ul class="work-responsibilities">
          ${entry.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
        </ul>
      </div>
    `;
  });

  infoBubble.innerHTML = html;

  // Position centered on screen like about/skills sections
  infoBubble.style.left = '50%';
  infoBubble.style.top = '50%';
  console.log('[Work Globe] Positioned at screen center');
  
  // Show with animation
  requestAnimationFrame(() => {
    infoBubble.classList.add('visible');
    console.log('[Work Globe] Info bubble visible class added');
  });
}

function hideLocationInfo() {
  console.log('[Work Globe] hideLocationInfo called');
  const infoBubble = document.querySelector('.work-location-info');
  if (infoBubble) {
    infoBubble.classList.remove('visible');
    console.log('[Work Globe] Info bubble hidden');
  }
}

function onPointerUp(e) {
  const wasDragging = isDragging;
  isDragging = false;
  canvas.style.cursor = 'grab';
  
  console.log('[Work Globe] Pointer up - was dragging:', wasDragging);
  
  // Calculate if this was a click or a drag
  if (clickStartTime) {
    const clickDuration = Date.now() - clickStartTime;
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - clickStartPos.x, 2) + 
      Math.pow(e.clientY - clickStartPos.y, 2)
    );
    
    console.log('[Work Globe] Click metrics:', { clickDuration, moveDistance });
    
    // If it's a quick click (< 200ms) and minimal movement (< 10px), treat as click
    const isClick = clickDuration < 200 && moveDistance < 10;
    
    if (isClick) {
      console.log('[Work Globe] Valid click detected, checking for pin');
      
      // Don't check for pins if card is visible - let the card's click handler deal with it
      const infoBubble = document.querySelector('.work-location-info');
      const cardIsVisible = infoBubble && infoBubble.classList.contains('visible');
      
      if (!cardIsVisible) {
        checkPinHover(e.clientX, e.clientY, true);
      }
    }
  }
  
  clickStartTime = 0;
  
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
  
  // Hide and remove info bubble
  hideLocationInfo();
  const infoBubble = document.querySelector('.work-location-info');
  if (infoBubble) {
    infoBubble.remove();
  }

  console.log('[Work Globe] Cleanup complete');
}
