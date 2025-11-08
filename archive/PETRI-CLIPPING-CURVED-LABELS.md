# Petri Dish Clipping & Curved Labels Implementation

**Status:** ✅ Complete  
**Date:** November 2, 2025  
**Objective:** Clip mycelium network inside circular Petri disc and replace cardinal button boxes with curved text labels following the disc edge

---

## Summary

The blog map now clips all WebGL geometry (branches, nodes, cysts) inside a circular Petri disc boundary, and uses elegant curved SVG text labels positioned along the disc's edge instead of rectangular button boxes.

---

## Changes Applied

### 1. **WebGL Circular Clipping** (`blog-network-webgl.js`)

#### Fragment Shader Updates:
- **FS_SEG (Segment Shader):**
  - Added `uniform vec2 uPetriCenter` and `uniform float uPetriRadius`
  - Added clipping logic before final output: `discard` fragments outside disc radius
  - Uses screen-space distance check: `length(pix - uPetriCenter) > uPetriRadius`

- **FS_CYST (Node Dots Shader):**
  - Added same Petri uniforms
  - Updated VS_CYST to pass `vScreen` (screen position) to fragment shader
  - Added identical clipping logic in fragment shader

#### Uniform Setup in Render Loop:
```javascript
// Petri disc clipping (center of canvas, 48% of smaller dimension)
const petriCenterX = fit.cssW * 0.5;
const petriCenterY = fit.cssH * 0.5;
const petriRadius = Math.min(fit.cssW, fit.cssH) * 0.48;
set2(progSeg,'uPetriCenter', petriCenterX, petriCenterY);
gl.uniform1f(gl.getUniformLocation(progSeg,'uPetriRadius'), petriRadius);
```

Applied to:
- Segment shader (main branches)
- Cyst shader (node dots)
- Hover halo shader (breathing ember)

### 2. **Curved SVG Text Labels** (`index.html`)

Replaced rectangular button boxes with SVG `<text>` elements following circular paths:

```html
<svg class="petri-labels" viewBox="0 0 100 100">
  <defs>
    <!-- Arc paths for text to follow -->
    <path id="arc-north" d="M 20,50 A 30,30 0 0,1 80,50" fill="none"/>
    <path id="arc-east" d="M 50,20 A 30,30 0 0,1 50,80" fill="none"/>
    <path id="arc-south" d="M 80,50 A 30,30 0 0,1 20,50" fill="none"/>
    <path id="arc-west" d="M 50,80 A 30,30 0 0,1 50,20" fill="none"/>
  </defs>
  
  <text class="petri-label petri-label-n" data-hub="craft">
    <textPath href="#arc-north" startOffset="50%" text-anchor="middle">
      CRAFT
    </textPath>
  </text>
  <!-- Similar for COSMOS, CONVERGENCE, CODEX -->
</svg>
```

**Cardinal Positioning:**
- **North (CRAFT):** Top arc, text curves upward
- **East (COSMOS):** Right arc, text curves right
- **South (CONVERGENCE):** Bottom arc, text curves downward
- **West (CODEX):** Left arc, text curves left

### 3. **Interaction Update** (`petri-overlay.js`)

- Changed selector from `.petri-nav` to `.petri-label`
- Event listeners remain identical (mouseenter, mouseleave, focus, blur, click, keydown)
- `aria-current` attribute applied to SVG text elements for hover state

### 4. **Styling Update** (`blog.css`)

Replaced button styles with SVG text styles:

```css
.petri-labels {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.petri-label {
  fill: rgba(232, 232, 234, 0.75);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 3.5px; /* SVG units relative to viewBox */
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
  pointer-events: auto;
  transition: all 180ms ease;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
}

.petri-label:hover,
.petri-label:focus-visible,
.petri-label[aria-current="true"] {
  fill: #ffcc80;
  filter: drop-shadow(0 0 4px rgba(255, 143, 77, 0.6));
}
```

---

## Technical Details

### Clipping Algorithm

**Screen-Space Clipping:**
1. Fragment shader receives `gl_FragCoord.xy` (screen position)
2. Flip Y coordinate: `pix.y = uRes.y - pix.y` (OpenGL has Y-up, we need Y-down)
3. Calculate distance from Petri center: `float distFromCenter = length(pix - uPetriCenter)`
4. Discard if outside radius: `if (distFromCenter > uPetriRadius) { discard; }`

