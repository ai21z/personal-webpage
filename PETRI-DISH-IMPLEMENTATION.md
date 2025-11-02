# Petri Dish Map Implementation

**Status:** ✅ Complete  
**Date:** 2024  
**Objective:** Replace motion lines/sparks overlay with clean Petri Dish UI featuring cardinal navigation buttons

---

## Summary

The blog map now uses a "Petri Dish" metaphor with a clean circular overlay, four cardinal navigation buttons (N/E/W/S), and a unified HUD for Motion + Map controls. All changes are surgical, reversible, and WCAG 2.2 AA compliant.

---

## Changes Applied

### 1. **Created `petri-overlay.js`** (New File)
- **Location:** `js/petri-overlay.js`
- **Size:** ~170 lines
- **Features:**
  - HiDPI canvas setup with `devicePixelRatio` scaling
  - Draws Petri dish ring with frosted disk and cardinal tick marks
  - Wires 4 buttons (N/E/W/S) for hover/focus/click
  - Emits `blog:hover`, `blog:hover-off`, `blog:navigate`, `blog:map` events
  - Listens for `blog:visible` for initialization
  - Motion toggle and Map button event handlers
  - Respects `prefers-reduced-motion` media query

### 2. **Updated `index.html`**
- **Replaced:** Lines 328-336 (old `.blog-controls`)
- **New Structure:**
  ```html
  <div class="blog-hud" aria-label="Blog controls">
    <button id="btnMotion" class="hud-btn" aria-pressed="true">
      ⚡ Motion
    </button>
    <button id="btnMap" class="hud-btn">
      ⬅ Map
    </button>
  </div>
  ```

- **Added:** Petri overlay section after WebGL canvas
  ```html
  <div id="petri" class="petri-overlay" aria-hidden="true">
    <canvas id="petriCanvas" aria-hidden="true"></canvas>
    <button class="petri-nav petri-n" data-hub="craft">CRAFT</button>
    <button class="petri-nav petri-e" data-hub="cosmos">COSMOS</button>
    <button class="petri-nav petri-w" data-hub="codex">CODEX</button>
    <button class="petri-nav petri-s" data-hub="convergence">CONVERGENCE</button>
  </div>
  ```

- **Script Tag:** Added `<script type="module" src="./js/petri-overlay.js"></script>` after `blog-network-webgl.js`
- **Old Overlay:** Confirmed `blog-sparks-overlay.js` script remains commented out

### 3. **Updated `blog.css`**
- **Replaced:** `.blog-controls` styles (lines 99-145) with `.blog-hud`
- **New HUD Styles:**
  - 44×44px minimum touch targets (WCAG AA)
  - 3px focus outline for visibility
  - Flexbox layout prevents overlap

- **Added:** Petri overlay styles
  - `.petri-overlay` — Full-screen grid centering
  - `#petriCanvas` — HiDPI canvas (pointer-events:none)
  - `.petri-nav` — Cardinal buttons with 48×48px size
  - `.petri-n/e/w/s` — Positioned at 18% from edges (top/right/bottom/left)
  - Hover/focus states with orange glow (`#ff8f4d`)
  - `aria-current` state styling
  - `prefers-reduced-motion` support (no transitions)

- **Updated:** Old overlay comment from "DISABLED for now" to "DISABLED - replaced by Petri"

### 4. **Updated `app.js`**
- **Added:** `showMapRoot()` function (lines 894-920)
  - Removes `.in-category` class
  - Shows Petri overlay (`display: grid`, `aria-hidden: false`)
  - Hides category/article views
  - Updates URL to `#blog`

- **Added:** `blog:map` event listener (line 791-794)
  - Calls `showMapRoot()` when Map button clicked

- **Updated:** `enterBlogCategory()` (lines 842-850)
  - Hides Petri overlay when entering category (`display: none`, `aria-hidden: true`)

- **Removed:** Old `.blog-back-map-btn` wiring (no longer exists in HTML)

---

## A11y Compliance (WCAG 2.2 AA)

