# WebGL Petri Dish Fix - CHANGELOG

**Date:** November 2, 2025  
**Branch:** blog-graphics-newIdeas6trunks  
**Scope:** Critical fixes for centering, DPR correctness, and clipping

---

## Summary

Fixed major visual and technical issues in the blog Petri dish WebGL renderer:
1. **Auto-centering** replaces hardcoded bias
2. **DPR-correct shader math** fixes Retina fuzz/mismatch
3. **Single source of truth** for dish radius (PETRI_K constant)
4. **Node clipping** extends to all geometry types
5. **Cleanup** of legacy uniforms and dead code

---

## A) Centering Fix

### Problem
- Network had hardcoded `shift = [-40, 18]` causing off-center appearance
- Centroid did not match dish center on different data sets

### Solution
- **Added `computeNetworkCentroid(paths)`** helper function
  - Computes AABB bounds from all path points
  - Returns geometric center `[netCx, netCy]`
- **Auto-computed shift** at load time:
  ```js
  const shift = AUTO_CENTER 
    ? [VIEW.W * 0.5 - netCx, VIEW.H * 0.5 - netCy]
    : FIXED_SHIFT;
  ```
- **Config flags** added:
  - `AUTO_CENTER = true` (default, uses computed shift)
  - `FIXED_SHIFT = [0, 0]` (debugging override)

### Files Changed
- `blog-network-webgl.js` lines 8-11 (config)
- `blog-network-webgl.js` lines 35-50 (helper function)
- `blog-network-webgl.js` lines 895-910 (shift computation)

---

## B) DPR Correctness Fix

### Problem
- Shaders mixed CSS pixels with buffer pixels
- `gl_FragCoord.xy` is in buffer pixels, but dish center/radius were sometimes CSS
- Retina displays (DPR=2) showed fuzzy edges or clip mismatches

### Solution
- **Added `uniform float uDpr`** to all fragment shaders:
  - `FS_SEG` (segments)
  - `FS_CYST` (cysts)
  - `FS_NODE` (nodes)
- **Updated `petriClip()` function** to convert buffer→CSS correctly:
  ```glsl
  void petriClip() {
    vec2 pCss = gl_FragCoord.xy / uDpr;  // buffer px → CSS px
    pCss.y = uRes.y - pCss.y;            // GL bottom-left → CSS top-left
    float d = distance(pCss, uDishCenterPx);
    if (d > uDishRadiusPx) discard;
  }
  ```
- **Set `uDpr` in render loop** for all programs:
  ```js
  gl.uniform1f(gl.getUniformLocation(prog,'uDpr'), DPR);
  ```

### Files Changed
- `blog-network-webgl.js` lines 139-151 (FS_SEG shader)
- `blog-network-webgl.js` lines 289-300 (FS_CYST shader)
- `blog-network-webgl.js` lines 356-368 (FS_NODE shader)
- `blog-network-webgl.js` lines 1147, 1227, 1245 (uniform sets in render loop)

---

## C) Dish Constant Unification

### Problem
- Dish radius computed in multiple places with magic number `0.42`
- SVG dish and WebGL uniforms could drift apart

### Solution
- **Exported `PETRI_K = 0.42`** constant at top of file
- **Used in `buildDish()`**:
  ```js
  const r = Math.floor(Math.min(wCss,hCss) * PETRI_K);
  ```
- **Updated `updateDishUniforms()`** to pass CSS pixels directly:
  - Changed from buffer pixels with Y-flip to pure CSS pixels
  - Shaders now handle DPR conversion internally
- **Removed legacy uniforms**:
  - Deleted all writes to `uPetriCenter` and `uPetriRadius` (old naming)
  - Only `uDishCenterPx`, `uDishRadiusPx`, `uDpr` remain

### Files Changed
- `blog-network-webgl.js` line 8 (PETRI_K export)
- `blog-network-webgl.js` line 725 (buildDish uses PETRI_K)
- `blog-network-webgl.js` lines 753-774 (updateDishUniforms rewrite)
- `blog-network-webgl.js` lines 1146, 1243, 1254, 1268 (removed legacy uniform sets)

---

## D) Node Clipping Added