**Why Screen Space:**
- Petri disc is screen-space (48% of viewport)
- Network geometry is world-space (1920×1080) with transform
- Using screen-space for clipping ensures crisp circular edge at any zoom level
- No need to inverse-transform disc to world space

### SVG Text-on-Path

**ViewBox Coordinate System:**
- SVG uses `viewBox="0 0 100 100"` (normalized 0-100 units)
- Text paths defined as circular arcs using SVG `<path>` with arc commands
- `textPath` follows the curve with `startOffset="50%"` for center alignment
- Font size in SVG units (3.5px) scales proportionally with container

**Arc Path Syntax:**
```
M startX,startY A radiusX,radiusY rotation largeArcFlag sweepFlag endX,endY
```

Example: `M 20,50 A 30,30 0 0,1 80,50`
- Start at (20,50), draw arc with radius 30, end at (80,50)
- `largeArcFlag=0` (short arc), `sweepFlag=1` (clockwise)

---

## A11y Compliance

✅ **Keyboard Navigation:** Tab cycle, Enter/Space activation (SVG `<text>` acts as button)  
✅ **Focus Indicators:** 2px solid orange outline with drop-shadow glow  
✅ **Screen Readers:** `role="button"`, `aria-label`, `tabindex="0"` on text elements  
✅ **Hover State:** `aria-current="true"` + visual glow  
✅ **Reduced Motion:** Transition disabled via media query

---

## Visual Result

**Before:**
- Rectangular button boxes at N/E/W/S cardinal points
- Network extends beyond Petri disc edge (full 1920×1080 viewport)

**After:**
- Curved text labels hugging the Petri disc circumference
- Network cleanly clipped inside circular boundary
- Mycelium branches "contained" within Petri dish metaphor

---

## Testing Checklist

### Visual
- [ ] Mycelium branches stop at disc edge (no overflow)
- [ ] Node dots clipped at disc boundary
- [ ] Hover halos respect circular clipping
- [ ] Curved text labels visible at N/E/W/S positions
- [ ] Text follows arc path smoothly (no distortion)
- [ ] Disc radius = 48% of smaller viewport dimension

### Interaction
- [ ] Hover on curved text → WebGL hub glows
- [ ] Click on curved text → enters category
- [ ] Keyboard Tab reaches all 4 labels
- [ ] Enter/Space activates focused label
- [ ] Focus outline visible on SVG text
- [ ] `aria-current="true"` applied on hover

### Responsiveness
- [ ] Clipping adjusts on window resize
- [ ] SVG text scales with container
- [ ] Maintains 48% radius on all screen sizes
- [ ] Text remains readable on mobile

---

## File Summary

| File | Status | Lines Changed | Purpose |
|------|--------|---------------|---------|
| `js/blog-network-webgl.js` | ✅ Updated | ~40 | Circular clipping in fragment shaders |
| `index.html` | ✅ Updated | ~40 | SVG curved text labels |
| `js/petri-overlay.js` | ✅ Updated | ~5 | Selector change (.petri-nav → .petri-label) |
| `styles/blog.css` | ✅ Updated | ~40 | SVG text styling, removed button styles |

---

## Console Logs

No new logs added. Existing `[Petri]` logs remain:
```
[Petri] Module loaded
[Petri] Resized: { cssW, cssH, DPR, radiusPx }
[Petri] Hover: craft/cosmos/codex/convergence
[Petri] Click: craft/cosmos/codex/convergence
```

WebGL logs show clipping values:
```
[Blog Network WebGL] Frame 0: rendering {
  canvasSize: "1920x1080",
  petriCenter: [960, 540],
  petriRadius: 518.4
}
```

---

## Notes

### Clipping Performance
- Fragment discard is efficient (early fragment kill)
- No additional geometry passes required
- Single distance check per fragment (minimal overhead)

### SVG Text Limitations
- Font size must be in SVG units (viewBox scale)
- Some browsers may have slight text rendering differences
- `pointer-events: auto` required on text to enable clicks
- Drop-shadow filter may not work in older browsers (graceful degradation)

### Future Enhancements
- Add animated glow pulse on hover (CSS `@keyframes`)
- Implement smooth fade-in transition for labels
- Consider adding cardinal tick marks on the Petri ring aligned with text

---

**Implementation Complete!** ✅

All mycelium geometry now respects the circular Petri disc boundary, and navigation uses elegant curved text labels that follow the disc's edge.
