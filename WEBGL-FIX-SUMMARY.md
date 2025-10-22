# WebGL2 Globe - Problem Solved! 🎉

## Issue Summary
The globe was rendering completely black despite all systems (texture loading, uniforms, render loop) reporting success.

## Root Cause
**WebGL state pollution between render passes**. Specifically:

1. **Atmosphere pass was missing blend state setup** - It rendered with undefined blend state from previous frame
2. **Blend state was enabled globally** at initialization (line 678) but not consistently managed across passes
3. **On subsequent frames**, after fog/lightning/atmosphere layers ran, blend remained enabled, causing the next frame's globe base pass to render incorrectly

### The Smoking Gun
When fog/lightning/atmosphere layers were disabled via debug toggle, the globe immediately became visible. This proved the overlay passes were interfering with the base globe's rendering.

## The Fix

### 1. Added Explicit State Management to Atmosphere Pass
```javascript
// Before (missing blend setup):
gl.useProgram(atmosphereProgram);
gl.cullFace(gl.FRONT);
gl.enable(gl.CULL_FACE);

// After (proper state):
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.depthMask(false); // Don't write depth for atmosphere glow
gl.useProgram(atmosphereProgram);
gl.cullFace(gl.FRONT);
gl.enable(gl.CULL_FACE);
```

### 2. Improved State Restoration at End of Render
```javascript
// Before (incomplete):
gl.depthMask(true);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.bindVertexArray(null);

// After (complete reset):
gl.depthMask(true);
gl.disable(gl.BLEND);  // ← Critical! Disable blend for next frame
gl.bindVertexArray(null);
```

### 3. Globe Base Pass Already Had Correct State
The globe base pass was correctly disabling blend:
```javascript
gl.depthMask(true);
gl.disable(gl.BLEND);  // ← This was always correct
```

But on frame N+1, if frame N left blend enabled, this `disable` would execute but then atmosphere/fog/lightning would enable it again, and it wouldn't be disabled for frame N+2's globe base.

## Why The Diagnostic Helped

By adding `DEBUG_DISABLE_FOG_LIGHTNING = true`, we:
1. **Skipped atmosphere, fog, and lightning passes entirely**
2. This prevented blend state from being enabled after the globe base
3. Next frame's globe base started with blend disabled
4. **Globe became visible immediately**

This proved the problem wasn't:
- ❌ Texture loading (textures loaded successfully)
- ❌ Uniform binding (all uniforms set correctly)
- ❌ Shader code (shader was fine)
- ❌ Geometry (sphere generated correctly)
- ❌ Camera/matrices (positioning was correct)

But WAS:
- ✅ **State management between passes**

## Code Changes Made

### File: `js/work-globe-webgl.js`

**Lines 193-195**: Added debug toggles
```javascript
const DEBUG_DISABLE_FOG_LIGHTNING = false; // Now false - re-enabled with fix
const DEBUG_DISABLE_CULLING = false;
const DEBUG_FORCE_SOLID_COLOR = false;
```

**Lines 906-925**: Fixed atmosphere pass state
```javascript
// Added explicit blend/depth state before atmosphere draw
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.depthMask(false);
```

**Lines 1020-1027**: Fixed state restoration
```javascript
// Changed from incomplete restoration to full reset
gl.depthMask(true);
gl.disable(gl.BLEND);  // ← Added this critical line
gl.bindVertexArray(null);
```

**Lines 230-275**: Cleaned up shader (removed debug code)
- Removed ultra-brightness multiplier (`color *= 3.0`)
- Removed early return bypass
- Removed black texture detection
- Kept proper necrographic tint (15% blend)

## Render Order (Now Correct)

Each frame:
1. **Clear** → Set clear color, clear depth/color buffers
2. **Globe Base** → Depth write ON, blend OFF, Earth texture
3. **Atmosphere** → Depth write OFF, blend ON (alpha), back-face culling
4. **Fog Layer** → Depth write OFF, blend ON (alpha), scaled 1.012x
5. **Lightning Layer** → Depth write OFF, blend ON (additive), scaled 1.012x
6. **State Restore** → Reset depth write, disable blend ← **This was the missing link**

## Visual Result

✅ Globe now renders with:
- Earth texture visible (continents and oceans)
- Subtle green necrographic tint (15%)
- Directional lighting
- Animated mycelium noise overlay
- Green atmospheric glow (rim lighting)
- Fog layer (when ready)
- Lightning layer (when ready)

## Lessons Learned

### WebGL State is Sticky
Unlike immediate-mode graphics, WebGL state persists across draw calls and frames. Every enable/disable, every blend function, every depth mask setting **sticks** until explicitly changed.

### Always Restore State
When rendering multiple passes:
1. Set required state for each pass explicitly
2. Don't rely on "default" or previous state
3. Restore to known-good state after complex passes
4. Document state requirements in comments

### Isolation Testing Works
The debug toggle system proved invaluable:
- Isolated the problem in minutes
- Confirmed which subsystem was failing
- Enabled incremental re-enabling of features

### Best Practices for Multi-Pass Rendering

```javascript
// Pattern for each pass:

// 1. Set ALL required state explicitly
gl.depthMask(true/false);
gl.enable/disable(gl.BLEND);
gl.blendFunc(...);
gl.enable/disable(gl.CULL_FACE);
// ... etc

// 2. Bind program and resources
gl.useProgram(program);
gl.bindVertexArray(vao);
// ... bind textures, set uniforms

// 3. Draw
gl.drawElements(...);

// 4. At end of ALL passes, restore to safe defaults
gl.depthMask(true);
gl.disable(gl.BLEND);
gl.disable(gl.CULL_FACE);
gl.bindVertexArray(null);
```

## Next Steps

Now that the globe is rendering correctly:
1. ✅ Base globe with texture - **WORKING**
2. ✅ Atmosphere glow - **WORKING** (state fixed)
3. ✅ Fog layer - **READY** (re-enabled)
4. ✅ Lightning layer - **READY** (re-enabled)
5. ⏳ Add location pins (Larissa green, Barcelona orange)
6. ⏳ Implement ray-sphere picking for clicks
7. ⏳ Create info bubble DOM overlay
8. ⏳ Add great-circle mycelium strand between pins

## Debug System Status

The comprehensive diagnostic system is still active (will log once on first render with textures). Can be removed or reduced once testing is complete.

Debug toggles remain available at top of file for future troubleshooting:
- `DEBUG_DISABLE_FOG_LIGHTNING` - Test globe alone
- `DEBUG_DISABLE_CULLING` - Test without face culling
- `DEBUG_FORCE_SOLID_COLOR` - Test without textures

---

**Status**: ✅ **RESOLVED** - Globe renders correctly with all layers enabled and proper state management.
