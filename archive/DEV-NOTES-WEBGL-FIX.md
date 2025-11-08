# DEV NOTES - WebGL Petri Dish Fixes

**Last Updated:** November 2, 2025  
**Author:** Senior WebGL Engineer  
**Purpose:** Developer guidance for testing, debugging, and understanding the fix

---

## Quick Reference

### File Locations
- **Main renderer:** `js/blog-network-webgl.js`
- **Changelog:** `CHANGELOG-WEBGL-FIX.md`
- **Data source:** `artifacts/blog_network.json`

### Key Constants
```js
PETRI_K = 0.42       // Dish radius factor
AUTO_CENTER = true   // Enable auto-centering
FIXED_SHIFT = [0,0]  // Debug override
DPR = devicePixelRatio || 1
VIEW = {W:1920, H:1080}  // Design space
```

---

## How to Toggle AUTO_CENTER

### Enable Auto-Centering (Default)
```js
// Line 9 in blog-network-webgl.js
export const AUTO_CENTER = true;
export const FIXED_SHIFT = [0, 0];  // Ignored when AUTO_CENTER=true
```

### Disable for Manual Testing
```js
export const AUTO_CENTER = false;
export const FIXED_SHIFT = [-40, 18];  // Old hardcoded values
```

### Verify in Console
After page load, check console for:
```
[Blog WebGL] Auto-centering: {
  enabled: true,
  networkCentroid: [960.5, 540.2],
  shift: [-0.5, -0.2],
  targetCenter: [960, 540],
  offsetPercent: ["0.03%", "0.02%"]
}
```

**✅ Good:** Offset percentages < 1%  
**❌ Bad:** Offset percentages > 3% (investigate data bounds)

---

## How to Verify DPR Behavior

### On Different Displays

#### 1. Standard Display (DPR=1)
- Open DevTools Console
- Check: `window.devicePixelRatio` → should be `1`
- Look for uniform log:
  ```
  [Blog WebGL] Dish uniforms (CSS px): {cxCss: 960, cyCss: 540, rCss: 403, dpr: 1}
  ```

#### 2. Retina Display (DPR=2)
- Same console checks
- Should see `dpr: 2`
- **Visual test:** Edge sharpness should match non-Retina

#### 3. Force DPR Override (Testing)
```js
// Add to top of blog-network-webgl.js (temporary)
const DPR = 2.0;  // Force Retina simulation
```

### Shader Verification
Shaders now handle DPR internally. To verify:

1. **Check `petriClip()` in all shaders:**
   ```glsl
   vec2 pCss = gl_FragCoord.xy / uDpr;  // Must divide by DPR
   ```

2. **Check uniform sets in render loop:**
   ```js
   gl.uniform1f(gl.getUniformLocation(prog,'uDpr'), DPR);
   ```

3. **Console errors to watch for:**
   - `"uniform uDpr not found"` → shader not updated
   - `"INVALID_OPERATION"` → wrong uniform type

---

## Running Acceptance Tests

### A) Centering Test (Automated)

**Verify network centroid is within 1% of dish center:**

```js
// Add to console after page load:
const cssW = document.getElementById('blog-network-canvas').clientWidth;
const cssH = document.getElementById('blog-network-canvas').clientHeight;
const dishCenterX = cssW / 2;
const dishCenterY = cssH / 2;
const threshold = Math.min(cssW, cssH) * 0.01;  // 1% tolerance

// Check shift log in console:
// If offsetPercent < 1% for both X and Y → PASS
```

**Expected Output:**
```
✅ PASS: Centering test
Network offset: 0.03% x 0.02%
Threshold: 1.00%
```

### B) Dish Match Test (Manual)

**Check glass rim and shader clip alignment:**

1. Open page in browser
2. Look at Petri dish edge
3. **Check for:**
   - ❌ Halo around rim (shader clips too early)
   - ❌ Network bleeds outside glass (shader clips too late)
   - ✅ Perfect alignment (segments touch rim cleanly)

4. **Zoom in to dish edge** (use browser zoom or mouse wheel if implemented)
5. **Pan around dish perimeter**
6. **Verify no geometry escapes**

### C) Clipping Test (Manual)

**Ensure all geometry types are clipped:**

1. **Segments:** Should stop cleanly at dish edge
2. **Nodes:** Junction dots should clip (not visible outside)
3. **Cysts:** Glowing spores should clip

**Test procedure:**
```
1. Hover over each hub near dish edge
2. Pan to bring edge nodes into view
3. Zoom to dish boundary
4. Look for any stray pixels outside glass rim
```

