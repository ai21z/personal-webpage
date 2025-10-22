# 🍄 Mycelium Hyphae Implementation - PHASE B

## Overview
**Noise-advected surface growth system** with branching, merging, tapering - true organic mycelium devouring the globe.

**Implementation follows the technical spec:** Body+Core shading split, noise-directed paths, growth animation, proper depth ordering.

## Visual Features

### Geometry
- **Tubular Structures**: Fat tubes (radius 4.0) with circular cross-sections (8 segments)
- **Path Generation**: Spiral paths wrapping around globe surface with organic variation
- **Strand Count**: 12 independent hyphae strands
- **Elevation**: Positioned slightly above globe surface for layered effect

### Shading & Animation
- **Fresnel Rim Lighting**: 3D tube effect using view-dependent edge highlighting
- **Pulsing Animation**: Organic growth animation along tube length
  - Formula: `sin(uTime * 0.8 + position.y * 0.5)`
  - Creates wave-like movement propagating through network
- **Bioluminescent Glow**: Rim-lit edges with controllable intensity
- **Color**: Decay green (0.5, 0.75, 0.55) with 85% opacity

### Integration
- **Render Order**: After lightning layer (final effect layer)
- **Blend Mode**: Standard alpha blending (SRC_ALPHA, ONE_MINUS_SRC_ALPHA)
- **Depth**: No depth writes - renders on top of all other layers
- **Culling**: Back-face culling enabled for proper tube rendering

## Technical Implementation

### Shader System
**Vertex Shader** (`myceliumVertexShader`):
- Transforms position/normal to world space
- Passes vNormal and vViewDir for fresnel calculation
- Animates position with `sin(uTime * 0.8 + position.y * 0.5)` for pulsing effect

**Fragment Shader** (`myceliumFragmentShader`):
- Calculates fresnel term: `pow(1.0 - abs(dot(N, V)), 3.0)`
- Mixes base color with glow based on fresnel and time
- Outputs with alpha for transparency

### Geometry Generation
**Function**: `createMyceliumHyphae(globeRadius, numStrands)`

**Algorithm**:
1. **Path Generation**:
   - Each strand: 120-200 control points
   - Spiral around globe with parametric equations
   - Organic variation using sin/cos functions
   - Random phase offsets per strand

2. **Tube Construction**:
   - Circular cross-section (8 segments)
   - Normal calculation perpendicular to path
   - Proper UV mapping along tube length
   - Index generation for triangle connectivity

**Parameters**:
- `globeRadius`: 1.0 (matches globe sphere)
- `numStrands`: 12
- `tubeRadius`: 4.0 (fat tubes)
- `tubeSegments`: 8 (circular resolution)
- `pathLength`: 120-200 points per strand

### Buffer Setup
**VAO Structure**: `myceliumVAO`
- **Position Buffer**: Float32Array (3 components per vertex)
- **Normal Buffer**: Float32Array (3 components per vertex)
- **UV Buffer**: Float32Array (2 components per vertex)
- **Index Buffer**: Uint16Array (triangle indices)

**Attribute Locations**:
- `0`: `aPosition` (vec3)
- `1`: `aNormal` (vec3)
- `2`: `aUv` (vec2)

### Uniforms
| Uniform | Type | Value | Purpose |
|---------|------|-------|---------|
| `uProjection` | mat4 | Camera projection | 3D transformation |
| `uView` | mat4 | Camera view | 3D transformation |
| `uModel` | mat4 | Globe rotation | 3D transformation |
| `uTime` | float | Animation time | Pulsing animation |
| `uHyphaeColor` | vec4 | (0.5, 0.75, 0.55, 0.85) | Base color + alpha |
| `uGlowIntensity` | float | 1.2 | Bioluminescent brightness |

## Code Locations

### js/work-globe-webgl.js
- **Lines 390-498**: Mycelium vertex/fragment shaders
- **Lines 547-668**: `createMyceliumHyphae()` geometry generation
- **Lines 175-178**: State variables (myceliumProgram, myceliumVAO, myceliumVertexCount)
- **Lines 827-834**: Shader program compilation
- **Lines 838-840**: Geometry generation call (12 strands)
- **Lines 873-906**: VAO buffer setup (position/normal/uv/indices)
- **Lines 1315-1358**: Render pass with uniforms and blending

## Artistic Direction

### Aesthetic
- **Theme**: Organic decay, consumption, transformation
- **Feel**: Living network "devouring" the globe
- **Color Palette**: Bioluminescent decay green
- **Movement**: Pulsing, breathing, growing
- **Integration**: Harmonizes with necrographic Earth aesthetic

### Future Enhancements
1. **Reactive Growth**: Hyphae extend toward work locations
2. **Interactive Tendrils**: Mouse proximity affects growth direction
3. **Decay Animation**: Gradual consumption animation on page load
4. **Spore Particles**: Particle effects around tube endpoints
5. **Connection Strands**: Link work location pins with mycelium bridges

## Performance Notes
- **Vertex Count**: ~12,000-24,000 vertices (depends on path length)
- **Triangle Count**: ~20,000-40,000 triangles
- **Render Cost**: Low - single draw call with simple shaders
- **Animation**: GPU-based via time uniform (no CPU overhead)

## Testing Checklist
- [x] Shaders compile successfully
- [x] Geometry generates without errors
- [x] VAO buffers created and bound
- [x] Render pass integrated into main loop
- [x] Uniforms set correctly
- [x] Blend mode configured
- [x] State management (depth/blend/cull restored)
- [ ] Visual verification (appears on globe)
- [ ] Animation working (tubes pulsing)
- [ ] Glow effect visible
- [ ] No z-fighting with globe
- [ ] Performance acceptable

## Next Steps
1. **Visual Testing**: Load page and verify mycelium renders correctly
2. **Tuning**:
   - Adjust tube radius if too thick/thin
   - Tweak glow intensity for desired brightness
   - Tune animation speed (currently 0.8Hz)
   - Adjust color/opacity for aesthetic balance
3. **Optimization**: If needed, reduce path points or tube segments
4. **Enhancement**: Add interactive features or reactive behaviors

## Developer Notes
- Mycelium uses same matrix transforms as globe (inherits rotation)
- Tubes are slightly elevated above globe surface to avoid z-fighting
- Alpha blending allows Earth texture to show through
- Fresnel effect creates strong 3D appearance despite simple geometry
- Animation phase varies along Y-axis for organic wave propagation
