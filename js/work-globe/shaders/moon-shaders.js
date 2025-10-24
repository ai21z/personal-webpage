/**
 * Moon shaders - orbital project sphere rendering
 * Features rim lighting, pulsing glow, and self-illumination
 */

export const MOON_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 vNormal;
out vec3 vPosition;
out vec3 vWorldNormal;
out vec3 vViewDir;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uCameraPos;

void main() {
  // Transform normal to world space
  vNormal = mat3(uModel) * normal;
  vWorldNormal = normalize(vNormal);
  
  // World position
  vec4 worldPos = uModel * vec4(position, 1.0);
  vPosition = worldPos.xyz;
  
  // View direction (camera to surface)
  vViewDir = normalize(uCameraPos - vPosition);
  
  gl_Position = uProjection * uView * worldPos;
}
`;

export const MOON_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPosition;
in vec3 vWorldNormal;
in vec3 vViewDir;

out vec4 fragColor;

uniform vec3 uMoonColor;      // Base color
uniform vec3 uRimColor;       // Rim light color
uniform float uTime;          // Animation time
uniform float uGlowIntensity; // Emissive strength
uniform float uPulseSpeed;    // Pulse frequency

void main() {
  // Normalize vectors
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  
  // Basic lambert lighting
  vec3 lightDir = normalize(vec3(0.5, 0.3, 0.5));
  float diffuse = max(dot(N, lightDir), 0.0);
  float ambient = 0.2;
  
  // Rim lighting (Fresnel-like effect)
  float rimPower = 3.0;
  float rimStrength = 0.6;
  float rim = pow(1.0 - max(dot(N, V), 0.0), rimPower);
  vec3 rimLight = uRimColor * rim * rimStrength;
  
  // Pulsing animation
  float pulse = sin(uTime * uPulseSpeed * 2.0 * 3.14159) * 0.15 + 0.85; // 0.7 to 1.0
  
  // Combine lighting
  vec3 color = uMoonColor * (ambient + diffuse * 0.7);
  color += rimLight;
  color += uMoonColor * uGlowIntensity; // Emissive glow
  color *= pulse; // Apply pulse
  
  // Subtle atmospheric glow
  float glow = pow(rim, 2.0) * 0.3;
  color += vec3(glow);
  
  fragColor = vec4(color, 1.0);
}
`;
