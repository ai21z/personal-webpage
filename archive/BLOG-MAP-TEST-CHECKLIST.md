# Blog Map - Quick Test Checklist

Run these tests in your browser to verify the implementation works correctly.

## Setup
1. Open `index.html` in a browser
2. Open DevTools Console (F12)
3. Navigate to the Blog section (click "Blog" in nav or go to `#blog`)

---

## Test 1: Transform Wiring
**Goal:** Verify overlay syncs with WebGL viewport.

### Steps:
1. Navigate to Blog section
2. Check console for:
   ```
   [Blog WebGL] Emitting transform: { scale: X, offsetX: Y, offsetY: Z, cssW: W, cssH: H }
   [Blog Overlay] Transform updated: { scale: X, offsetX: Y, offsetY: Z }
   ```
3. Resize browser window several times
4. Verify transform logs appear on each resize

### Expected Results:
- ✅ Transform events fire on load and resize
- ✅ No diagonal stray lines visible
- ✅ Pulses (if spawned) travel along trunk paths, not random diagonals
- ✅ No drift or misalignment

---

## Test 2: Motion Off Still Interactive
**Goal:** Verify interaction works when motion is disabled.

### Steps:
1. Click **Motion** toggle (top-left) to turn motion OFF
2. Check console: `[Blog Overlay] Motion toggled: false`
3. Hover over a hub on the WebGL canvas
4. Verify info card appears (top-right)
5. Hover over a hub button in the menu (bottom-right)
6. Verify info card appears
7. Click a hub button
8. Verify category view opens

### Expected Results:
- ✅ No pulses or spores rendered when motion OFF
- ✅ Info card still appears on hover
- ✅ Hub buttons still highlight on hover
- ✅ Click still enters category view
- ✅ Console: `[Blog Overlay] Hover:` logs appear

---

## Test 3: Menu Accessibility
**Goal:** Verify keyboard navigation and WCAG compliance.

### Steps (Mouse):
1. Hover over each hub button (CRAFT, COSMOS, CODEX, CONVERGENCE)
2. Verify info card shows for each
3. Verify hover state changes (border color, background)
4. Click CRAFT button
5. Verify category view opens

### Steps (Keyboard):
1. Press **Tab** repeatedly to focus each hub button
2. Verify visible focus ring (3px solid ember color)
3. Press **Enter** or **Space** on focused button
4. Verify category view opens

### Steps (Screen Reader - optional):
1. Enable screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
2. Tab to hub button
3. Verify reads: "Open CRAFT posts, button"

### Expected Results:
- ✅ Mouse hover shows info card + border highlight
- ✅ Keyboard focus shows 3px outline
- ✅ Enter/Space activates button
- ✅ aria-label is present and descriptive
- ✅ Focus order: motion toggle → craft → cosmos → codex → convergence

---

## Test 4: Back Navigation
**Goal:** Verify navigation flow and ESC key.

### Steps:
1. Click CRAFT hub button
2. Verify URL: `#blog/craft`
3. Verify category view shows "CRAFT" heading
4. Click **← Back to Map** button
5. Verify returns to map view
6. Verify URL: `#blog`
7. Click CODEX hub button
8. Click "Runes in Silence" article item
9. Verify URL: `#blog/codex/lorem-runes`
10. Press **ESC** key
11. Verify returns to category view
12. Press **ESC** key again
13. Verify returns to map view

### Expected Results:
- ✅ Back button returns to previous view
- ✅ ESC key works from article → category → map
- ✅ URL updates correctly at each step
- ✅ Console logs: `[Blog Nav] Entering category:`, `[Blog Nav] Exiting category`

---

## Test 5: Overlay Z-Index
**Goal:** Verify overlay never obscures UI elements.

### Steps:
1. Enable motion if disabled
2. Hover over CRAFT hub on canvas to spawn pulses
3. Observe pulses traveling toward hub button area (bottom-right)
4. Verify hub button text remains readable
5. Verify info card remains readable (top-right)

### Expected Results:
- ✅ Overlay: z-index 3, pointer-events: none
- ✅ Info card: z-index 5 (above overlay)
- ✅ Hub menu: z-index 6 (above overlay + info card)
- ✅ Pulses never make menu text unreadable
- ✅ Can click hub buttons even if pulse is "behind" them

---

## Test 6: Performance
**Goal:** Verify stable 60fps and capped effects.