### Problem
- `FS_NODE` had no dish clipping
- Node dots could render outside Petri dish bounds

### Solution
- **Added `petriClip()` to `FS_NODE`** (same pattern as FS_SEG/FS_CYST)
- **Called at start of `main()`** for early discard
- **Updated `updateDishUniforms()`** to set uniforms for `progNode`:
  ```js
  for (const prog of [progSeg, progCyst, progNode]) {
    // ... set uDishCenterPx, uDishRadiusPx, uDpr
  }
  ```

### Files Changed
- `blog-network-webgl.js` lines 352-368 (FS_NODE shader with petriClip)
- `blog-network-webgl.js` lines 761-765 (updateDishUniforms loop includes progNode)

---

## E) Cleanup & Correctness

### Removed
- **Legacy uniform writes:**
  - `uPetriCenter` (replaced by `uDishCenterPx`)
  - `uPetriRadius` (replaced by `uDishRadiusPx`)
- **Inline dish computation in render loop** (now done once in `updateDishUniforms()`)

### Improved
- **Console logging** for auto-centering shows:
  - Network centroid position
  - Computed shift
  - Offset percentage relative to view size
- **Comment clarity** for coordinate systems (CSS vs buffer px, Y-axis orientation)

### Files Changed
- `blog-network-webgl.js` lines 1146-1148 (removed legacy uniforms from SEGMENTS section)
- `blog-network-webgl.js` lines 1241-1243 (removed legacy uniforms from CYSTS section)
- `blog-network-webgl.js` lines 1265-1268 (removed legacy uniforms from hover halo)

---

## Testing Checklist

### Visual
- [x] Network centroid within 1% of dish center (console log verification)
- [ ] Glass rim and shader clip perfectly aligned (no halos/mismatches)
- [ ] No geometry outside dish at any pan/zoom level

### DPR
- [ ] Test on DPR=1 display (standard monitor)
- [ ] Test on DPR≈2 display (Retina/HiDPI)
- [ ] Edge thickness consistent across displays

### Performance
- [ ] ≥60fps with current segment count
- [ ] No console errors or warnings
- [ ] Interactions (hover, zoom, pan) unchanged

---

## Config Flags

### `AUTO_CENTER` (line 9)
- **Default:** `true`
- **Purpose:** Auto-compute shift from data bounds
- **Override:** Set to `false` and use `FIXED_SHIFT` for debugging

### `FIXED_SHIFT` (line 10)
- **Default:** `[0, 0]`
- **Purpose:** Manual shift override when `AUTO_CENTER=false`
- **Use case:** Testing with known offsets

### `PETRI_K` (line 8)
- **Default:** `0.42`
- **Purpose:** Dish radius = `PETRI_K * min(cssW, cssH)`
- **Note:** Used by both SVG builder and WebGL uniforms

---

## Backward Compatibility

- **Shader uniforms renamed** (breaking):
  - `uPetriCenter` → `uDishCenterPx`
  - `uPetriRadius` → `uDishRadiusPx`
- **No data format changes**
- **No API changes** for external callers

---

## Known Limitations

- **Shift computed once at load:** If data changes dynamically, re-run centering logic
- **DPR assumes static:** If user changes zoom/display scaling mid-session, reload needed
- **No zoom bounds checking:** Extreme zoom-out may show dish edge artifacts

---

## Next Steps

1. **Manual visual verification** on multiple displays
2. **Automated screenshot tests** (if CI available)
3. **Performance profiling** at 8k segments (stress test)
4. **Document acceptance test results** in DEV_NOTES

---

**Commit Message:**
```
fix(blog-webgl): auto-centering, DPR-correct clipping, unified dish constant

- Add computeNetworkCentroid() for auto-centering (removes hardcoded shift)
- Add uDpr uniform to all shaders for buffer→CSS pixel conversion
- Export PETRI_K=0.42 constant for SVG/WebGL consistency
- Extend petriClip() to FS_NODE (now all geometry clipped)
- Remove legacy uPetriCenter/uPetriRadius uniforms
- Update updateDishUniforms() to set for progSeg/progCyst/progNode

Fixes: off-center network, Retina fuzz, edge mismatches, node overflow
Tests: auto-center logs, DPR verification pending
```
