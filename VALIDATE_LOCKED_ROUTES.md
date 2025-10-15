# Validation Checklist for Locked Routes Fix

## Quick Console Tests

Paste these into the browser console after the page loads:

```js
// 1. Check all labels have locked routes
console.log('Locked routes:', Object.keys(LOCKED_ROUTES));
// Expected: ['about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills']

// 2. Check route lengths (should all be > 80px after windowing)
Object.entries(LOCKED_ROUTES).forEach(([id, route]) => {
  console.log(`${id}: len=${route.len.toFixed(1)}px, s=${route.s.toFixed(1)}px`);
});
// Expected: All len > 80px

// 3. Verify moving labels list
console.log('Moving labels:', MOVING_LABELS);
// Expected: ['about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills']

// 4. Check speeds are defined
console.log('Speeds:', LABEL_SPEEDS);
// Expected: All 7 labels with speeds 62-80

// 5. Watch motion for 5 seconds
let prevS = {};
MOVING_LABELS.forEach(id => prevS[id] = LOCKED_ROUTES[id]?.s);
setTimeout(() => {
  MOVING_LABELS.forEach(id => {
    const route = LOCKED_ROUTES[id];
    if (!route) return;
    const delta = Math.abs(route.s - prevS[id]);
    console.log(`${id} moved: ${delta.toFixed(1)}px (${delta > 1 ? '✓' : '✗ STUCK'})`);
  });
}, 5000);
```

## Visual Tests

### 1. All Labels Moving (30 seconds)
- **Test**: Let page idle for 30 seconds
- **Expected**: All 7 labels (about, work, projects, contact, blog, resume, skills) should be visibly moving along their branches
- **✗ Fail if**: Any label appears frozen or snaps/jumps between branches

### 2. Short Rail Labels (about, work, projects, contact)
- **Test**: Focus specifically on the 4 near-hub labels
- **Expected**: They should move smoothly within their windowed segments
- **✗ Fail if**: They're stuck at their anchors or show no motion

### 3. Ritual Sparks
- **Test**: Click the sigil (intro)
- **Expected**: Sparks should race from intro and stop at the **current positions** of all 7 moving labels (not their anchors)
- **✗ Fail if**: Sparks go to fixed anchor positions or miss any labels

### 4. Resize Stability
- **Test**: Resize browser window (drag corner or toggle DevTools)
- **Expected**: Labels stay on their locked routes, maintain relative positions
- **✗ Fail if**: Labels jump to different branches or positions reset

### 5. HUD Diagnostics (add `?hud` to URL)
- **Test**: Open page with `?hud` query parameter
- **Expected**: 
  - White dots: design anchors
  - Cyan polylines: locked routes for all 7 labels
  - Green dots: live label positions **on** the cyan routes
- **✗ Fail if**: 
  - Missing cyan routes for any label
  - Green dots drift >8px from cyan routes
  - Console shows drift warnings

### 6. Reduced Motion
- **Test**: Enable "Reduce motion" in OS accessibility settings or browser
- **Expected**: Labels freeze at their initial positions, ritual uses highlight classes
- **✗ Fail if**: Labels still move or page becomes unresponsive

## Expected Console Output on Load

```
[LOCKED-ROUTE] about: locked to polyline, len=XXX.Xpx, s=YY.Ypx
[LOCKED-ROUTE] work: locked to polyline, len=XXX.Xpx, s=YY.Ypx
[LOCKED-ROUTE] projects: locked to polyline, len=XXX.Xpx, s=YY.Ypx
[LOCKED-ROUTE] contact: locked to polyline, len=XXX.Xpx, s=YY.Ypx
[LOCKED-ROUTE] blog: locked to polyline, len=XXX.Xpx, s=YY.Ypx
[LOCKED-ROUTE] resume: locked to polyline, len=XXX.Xpx, s=YY.Ypx
[LOCKED-ROUTE] skills: locked to polyline, len=XXX.Xpx, s=YY.Ypx
```

All `len` values should be **> 80px** (windowed segments guarantee this).

## Common Issues & Fixes

### Issue: Some labels missing from LOCKED_ROUTES
**Cause**: `lockNavRoutes()` not iterating `MOVING_LABELS`
**Fix**: Already fixed - now uses `for (const id of MOVING_LABELS)`

### Issue: Labels stuck at anchors (len < 48px)
**Cause**: Routes too short, no travel window
**Fix**: Already fixed - windowing adds ±140px around anchor + adaptive margins

### Issue: Labels snap/jump between frames
**Cause**: Re-querying nearest nodes at runtime
**Fix**: Already fixed - routes locked at init, never change `imgPts`

### Issue: Ritual sparks go to anchors not current positions
**Cause**: Using NAV_COORDS instead of route.s
**Fix**: Already fixed - `imgPointAtRoute(route, route.s)` gets current position

## Performance Metrics

With HUD enabled, check the console for:
- No drift warnings (labels should stay <8px from their routes)
- Smooth 60fps motion (use browser Performance tab)
- No memory leaks after 5 minutes (Routes should not grow)

## Success Criteria

✅ All 7 labels have locked routes with len > 80px
✅ All labels visibly moving smoothly (no jumps/snaps)
✅ Ritual sparks chase current positions
✅ Resize maintains route stability
✅ HUD shows cyan routes with green labels on them
✅ PRM freezes motion gracefully
✅ No console errors or drift warnings
