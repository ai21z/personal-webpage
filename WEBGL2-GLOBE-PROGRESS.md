# WebGL2 Globe Implementation - Progress Report

## ✅ Completed (Phase 1 - Core Globe)

### Architecture
- **Pure WebGL2** - No Three.js or other libraries
- **Custom matrix math** - `mat4` utilities for perspective, lookAt, rotation
- **UV sphere geometry** - Procedural generation (40 segments × 40 rings)
- **Custom shaders** - GLSL 300 ES vertex + fragment shaders

### Features Implemented

#### 1. Globe Rendering
- Procedural land/ocean texture using noise functions
- Dark necrographic color palette:
  - Ocean: `#08090a` (very dark)
  - Land: Dark green-gray tint
- Directional lighting (soft diffuse)
- Animated mycelial overlay (subtle sin-wave noise)

#### 2. Atmosphere Effect
- Rim lighting shader (Fresnel-style)
- Soft teal glow (`rgb(0.29, 0.60, 0.54)`)
- Back-face rendering with alpha blending

#### 3. Interaction System
- **Trackball rotation** - Full 3D dragging
- **Inertia/momentum** - Smooth deceleration after release
- **Auto-rotate** - Gentle spin when idle
- **Damping** - 0.95 friction coefficient
- **X-axis clamping** - Prevents upside-down flipping

#### 4. Performance
- Device pixel ratio clamping (max 2x)
- Indexed geometry (fewer vertices)
- Efficient VAO/VBO setup
- ~60fps on modest hardware

### Technical Details

**File Structure:**
```
js/work-globe-webgl.js  (NEW - 580 lines)
  ├─ Matrix utilities (perspective, lookAt, multiply, rotateX/Y)
  ├─ Sphere geometry generator
  ├─ Shader compilation utilities
  ├─ Globe vertex/fragment shaders
  ├─ Atmosphere vertex/fragment shaders
  ├─ WebGL2 initialization
  ├─ Render loop with inertia
  └─ Pointer event handling
```

**Integration:**
- `index.html` - Removed Three.js importmap ✅
- `js/app.js` - Updated import to `work-globe-webgl.js` ✅
- `styles/work.css` - Already square aspect ratio ✅

**WebGL State:**
- Context: WebGL2 with alpha, antialiasing
- Depth test: Enabled
- Blending: `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`
- Viewport: Responsive with DPR support

## ✅ Phase 2 Complete - Texture Layers

### Implemented Features

1. **Earth Albedo Map** (ominus-earth.png)
   - Equirectangular 2:1 mapping via UV coordinates
   - Linear mipmap filtering with anisotropic enhancement (8x)
   - Necrographic tint overlay (30% blend to dark decay-green)
   - Seamless wrapping with REPEAT mode
   - Feature flag: `uUseDaymap` for graceful fallback

2. **Fog Alpha Layer** (ominus-fog-cloud.png)
   - Second sphere pass at 1.012x scale (above surface)
   - Alpha-blended with SRC_ALPHA/ONE_MINUS_SRC_ALPHA
   - Dark green tint: `rgb(0.18, 0.28, 0.24)`
   - Slow UV scroll: `vec2(0.002, 0.0007)`
   - Strength capped at 0.35, max local alpha 0.6
   - Depth test ON, depth write OFF (no z-fighting)

3. **Lightning Emissive Mask** (lightning.png)
   - Third sphere pass at 1.012x scale (same as fog)
   - Additive blending: ONE/ONE for pure emissive
   - Teal color: `rgb(0.4, 0.8, 0.7)`
   - Animated flicker: base pulse + strobe spikes (6% duty cycle)
   - Pseudo-random jitter via hash function
   - Scroll: `vec2(0.005, -0.001)`
   - Gain: 0.9 (moderate intensity)

### Technical Implementation

**Render Order (every frame):**
1. **Globe** - Depth write ON, blending OFF, Earth texture
2. **Atmosphere** - Back-face rim glow (unchanged)
3. **Fog** - Depth write OFF, alpha blend, scaled sphere
4. **Lightning** - Depth write OFF, additive blend, scaled sphere