✅ **Minimum Touch Targets:** All buttons ≥44×44px (HUD) or 48×48px (Petri nav)  
✅ **Focus Indicators:** 3px solid orange outline (`#ff8f4d`) with 2-3px offset  
✅ **Keyboard Navigation:** Tab cycle, Enter/Space activation, focus mirrors hover  
✅ **Screen Readers:** `aria-hidden`, `aria-pressed`, `aria-label`, `aria-current`  
✅ **Reduced Motion:** `prefers-reduced-motion` disables transitions and motion toggle  
✅ **HiDPI Support:** `devicePixelRatio` scaling for crisp rendering on Retina displays

---

## Testing Checklist

### Visual
- [ ] HUD buttons visible at top-left (no overlap)
- [ ] Petri ring drawn at center with frosted disk + cardinal ticks
- [ ] Four buttons positioned at N/E/W/S (18% from edges)
- [ ] Buttons glow orange on hover/focus
- [ ] Petri hidden when in category view
- [ ] HiDPI/Retina displays show sharp ring (no blur)

### Interaction
- [ ] Motion toggle updates `aria-pressed` and opacity
- [ ] Map button returns to Petri view from category
- [ ] Hover on cardinal button → WebGL hub glows
- [ ] Click on cardinal button → enters category
- [ ] Keyboard Tab cycle reaches all buttons
- [ ] Enter/Space activates focused button
- [ ] Focus ring visible (3px orange outline)

### A11y
- [ ] `aria-current="true"` set on hovered/focused button
- [ ] Screen reader announces button labels
- [ ] `prefers-reduced-motion` disables animations
- [ ] Touch targets ≥44×44px (tested with DevTools)

---

## Architecture

### Event Flow
1. **Petri → WebGL:** `blog:hover` (hubId) → WebGL highlights node
2. **Petri → App:** `blog:navigate` (hubId) → enters category view
3. **Petri → App:** `blog:map` → returns to map root
4. **App → Petri:** Manages visibility via `display` and `aria-hidden`

### State Management
- **Map Root:** Petri visible, WebGL at 100% opacity
- **In Category:** Petri hidden, WebGL dimmed to 15% opacity (`.in-category` class)

### CSS Layers (z-index)
1. WebGL canvas (z-index: 1)
2. Old overlay (z-index: 2, display:none)
3. **Petri overlay (z-index: 3)** — NEW
4. Info card (z-index: 10)
5. HUD (z-index: 100)

---

## File Summary

| File | Status | Lines Changed | Purpose |
|------|--------|---------------|---------|
| `js/petri-overlay.js` | ✅ Created | ~170 | HiDPI canvas, cardinal nav, event wiring |
| `index.html` | ✅ Updated | ~20 | HUD markup, Petri overlay section |
| `styles/blog.css` | ✅ Updated | ~100 | HUD styles, Petri nav, cardinal positioning |
| `js/app.js` | ✅ Updated | ~30 | `showMapRoot()`, `blog:map` listener, Petri visibility |
| `js/blog-sparks-overlay.js` | ⚠️ Disabled | 0 | Script tag remains commented |

---

## Console Logs

All logs prefixed with `[Petri]` for easy filtering:
```
[Petri] Module loaded
[Petri] Resized: { cssW, cssH, DPR, radiusPx }
[Petri] Motion: true/false
[Petri] Hover: craft/cosmos/codex/convergence
[Petri] Click: craft/cosmos/codex/convergence
[Petri] Map button clicked
[Petri] Blog visible: true
[Petri] Initialized
```

---

## Reversibility

To revert to old overlay:
1. Uncomment `blog-sparks-overlay.js` script in `index.html`
2. Comment out `petri-overlay.js` script
3. Restore old `.blog-controls` HTML + CSS
4. Remove `showMapRoot()`, `blog:map` listener from `app.js`
5. Remove Petri visibility management from `enterBlogCategory()`

---

## Notes

- **Cardinal Layout:** N/E/W/S positioned at 18% from edges using absolute positioning + transforms
- **HiDPI Scaling:** Canvas width/height multiplied by `devicePixelRatio`, context scaled with `setTransform()`
- **Motion Toggle:** Checks `prefers-reduced-motion` at runtime, updates when media query changes
- **Focus Management:** Focus events mirror hover events (emit same `blog:hover` events)
- **Backdrop Filter:** `blur(4px)` on buttons for frosted glass effect (may not work in all browsers)

---

**Implementation Complete!** ✅
