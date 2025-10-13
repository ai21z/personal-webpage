# Spark Effect Debugging Guide

## Issue
Lighting effects (sparks) on branches when hovering navigation labels are not showing.

## Root Cause Found
The event listeners for hover/focus were originally placed **inside** the `if (sporeCanvas && revealCanvas && !prefersReducedMotion)` conditional block. This meant:

1. If canvases weren't found at initialization time → no event listeners attached
2. If `prefers-reduced-motion` is enabled → no event listeners attached
3. Event listeners were set up BEFORE the DOM was ready → labels might not exist yet

## Fix Applied

### 1. Moved Event Listeners to DOMContentLoaded
Event listeners now attached AFTER:
- Mycelium network is loaded
- Navigation labels are created
- NAV_GROUPS is populated with rail data

**Before:**
```js
if (sporeCanvas && revealCanvas && !prefersReducedMotion) {
  // ... spark code ...
  
  // Event listeners HERE (might not work!)
  document.addEventListener('pointerover', ...)
}
```

**After:**
```js
window.addEventListener('DOMContentLoaded', async () => {
  await loadMycelium();
  layoutNavNodes();
  
  // Event listeners HERE (guaranteed to work!)
  document.addEventListener('pointerover', (e)=>{
    const a = e.target.closest('.network-node-label');
    if (!a || !a.dataset.node) return;
    if (typeof setActive === 'function') {
      setActive(a.dataset.node);
    }
  });
});
```

### 2. Added Safety Checks
- Check if label has `dataset.node` before accessing
- Check if `setActive` function exists before calling
- Use passive listeners for better performance

## How to Verify Fix

### 1. Open Browser Console (F12)
Check for errors:
```
❌ Uncaught TypeError: Cannot read property 'rail' of undefined
❌ setActive is not a function
❌ NAV_GROUPS is not defined
```

If you see these, the fix didn't load yet.

### 2. Check if Canvases Exist
In console:
```js
document.getElementById('spore-canvas')  // Should return <canvas>
document.getElementById('reveal-canvas') // Should return <canvas>
```

If `null`, check HTML - canvases might be missing.

### 3. Check if NAV_GROUPS Has Data
In console:
```js
NAV_GROUPS.size  // Should be 4 (intro, about, projects, blog)
NAV_GROUPS.get('intro')  // Should show {section, j, rail, path2d, x, y}
```

If empty, mycelium data didn't load or rails weren't built.

### 4. Check if Event Listener Works
In console:
```js
// Hover over a label, then check:
ACTIVE_SPARK_SECTION  // Should show 'intro', 'about', 'projects', or 'blog'
SPARKS.get('intro')   // Should show array of spark objects
```

### 5. Manually Trigger Spark
In console:
```js
// Force spawn sparks for testing:
if (typeof setActive === 'function') {
  setActive('intro');
}
```

You should see sparks traveling along the branch from the intro junction.

## Common Issues & Solutions

### Issue: "setActive is not a function"
**Cause:** Canvas block didn't execute (missing canvases or reduced motion enabled)

**Solution:** Check:
```js
// In console:
prefersReducedMotion  // Should be false for sparks to work
```

If true, disable "Reduce Motion" in OS settings:
- **Windows:** Settings → Accessibility → Visual effects → Animation effects
- **Mac:** System Preferences → Accessibility → Display → Reduce motion
- **Linux:** Varies by DE

### Issue: "Cannot read property 'rail' of undefined"
**Cause:** NAV_GROUPS doesn't have data for the hovered section

**Solution:** Check if `layoutNavNodes()` ran successfully:
```js
// In console:
NAV_GROUPS.keys()  // Should show: intro, about, projects, blog
```

If empty, check if `network.json` loaded:
```js
MYC_MAP  // Should show {width, height, paths, junctions, strategic, root}
```

### Issue: Sparks spawn but don't move
**Cause:** Rail has no length or rendering loop not running

**Check:**
```js
// In console:
NAV_GROUPS.get('intro').rail.total  // Should be > 0 (rail length in px)
```

If 0, the rail wasn't built correctly. Check if paths exist:
```js
MYC_MAP.paths.length  // Should be > 1000
```

### Issue: Sparks spawn but invisible
**Cause:** Canvas rendering issue or z-index stacking

**Check:**
1. Canvas z-index:
```css
#reveal-canvas { z-index: 4; }  /* Should be above background */
```

2. Canvas size:
```js
// In console:
revealCanvas.width  // Should match window.innerWidth
revealCanvas.height // Should match window.innerHeight
```

3. Manually draw test circle:
```js
const ctx = document.getElementById('reveal-canvas').getContext('2d');
ctx.fillStyle = 'lime';
ctx.fillRect(100, 100, 50, 50);  // Should see green square
```

## Testing Steps

1. **Hard refresh** (Ctrl+Shift+R / Cmd+Shift+R)
2. **Open console** and check for errors
3. **Hover over "intro" label** (top-right)
4. **Should see:**
   - Label color changes to necrotic green
   - Small glow appears around hit area
   - 1-2 small sparks travel along the branch
   - Faint reference line highlights the rail

5. **If nothing happens:**
   - Check console for errors
   - Run verification commands above
   - Check if `prefers-reduced-motion` is enabled

## Expected Behavior

**On hover/focus:**
1. Label text color: bone → necrotic green
2. Hit area glow: subtle spectral/necrotic rings appear
3. Reference stroke: faint necrotic line along rail (8% opacity)
4. Sparks: 1-2 bright particles travel from junction outward
   - Core: 3-6px bright center with pulse
   - Trail: 50px spectral blue gradient behind
   - Speed: ~140-220 px/s (feels organic)
   - Lifetime: 1.2-2 seconds

**Visual appearance:**
- Sparks stay ON the branch (rail-bound)
- No area flooding or bleaching
- Subtle, elegant particle movement
- Auto-respawn while hovering (1.5% chance per frame)

## Still Not Working?

If sparks still don't appear after the fix:

1. **Regenerate network:**
```bash
cd scripts
python generate_network.py
```

2. **Check if artifacts exist:**
```bash
ls artifacts/
# Should see: bg_base.png, bg_glow.png, network.json
```

3. **Verify network.json has strategic nodes:**
```bash
cat artifacts/network.json | grep strategic
# Should see: "strategic": { "intro": {...}, "about": {...}, ... }
```

4. **Check browser compatibility:**
   - Canvas 2D API support
   - Path2D support
   - Screen blend mode support

5. **Try different browser** (Chrome, Firefox, Safari)

## Debug Logging

Add to script.js for detailed debugging:
```js
// Inside setActiveSparkSection:
console.log('🎯 Setting active spark section:', sectionId);
console.log('📊 NAV_GROUPS has data:', NAV_GROUPS.get(sectionId));

// Inside spawnSparksFor:
console.log('✨ Spawning', count, 'sparks for', sectionId);

// Inside renderSparks:
console.log('🎨 Rendering', sparks.length, 'sparks for', ACTIVE_SPARK_SECTION);
```

Then hover labels and watch console for output.
