/**
 * ━━━ MYCELIAL GLOBE - RAW WEBGL2 WORK EXPERIENCE VISUALIZATION ━━━
 * Interactive 3D Earth globe showing work locations
 * Pure WebGL2 - no libraries, full control, maximum performance
 * Necrographic shader-based aesthetic with instanced pins
 */

// Work location data
const WORK_LOCATIONS = {
  larissa: {
    name: 'Larissa, Greece',
    coords: { lat: 39.6390, lng: 22.4181 },
    color: 0x7aae8a, // decay-green
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
    color: 0xff7a33, // orange (current location)
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

let scene, camera, renderer, globe, pins, myceliumStrand, controls;
let raycaster, mouse, hoveredPin = null;
let animationFrameId = null;

/**
 * Initialize the globe when work section is loaded
 */
export function initWorkGlobe() {
  const canvas = document.getElementById('work-globe-canvas');
  if (!canvas) {
    console.error('[Work Globe] Canvas not found');
    return;
  }

  console.log('[Work Globe] Initializing Three.js scene...');

  // Scene setup
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08090a, 400, 2000);

  // Camera setup - IMPORTANT: aspect ratio must match container
  const container = canvas.parentElement;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const aspect = containerWidth / containerHeight;
  
  camera = new THREE.PerspectiveCamera(45, aspect, 1, 2000);
  camera.position.z = 500;

  // Renderer setup
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(containerWidth, containerHeight);
  renderer.setClearColor(0x000000, 0);

  // BRIGHTER, more natural lighting to see Earth clearly
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // White ambient
  scene.add(ambientLight);

  // Main sun-like directional light
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.0); // Bright white
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  // Fill light for shadows
  const fillLight = new THREE.DirectionalLight(0x8899aa, 0.4); // Cool fill
  fillLight.position.set(-5, 0, -3);
  scene.add(fillLight);

  // Subtle bottom light
  const bottomLight = new THREE.DirectionalLight(0x556677, 0.2);
  bottomLight.position.set(0, -5, 0);
  scene.add(bottomLight);

  // Raycaster for pin detection
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Create globe
  createGlobe();

  // Create location pins
  createLocationPins();

  // Create mycelium connection between locations
  createMyceliumConnection();

  // Add atmospheric particles
  createAtmosphericParticles();

  // OrbitControls for smooth dragging
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = 0.5;
  controls.enableZoom = true;
  controls.minDistance = 300;
  controls.maxDistance = 800;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  // Event listeners for pin hover
  canvas.addEventListener('pointermove', onPointerMove);

  // Resize handler
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();

  // Hide helper text after 5 seconds
  setTimeout(() => {
    const helperText = document.querySelector('.work-helper-text');
    if (helperText) helperText.classList.add('hidden');
  }, 5000);

  console.log('[Work Globe] Initialization complete');
}

/**
 * Create the main globe mesh
 */
function createGlobe() {
  // Smooth sphere geometry
  const geometry = new THREE.SphereGeometry(200, 50, 50);

  // Load REAL NASA Earth texture WITHOUT heavy color filtering
  const textureLoader = new THREE.TextureLoader();
  
  // NASA Blue Marble - high quality Earth texture
  const earthTexture = textureLoader.load(
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/planets/earth_atmos_2048.jpg',
    () => {
      console.log('[Work Globe] Earth texture loaded successfully');
    },
    undefined,
    (err) => {
      console.error('[Work Globe] Failed to load texture:', err);
    }
  );

  // Simple material - let the texture shine through naturally
  const material = new THREE.MeshPhongMaterial({
    map: earthTexture,
    color: 0xffffff, // WHITE - no color tinting!
    emissive: 0x0a0a0a, // Very subtle dark emissive
    emissiveIntensity: 0.05,
    shininess: 20,
    specular: 0x333333 // Subtle gray specular
  });

  globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // Subtle green wireframe for aesthetic
  const wireframeGeometry = new THREE.EdgesGeometry(geometry, 20);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x4a6a5a, // Muted green
    transparent: true,
    opacity: 0.15
  });
  const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
  globe.add(wireframe);

  // Soft cyan/green atmospheric glow
  const glowGeometry = new THREE.SphereGeometry(208, 32, 32);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      c: { value: 0.5 },
      p: { value: 4.0 },
      glowColor: { value: new THREE.Color(0x4a9a8a) } // Soft teal
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float c;
      uniform float p;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
        gl_FragColor = vec4(glowColor, intensity * 0.4);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
  scene.add(glowMesh);
}

/**
 * Create spore pins for work locations
 */
function createLocationPins() {
  pins = [];

  Object.entries(WORK_LOCATIONS).forEach(([key, location]) => {
    const pin = createPin(location);
    pin.userData = { key, location };
    pins.push(pin);
    globe.add(pin);
  });
}

/**
 * Create a single pin at geographic coordinates
 */
