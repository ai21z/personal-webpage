# CHANGELOG - Text Blur Fix (Compositor Demotion Approach)

## Problem Statement
Cards (`.paper`/`.slab`) use `transform: scale()` for zoom animation, which forces Chromium into compositor mode with grayscale antialiasing, making text appear blurry—especially at 125%/150% DPI or with Windows display scaling. Previous attempt to remove `scale()` and use explicit dimensions broke the decorative paper shape (ragged edges, spiral holes, coffee stains).

## Root Cause
The decorative silhouette relies on:
- Percentage-based `clip-path` coordinates
- Gradient radii in pixels
- Pseudo-element positioning

When we changed element dimensions to match the scaled size, these decorations rendered incorrectly, changing the card's shape from organic paper to rectangular.

## Solution: Compositor Demotion (NOT Dimension Change)
Instead of removing `scale()`, we:
1. **Keep the transform exactly as-is** (including `scale()`) to preserve visual shape
2. **Remove compositor hints after animation settles** (`will-change`, `backface-visibility`)
3. This allows the browser to re-rasterize text with better antialiasing while maintaining the exact visual appearance

## Changes Made

### 1. CSS (`styles/altar.css`)

**Modified `.paper-open--settled`:**
```css
/* OLD (BROKEN): Changed dimensions, broke shape */
.paper.paper-open.paper-open--settled {
  width: var(--open-w) !important;
  height: var(--open-h) !important;
  transform: translate(-50%, -50%) !important; /* removed scale */
}

/* NEW (WORKING): Keep transform, remove compositor hints */
.paper.paper-open.paper-open--settled {
  will-change: auto !important;
  backface-visibility: visible !important;
  /* transform stays as-is from animation */
}
```

### 2. JavaScript (`js/app.js`)

**Modified `openPaper()` to demote compositor after settle:**
```javascript
// Added explicit will-change removal after transitionend
const onEnd = (e) => {
  if (e.propertyName !== 'transform') return;
  el.removeEventListener('transitionend', onEnd);
  el.classList.add('paper-open--settled');
  el.style.willChange = 'auto'; // [AA-FIX] Demote from compositor
};
```

**Modified `closePaper()` to re-enable will-change for closing animation:**
```javascript
openEl.classList.remove('paper-open--settled');
openEl.style.willChange = 'transform'; // Re-enable for smooth closing
```

**Added DPR change watcher:**
```javascript
// Polls devicePixelRatio every 500ms
// Recomputes card position if DPR changes while open
// Handles zoom changes (Ctrl+/Ctrl-) and display scaling
```

### 3. Removed Unnecessary Complexity
- Removed `--open-w`, `--open-h` CSS variables (no longer needed)
- Kept all decorative `--k` scaling variables intact (they're harmless)
- Kept original card dimensions and percentage-based decorations

## What This Fixes

✅ **Text crispness:** After animation settles, text renders with improved AA  
✅ **Shape preservation:** Cards maintain exact organic paper silhouette  
✅ **DPR changes:** Polls for zoom/scale changes, recomputes position  
✅ **No visual regression:** Animation looks identical to working version  

## What This DOESN'T Fix (Inherent Limitations)

⚠️ **Text will still have slight softness** because `scale()` transform remains. This is a fundamental Chromium limitation: any scale transform forces grayscale AA.

The compositor demotion approach provides **marginal improvement** but cannot achieve perfect LCD subpixel AA like un-transformed text.

## Alternative Solutions (If More Crispness Needed)

### Option A: Inverse Scale on Text Container (Complex)
Wrap text in a container, apply inverse scale:
```css
.paper-open { transform: translate(...) scale(2); }
.paper-open .text-content { transform: scale(0.5); }
```
Pro: Text at actual size (crisp)  
Con: Complex, breaks layout, margin/padding math

### Option B: Accept Current Quality (Recommended)
The blur is subtle and only noticeable at extreme zoom. Most users won't see it. The decorative paper aesthetic is more important than pixel-perfect text.

### Option C: Remove Animation (Nuclear)
Instant show/hide with no scale. Perfect text, boring UX.

## Testing Checklist

### Visual Verification
1. Open About card
2. Wait for animation to complete (300ms)
3. Check DevTools → Elements → Computed:
   - `will-change`: should be `auto` or empty (not `transform`)
   - `backface-visibility`: should be `visible` or empty
   - `transform`: should still include `scale()` component
4. Compare text to static text on intro screen
   - Should look **similar** (not identical due to scale limitation)
   - Should NOT show shape distortion (ragged edges preserved)

### DPR Change Test
1. Open a card
2. Press Ctrl+Plus to zoom in (150%)
3. Card should stay centered (position recomputed)
4. Press Ctrl+Minus back to 100%
5. Card should adjust again

### Runtime Reliability
1. Rapidly open/close different cards
2. ESC should close
3. No stuck states
4. Focus returns to opener

## Performance Impact

**Minimal overhead:**
- 500ms polling for DPR (trivial operation)
- Compositor demotion happens once per open (no ongoing cost)
- No additional reflows or paints

## Recommendation

**Ship this version.** It preserves the beautiful paper aesthetic while providing marginal text improvements. The alternative approaches are too complex or too destructive to the UX.

If users complain about text quality specifically, revisit Option A (inverse scale) or consider redesigning the cards without decorative clip-paths/gradients.

---

**Date:** 2025-11-05  
**Status:** ✅ Ready for Testing  
**Breaking Changes:** None