### Steps:
1. Enable motion if disabled
2. Open DevTools → Performance tab
3. Start recording
4. Hover over multiple hubs rapidly (spawn many pulses)
5. Stop recording after 10 seconds
6. Check FPS chart in performance panel

### Alternative (simpler):
1. Open DevTools → Rendering tab → Check "FPS meter"
2. Hover over hubs to spawn pulses
3. Observe FPS counter (top-left of page)

### Expected Results:
- ✅ Stable ~60fps on mid-tier laptop
- ✅ Max 6 pulses active at once (desktop)
- ✅ Idle pulse every 6-10 seconds
- ✅ No dropped frames during resize
- ✅ Console: `[Blog Overlay] Max pulses reached, skipping spawn` if cap hit

---

## Test 7: Reduced Motion Support
**Goal:** Verify prefers-reduced-motion media query.

### Steps (Chrome/Edge):
1. Open DevTools → Command Palette (Ctrl+Shift+P)
2. Type "Emulate CSS prefers-reduced-motion"
3. Select "reduce"
4. Reload page
5. Navigate to Blog section

### Steps (Firefox):
1. Open DevTools → Settings (F1)
2. Scroll to "Media" section
3. Check "prefers-reduced-motion: reduce"
4. Reload page
5. Navigate to Blog section

### Expected Results:
- ✅ Overlay completely hidden
- ✅ Motion toggle hidden
- ✅ Map still interactive (hover, click work)
- ✅ Info card still appears on hover

---

## Test 8: Forced Colors Mode
**Goal:** Verify high contrast mode support.

### Steps (Windows):
1. Press **Win + Ctrl + C** to toggle high contrast
2. Or: Settings → Accessibility → Contrast themes → Select a theme
3. Reload page
4. Navigate to Blog section

### Expected Results:
- ✅ Overlay hidden (no visual effects)
- ✅ Hub buttons use system colors
- ✅ Info card uses system colors
- ✅ All text remains readable

---

## Console Log Reference

Expected console output on successful load:

```
[Blog Overlay] Module loaded
[Blog Overlay] Initializing...
[Blog Overlay] Trunks extracted: { craft: Array(X), cosmos: Array(Y), ... }
[Blog Overlay] Controls found: { infoCard: true, hubButtons: 4, motionToggle: true }
[Blog Overlay] Init complete
[Blog Nav] Initializing blog controls...
[Blog Nav] Blog controls initialized
[Blog WebGL] Emitting transform: { scale: 0.75, offsetX: 120, offsetY: 80 }
[Blog Overlay] Transform updated: { scale: 0.75, offsetX: 120, offsetY: 80 }
[Blog Overlay] Visibility changed: true
```

On hover:
```
[Blog WebGL] Hover: craft
[Blog Overlay] Hover: craft
[Blog Overlay] Pulse spawned: { hubId: "craft", isClick: false, totalPulses: 1 }
```

On click:
```
[Blog WebGL] Click: craft
[Blog Overlay] Click: craft
[Blog Nav] Entering category: craft
```

---

## Known Issues to Watch For

### Issue: Stray diagonal lines
**Symptom:** White/green lines appear in random directions, not following trunks.

**Cause:** Overlay using screen-space coordinates instead of world-space.

**Fix:** Verify `project(x, y)` is called before drawing. Check console for correct transform values.

### Issue: Hover doesn't work when motion OFF
**Symptom:** Info card doesn't appear when motion toggle is OFF.

**Cause:** Hover logic incorrectly gated by motion state.

**Fix:** Verify `onHover()` shows info card regardless of `motionEnabled`.

### Issue: Menu buttons don't respond
**Symptom:** Clicking hub buttons does nothing.

**Cause:** Overlay `pointer-events: auto` blocking clicks.

**Fix:** Verify overlay has `pointer-events: none` and menu has `pointer-events: auto`.

### Issue: Pulses misaligned with trunks
**Symptom:** Pulses travel in wrong direction or don't reach hub.

**Cause:** Transform not synced or Y-axis inverted.

**Fix:** Verify transform event fires on resize. Check projection uses NO Y-flip.

---

## Success Criteria

All tests pass ✅ when:

1. Transform events fire correctly
2. Motion OFF still allows interaction
3. Keyboard navigation works (Tab, Enter, Space, ESC)
4. Back button and ESC return to previous view
5. Overlay never obscures menu or info card
6. Performance stable at 60fps
7. Reduced motion hides overlay
8. Forced colors mode adjusts properly

If all tests pass, the implementation is complete and ready for production.