function createPin(location) {
  const { lat, lng, color } = location;
  
  // Convert lat/lng to 3D position
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const radius = 205; // Slightly above globe surface

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  // Create pin group
  const pinGroup = new THREE.Group();
  pinGroup.position.set(x, y, z);
  pinGroup.lookAt(0, 0, 0); // Face outward from globe

  // Main spore sphere with better glow
  const sporeGeometry = new THREE.SphereGeometry(5, 8, 8); // Slightly bigger
  const sporeMaterial = new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.8, // Brighter glow
    roughness: 0.3,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95
  });
  const spore = new THREE.Mesh(sporeGeometry, sporeMaterial);
  pinGroup.add(spore);

  // Larger, more visible glow halo
  const haloGeometry = new THREE.SphereGeometry(10, 8, 8);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.35,
    side: THREE.BackSide
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  pinGroup.add(halo);

  // Brighter point light for pin glow
  const pinLight = new THREE.PointLight(color, 2, 60);
  pinGroup.add(pinLight);

  // Store original scale for hover animation
  pinGroup.userData.originalScale = 1;
  pinGroup.userData.isPin = true;

  return pinGroup;
}

/**
 * Create mycelium strand connecting Greece to Spain
 */
function createMyceliumConnection() {
  const greece = WORK_LOCATIONS.larissa.coords;
  const spain = WORK_LOCATIONS.barcelona.coords;

  // Create curved path between locations
  const points = [];
  const segments = 50;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Interpolate lat/lng
    const lat = greece.lat + (spain.lat - greece.lat) * t;
    const lng = greece.lng + (spain.lng - spain.lng) * t;
    
    // Convert to 3D with arc (lift the path above globe)
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const heightOffset = Math.sin(t * Math.PI) * 40; // Arc height
    const radius = 202 + heightOffset;

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeometry = new THREE.TubeGeometry(curve, segments, 1, 4, false);
  const tubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a6d5a, // Dark teal-green
    emissive: 0x1a4d3a, // Very dark green emissive
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.5,
    roughness: 0.6,
    metalness: 0.3
  });

  myceliumStrand = new THREE.Mesh(tubeGeometry, tubeMaterial);
  globe.add(myceliumStrand);
}

/**
 * Create floating particles around globe
 */
function createAtmosphericParticles() {
  const particleCount = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  // DARK ominous color palette
  const colorPalette = [
    new THREE.Color(0x2a5d4a), // Dark teal
    new THREE.Color(0x3a4a3a), // Dark moss green
    new THREE.Color(0x4a5a4a), // Gray-green
    new THREE.Color(0x1a3d2e)  // Very dark green
  ];

  for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const radius = 210 + Math.random() * 180;

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    positions.push(x, y, z);

    // Random dark color from palette
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.5,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

/**
 * Add event listeners for interaction
 */
function onPointerMove(event) {
  // Update mouse position for raycasting (pin hover detection)
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  checkPinHover();
}

function onWindowResize() {
  const canvas = renderer.domElement;
  const container = canvas.parentElement;
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

/**
 * Check for pin hover with raycasting
 */
function checkPinHover() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(pins, true);

  if (intersects.length > 0) {
    const pinGroup = intersects[0].object.parent;
    if (pinGroup.userData.isPin && pinGroup !== hoveredPin) {
      if (hoveredPin) unhoverPin(hoveredPin);
      hoverPin(pinGroup);
      hoveredPin = pinGroup;
    }
  } else if (hoveredPin) {
    unhoverPin(hoveredPin);
    hoveredPin = null;
  }
}

function hoverPin(pin) {
  // Scale up pin
  pin.scale.set(1.3, 1.3, 1.3);

  // Show info bubble
  showLocationInfo(pin.userData.location, pin.userData.key);
}

function unhoverPin(pin) {
  // Scale back to normal
  pin.scale.set(1, 1, 1);

  // Hide info bubble
  hideLocationInfo();
}

/**
 * Show location info bubble
 */
function showLocationInfo(location, key) {
  let infoBubble = document.querySelector('.work-location-info');
  if (!infoBubble) {
    infoBubble = document.createElement('div');
    infoBubble.className = 'work-location-info';
    document.body.appendChild(infoBubble);
  }

  // Build content
  const icon = key === 'barcelona' ? '📍' : '🏛️';
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

  // Position at mouse cursor
  infoBubble.style.left = `${mouse.x * 50 + 50}%`;
  infoBubble.style.top = `${-mouse.y * 50 + 50}%`;

  // Show with animation
  requestAnimationFrame(() => infoBubble.classList.add('visible'));
}

function hideLocationInfo() {
  const infoBubble = document.querySelector('.work-location-info');
  if (infoBubble) {
    infoBubble.classList.remove('visible');
  }
}

/**
 * Animation loop
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  // Update controls (handles rotation, damping, auto-rotate)
  if (controls) {
    controls.update();
  }

  // Animate mycelium strand (pulsing opacity)
  if (myceliumStrand) {
    myceliumStrand.material.opacity = 0.15 + Math.sin(Date.now() * 0.001) * 0.1;
  }

  // Pulse pin halos
  pins.forEach((pin, index) => {
    const halo = pin.children[1]; // Second child is the halo
    if (halo) {
      const pulseSpeed = 0.002 + index * 0.001;
      halo.scale.setScalar(1 + Math.sin(Date.now() * pulseSpeed) * 0.2);
    }
  });

  // Render
  renderer.render(scene, camera);
}

/**
 * Cleanup function (called when leaving work section)
 */
export function cleanupWorkGlobe() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (renderer) {
    renderer.dispose();
  }

  hideLocationInfo();

  console.log('[Work Globe] Cleanup complete');
}