### D) DPR Test (Manual)

**Test on multiple displays:**

| Display Type | DPR | Edge Quality | Pass? |
|--------------|-----|--------------|-------|
| Desktop 1080p | 1.0 | Sharp, 1px edges | ✅ |
| MacBook Retina | 2.0 | Sharp, no fuzz | ⏳ |
| 4K Monitor | 1.5 | Sharp, scaled | ⏳ |

**What to check:**
- Edge thickness consistent across displays
- No "fattening" on Retina (would indicate missing /uDpr)
- No "thinning" on standard (would indicate double /uDpr)

### E) Performance Test

**Measure frame rate:**

```js
// Add to console:
let frameCount = 0;
let lastTime = performance.now();
setInterval(() => {
  const now = performance.now();
  const fps = frameCount / ((now - lastTime) / 1000);
  console.log(`FPS: ${fps.toFixed(1)}`);
  frameCount = 0;
  lastTime = now;
}, 1000);
// In render loop, add: frameCount++;
```

**Targets:**
- ≥60fps @ 6k segments (current data)
- ≥30fps @ 12k segments (stress test, if data available)
- No dropped frames during hover/pan/zoom

---

## Debugging Common Issues

### Issue: Network still off-center

**Symptoms:**
- Offset percentages > 5%
- Network visibly biased to one side

**Checks:**
1. Verify `AUTO_CENTER = true`
2. Check console log for computed shift
3. Inspect data bounds:
   ```js
   // In console after load:
   const paths = await fetch('./artifacts/blog_network.json').then(r=>r.json()).then(d=>d.paths);
   const xs = paths.flat().map(([x])=>x);
   const ys = paths.flat().map(([,y])=>y);
   console.log({
     minX: Math.min(...xs), maxX: Math.max(...xs),
     minY: Math.min(...ys), maxY: Math.max(...ys)
   });
   ```

**Fix:**
- If data bounds are asymmetric, shift is working correctly
- If shift looks wrong, check `computeNetworkCentroid()` logic

### Issue: Fuzzy edges on Retina

**Symptoms:**
- Edges look thicker/blurrier on DPR=2 displays
- Mismatch between SVG rim and WebGL clip

**Checks:**
1. `uDpr` uniform set in render loop? (search for `gl.uniform1f(...,'uDpr')`)
2. `petriClip()` divides by `uDpr`? (check shader source)
3. Dish uniforms use CSS pixels? (check `updateDishUniforms()` comments)

**Fix:**
```glsl
// In petriClip(), must have:
vec2 pCss = gl_FragCoord.xy / uDpr;  // ← Division is critical
```

### Issue: Nodes not clipped

**Symptoms:**
- Node dots visible outside dish rim
- Only segments/cysts clipped properly

**Checks:**
1. `FS_NODE` has `petriClip()` function? (line ~360)
2. `petriClip()` called in `main()`? (line ~375)
3. `updateDishUniforms()` includes `progNode`? (line ~761)

**Fix:**
```js
// In updateDishUniforms():
for (const prog of [progSeg, progCyst, progNode]) {  // ← progNode must be in list
```

### Issue: Console errors about uniforms

**Symptoms:**
```
WebGL: INVALID_OPERATION: uniformXf: no program
WebGL: uniform 'uPetriCenter' not found
```

**Checks:**
1. Old uniform names removed from render loop?
2. `gl.useProgram(prog)` called before `gl.uniform*()`?
3. Shader compiled successfully? (check for GLSL syntax errors)

**Fix:**
- Search codebase for `uPetriCenter` and `uPetriRadius` → delete all writes
- Only use `uDishCenterPx`, `uDishRadiusPx`, `uDpr`

---

## Performance Profiling

### Chrome DevTools Method

1. Open DevTools → Performance tab
2. Click Record
3. Interact with Petri dish (hover, pan, zoom)
4. Stop recording after 5 seconds
5. Look for:
   - **Main thread:** Should be mostly idle (<20% usage)
   - **GPU process:** Canvas rendering should be consistent (~16ms frames)
   - **Long tasks:** Red flags if >50ms

### Manual FPS Counter

```js
// Add to loop() function in blog-network-webgl.js:
let fpsLog = [];
let fpsLogStart = performance.now();

function loop(now) {
  // ... existing code ...
  
  fpsLog.push(now);
  if (now - fpsLogStart > 1000) {
    const fps = fpsLog.length;
    if (fps < 55) console.warn(`[Perf] FPS dropped to ${fps}`);
    fpsLog = [];
    fpsLogStart = now;
  }
  
  requestAnimationFrame(loop);
}
```

