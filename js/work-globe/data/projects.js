/**
 * Project portfolio data for orbital moon system
 * Designed to support 1-4 projects (currently 1)
 */

export const PROJECTS = [
  {
    id: 'personal-webpage',
    name: 'Personal Necrographic Portfolio',
    description: 'Interactive WebGL2 visualization with mycelial networks, atmospheric effects, and MTG-inspired project cards. Features pure JavaScript implementation without external 3D libraries.',
    tech: ['WebGL2', 'JavaScript', 'GLSL Shaders', 'CSS3', 'Canvas API'],
    github: 'https://github.com/ai21z/personal-webpage',
    
    // Orbital configuration
    initialAngle: 0,        // Starting position (degrees, 0 = front)
    orbitRadius: 1.15,      // Distance from globe center (MUCH closer - just above atmosphere)
    orbitTilt: 0,           // Horizontal orbit (0 = equatorial plane, goes behind globe)
    rotationSpeed: 4.0,     // Degrees per second (360° / 90s = 4°/s for 1.5min orbit)
    
    // Visual styling
    color: [0.66, 0.4, 0.87],  // Purple RGB (#a855f7)
    moonRadius: 0.08,           // Visual size of moon sphere (much smaller - ~8% of globe)
    glowIntensity: 0.3,         // Emissive glow strength
    pulseSpeed: 0.5             // Pulse animation frequency (Hz)
  }
  
  // Future projects (2-4 total):
  // Add new projects here with staggered initialAngle values
  // Recommended angles:
  //   2 projects: [0°, 180°]
  //   3 projects: [0°, 120°, 240°]
  //   4 projects: [0°, 90°, 180°, 270°]
  //
  // Example:
  // {
  //   id: 'project-2',
  //   name: 'Second Project',
  //   description: '...',
  //   tech: ['React', 'TypeScript', 'Node.js'],
  //   github: 'https://github.com/...',
  //   initialAngle: 120,
  //   orbitRadius: 1.65,
  //   orbitTilt: -8,
  //   rotationSpeed: 4.0,
  //   color: [0.95, 0.55, 0.25],
  //   moonRadius: 0.18,
  //   glowIntensity: 0.3,
  //   pulseSpeed: 0.5
  // }
];
