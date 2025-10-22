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
let globeProgram, atmosphereProgram, fogProgram, lightningProgram;
let globeVAO, sphereVertexCount;
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

      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices)
  };
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

  // Create sphere geometry
  const sphere = createSphereGeometry(1.0, 40, 40);
  sphereVertexCount = sphere.indices.length;

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