---

## PETRI_K Tuning Guide

The `PETRI_K` constant controls how much of the viewport the dish occupies.

### Current Value
```js
export const PETRI_K = 0.42;  // 42% of smaller viewport dimension
```

### Effect of Changes

| PETRI_K | Dish Size | Visual Effect |
|---------|-----------|---------------|
| 0.35 | Small | More margin, feels cramped |
| 0.42 | **Current** | Balanced, breathing room |
| 0.48 | Large | Edge-to-edge, immersive |
| 0.50 | Maximum | Touches viewport edges |

**To change:**
1. Edit line 8 in `blog-network-webgl.js`
2. Reload page (no rebuild needed)
3. Check that SVG rim and WebGL clip still match

**Note:** If PETRI_K changes, all parts update automatically (SVG dish, WebGL uniforms, label arcs).

---

## Coordinate System Reference

### Three Coordinate Spaces

1. **Network Data (JSON):**
   - Origin: Top-left `(0,0)`
   - Y-axis: Down ↓
   - Range: `0..1920 x 0..1080` (design space)

2. **CSS Pixels (viewport):**
   - Origin: Top-left `(0,0)`
   - Y-axis: Down ↓
   - Range: Actual browser window size

3. **WebGL Buffer Pixels (gl_FragCoord):**
   - Origin: Bottom-left `(0,0)`
   - Y-axis: Up ↑
   - Range: `canvas.width x canvas.height` (buffer size = CSS × DPR)

### Conversion Examples

```js
// Network → CSS
const cssPx = networkPx * scale + offset;  // scale/offset from resize()

// CSS → Buffer
const bufferPx = cssPx * DPR;

// gl_FragCoord → CSS (in shader)
vec2 pCss = gl_FragCoord.xy / uDpr;  // Buffer → CSS
pCss.y = uRes.y - pCss.y;            // Flip Y (GL bottom-left → CSS top-left)
```

---

## Testing Scenarios

### Scenario 1: Initial Load
1. Open page fresh
2. Check console for auto-centering log
3. Verify offset% < 1%
4. Visual: network centered in dish

### Scenario 2: Window Resize
1. Load page
2. Resize browser window (drag corner)
3. Check that dish re-renders (console log "Built Petri dish")
4. Network stays centered

### Scenario 3: Zoom/Pan (if implemented)
1. Zoom in on dish edge
2. Pan to move network around
3. Verify clip boundary moves with dish
4. No geometry escapes at any zoom level

### Scenario 4: Multi-Display
1. Load on standard monitor
2. Drag window to Retina display
3. Reload page (DPR changes on reload)
4. Edge quality should match original display

---

## Rollback Plan

If issues arise after deployment:

1. **Quick revert:**
   ```js
   export const AUTO_CENTER = false;
   export const FIXED_SHIFT = [-40, 18];  // Old values
   ```

2. **Full rollback:**
   ```bash
   git revert <commit-hash>
   git push
   ```

3. **Shader-only rollback:**
   - Remove `uDpr` uniforms
   - Restore old `petriClip()` without `/uDpr`
   - Undo `updateDishUniforms()` changes

---

## Future Improvements

### Potential Enhancements
1. **Dynamic DPR handling:** Listen for `window.matchMedia('(resolution: ${dpr}dppx)')` changes
2. **Zoom bounds:** Clamp user zoom to prevent extreme scales
3. **Automated screenshot tests:** Compare renders at different DPRs
4. **PETRI_K animation:** Smooth dish resize on viewport changes

### Known Bugs to Track
- [ ] Hover halo may clip aggressively at dish edge (minor visual)
- [ ] Extreme zoom-out (>3x) may show dish edge aliasing
- [ ] No test coverage for mobile devices (DPR often non-integer)

---

## Contact / Questions

For issues or questions about this fix:
1. Check console logs first (most issues self-diagnose)
2. Review shader source in `blog-network-webgl.js` lines 108-400
3. Verify config flags at top of file (lines 8-11)
4. File issue with console output + screenshot

**Key files to attach:**
- Browser DevTools console output
- Screenshot of visual issue
- `window.devicePixelRatio` value
- Canvas size (`canvas.width x canvas.height` vs `canvas.clientWidth x canvas.clientHeight`)

---

**End of DEV NOTES**