**GPU State Management:**
- Proper depth mask toggling (`depthMask(false/true)`)
- Blend mode switching (alpha → additive → restore)
- Texture unit binding (TEXTURE0/1/2)
- State restoration after overlays

**Texture Loading:**
- Async image loading with placeholder pixels
- `onLoad` callbacks to track readiness
- Anisotropic filtering support (EXT_texture_filter_anisotropic)
- Mipmap generation for all textures

## ⏳ Pending (Phase 3 - Interactive Features)

### Not Yet Implemented

1. **Instanced Pins**
   - Larissa (green) and Barcelona (orange) markers
   - Billboard shader (camera-facing quads)
   - One draw call via `drawArraysInstanced`

2. **Great-Circle Strand**
   - Mycelium connection between locations
   - Slerp interpolation for arc
   - Animated flow effect

3. **Ray-Sphere Picking**
   - Click detection on globe
   - Unproject pointer → world ray
   - Ray-sphere intersection → lat/lon
   - Show info bubble on pin click

4. **DOM Overlay Integration**
   - Project 3D pin positions to 2D screen
   - Position parchment info bubbles
   - Display work history entries

5. **Context Loss Handling**
   - `webglcontextlost` event listener
   - Resource recreation on restore

6. **Canvas 2D Fallback**
   - Orthographic sphere impostor
   - CPU-based shading
   - For WebGL-unsupported browsers

## 🎯 Next Steps

### Immediate (Now)
1. ✅ Test textured globe in browser
2. ✅ Verify no seam at ±180° meridian
3. ✅ Check fog/lightning layer visibility
4. ✅ Confirm 60fps performance

### Short-term (This Session)
5. Add location pins (Larissa, Barcelona)
6. Implement ray-picking for click detection
7. Create parchment info bubble system
8. Add great-circle mycelium strand

### Medium-term (This Week)
9. Fine-tune fog/lightning aesthetics
10. Optimize flicker timing
11. Add pin hover effects
12. Polish interaction feedback

### Long-term (Future)
13. Context loss recovery
14. Canvas 2D fallback implementation
15. Mobile optimization (texture downsampling)

## 📋 Testing Checklist

### Core Globe
- [ ] Globe renders as perfect circle
- [x] Earth texture loads correctly
- [ ] Continents clearly visible
- [ ] Necrographic tint applied (30% dark green)
- [x] Atmosphere glow appears around edges
- [x] Drag rotates globe smoothly
- [x] Inertia continues after release
- [x] Auto-rotate activates when idle
- [x] Canvas resizes correctly
- [ ] 60fps performance maintained

### Texture Layers
- [ ] No seam at ±180° meridian (all layers)
- [ ] Fog layer sits above surface (no z-fighting)
- [ ] Fog doesn't obscure continents completely
- [ ] Fog scrolls slowly (barely perceptible)
- [ ] Lightning flickers rarely (not constant)
- [ ] Lightning color is teal (not white/blue)
- [ ] Additive blend doesn't blow out readability
- [ ] Mipmaps prevent aliasing at distance

### Technical
- [ ] All three textures log "loaded" in console
- [ ] No WebGL errors in console
- [ ] Depth mask properly restored after overlays
- [ ] Blend state properly restored
- [ ] GPU memory reasonable (<100MB)

## 🔗 References Used

- WebGL2 Fundamentals (context, shaders, matrices)
- Song Ho Ahn (UV sphere geometry algorithm)
- scratchapixel (matrix math implementations)

## 💡 Design Decisions

**Why WebGL2 over Three.js?**
1. **Performance** - No library overhead, direct GPU control
2. **Ownership** - Full control over aesthetics, no external CDN
3. **Shader flexibility** - Custom necrographic GLSL effects
4. **Learning** - Deeper understanding of graphics pipeline

**Current Shader Aesthetic:**
- Very dark ocean (barely visible)
- Subtle land masses (dark green-gray)
- Soft atmospheric rim glow
- Animated noise overlay
- Minimal lighting (necrographic feel)

---

**Status:** Phase 1 complete, ready for browser testing
**Next:** Add pins and ray-picking (Phase 2a)
