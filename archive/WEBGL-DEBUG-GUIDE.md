# WebGL2 Globe Debug Guide

## Current Status
The globe renders completely dark despite all systems reporting operational (textures load, no WebGL errors, render loop executing).

## Debug System Implemented

### 1. Comprehensive State Logging
When you reload the page, the console will now show a complete WebGL state diagnostic including:

- **Canvas/DOM**: Dimensions, CSS properties (display, opacity, visibility, z-index)
- **Draw Call Sanity**: Vertex count, current program validation
- **GL State Snapshot**: Viewport, depth test, culling, blending, color/depth write masks
- **Camera & Matrices**: Distance, rotation, near/far planes, model scale
- **Attribute Locations**: Position, normal, UV bindings (-1 = not found = BAD)
- **Sampler Bindings**: Active texture unit, bound textures, uniform values
- **Texture Details**: Min/mag filters, wrap modes, flip-Y status
- **Error Checking**: GL errors before and after draw

### 2. Debug Toggles (in `work-globe-webgl.js` lines 193-195)

```javascript
const DEBUG_DISABLE_FOG_LIGHTNING = true;  // Currently TRUE - testing globe alone
const DEBUG_DISABLE_CULLING = false;       // Set to true to test if culling is issue
const DEBUG_FORCE_SOLID_COLOR = false;     // Set to true to bypass textures
```

**To isolate the problem:**

1. **First reload**: Current state with fog/lightning disabled
   - If globe appears → fog/lightning was interfering with blend/depth state
   
2. **Set `DEBUG_DISABLE_CULLING = true`**: Disable face culling
   - If globe appears → winding order or front-face is wrong
   
3. **Set `DEBUG_FORCE_SOLID_COLOR = true`**: Bypass textures entirely
   - If globe appears → texture sampling or alpha channel is the issue

## Expected Console Output

```
[Work Globe] Initializing WebGL2...
[Work Globe] Debug flags: { Fog/Lightning disabled: true, ... }
[Work Globe] Initial GL state set: DEPTH_TEST=true, BLEND=true (will disable for globe base pass)
[Work Globe] Canvas resized: 876×876 (DPR: 1, buffer: 876×876)
[Work Globe] Starting texture loading...
[Work Globe] First render frame - globe should be visible
...
[Work Globe] ✅ All textures ready - Earth should be visible now
🔍 [Work Globe] FULL WEBGL STATE DIAGNOSTIC
  Canvas dimensions: 876 x 876
  Canvas CSS: { display: 'block', opacity: '1', ... }
  Sphere vertex count: 6240
  VIEWPORT: [0, 0, 876, 876]
  DEPTH_TEST: true
  CULL_FACE: false  ← Important!
  BLEND: false      ← Important! (should be false for globe base)
  ...
  Attribute locations: { aPosition: 0, aNormal: 1, aUv: 2 }  ← All should be >= 0
  ...
🎨 [Draw] gl.getError() after globe draw: NO_ERROR ✅
⚠️ [DEBUG] FOG/LIGHTNING/ATMOSPHERE DISABLED for isolation test
```

## What to Look For

### Critical Red Flags:

1. **BLEND: true** during globe base draw → Will make it transparent
2. **CULL_FACE: true** with wrong winding → Everything culled
3. **Attribute location: -1** → Shader not receiving geometry data
4. **TEXTURE_BINDING_2D on unit 0: null** → No texture bound
5. **Canvas CSS opacity: '0'** or **display: 'none'** → DOM issue
6. **Sphere vertex count: 0** → Geometry not generated

### Most Likely Causes (Based on Symptoms):

1. **Blend state left on**: Check if BLEND=true before globe draw
2. **Sampler/uniform mismatch**: uDaymap not pointing to right unit, or uUseDaymap=false
3. **Texture alpha channel**: PNG has alpha=0, making fragments transparent
4. **Culling issue**: Wrong front-face or negative model scale
5. **Depth issue**: Fog/lightning writing depth before globe (should be DISABLED now)

## Quick Tests to Run

### Test 1: Check Canvas Visibility
Open DevTools, inspect `#work-globe-canvas`, add in Styles:
```css
background: rgba(255, 0, 0, 0.2) !important;
```
If you see red tint → Canvas is visible, issue is WebGL
If you don't see red → Canvas is hidden by CSS/z-index

### Test 2: Force Culling Off
Change line 193: `DEBUG_DISABLE_CULLING = true`
Reload → If globe appears, culling is the problem

### Test 3: Force Solid Color
Change line 195: `DEBUG_FORCE_SOLID_COLOR = true`
Reload → If globe appears, texture sampling is the problem

### Test 4: Check Texture Content
In DevTools console, after page loads:
```javascript
// This will show if the texture image is actually bright or dark
const img = new Image();
img.onload = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(100, 100, 1, 1).data;
  console.log('Sample pixel from texture:', data); // [R, G, B, A]
};
img.src = './artifacts/work-page/ominus-earth.png';
```
If RGBA values are very low (< 20) → Texture image itself is black

## Shader Ultra-Debug Mode

The fragment shader currently has an early return with 5x brightness:
```glsl
if (uUseDaymap) {
  baseColor = texture(uDaymap, vUv).rgb;
  fragColor = vec4(baseColor * 5.0, 1.0); // 5x brightness boost!
  return; // Skip all other processing
}
```

This bypasses ALL lighting, tint, and effects. If still dark → source image is dark.

## Next Steps

1. **Reload the page** with current debug state (fog/lightning disabled)
2. **Copy the full console output** from the diagnostic group
3. **Share what you see visually** (still black? now visible? partially visible?)
4. **Try the quick tests** above one by one

The diagnostic output will tell us EXACTLY which category the problem is in:
- CSS/DOM issue
- GL state (blend/cull/depth)
- Texture sampling/binding
- Geometry/attributes
- Source image data

With the full diagnostic output, we can identify the single line that needs to be fixed.
