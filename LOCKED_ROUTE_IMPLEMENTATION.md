# [LOCKED-ROUTE] Implementation Summary

## Problem Fixed
- **Branch hopping**: Labels were using nearest-node queries every frame, causing visual "snaps" when nearby branches got marginally closer
- **Incorrect coordinates**: Nav anchors were using old values instead of the design spec

## Solution: Single-Branch Locked Routes

### Core Changes

1. **Updated NAV_COORDS** (lines ~191-201)
   - Fixed to match design spec: intro at (1632,162), about at (1412,184), etc.
   - These are now only used for initial route selection, not runtime positioning

2. **Replaced moving label system** with locked routes (lines ~210-218)
   ```js
   const LOCKED_ROUTES = {}; // id -> {imgPts, projPts, cum, len, s, dir, speed}
   const LABEL_SPEEDS = { about:65, work:70, projects:75, ... };
   ```

3. **Route Selection Algorithm** (`lockNavRoutes()`, lines ~987-1081)
   - For each label, finds ONE polyline from `MYC_MAP.paths`
   - Selection criteria:
     * Closest point must be within 32px of anchor
     * If multiple candidates, picks polyline with tangent best aligned toward canvas center
     * Fallback: globally closest polyline if none within 32px
   - **Never re-snaps** after initial selection
   - Logs selection: `[LOCKED-ROUTE] ${id}: locked to polyline, len=XXX.Xpx`

4. **Polyline Resampling** (`resamplePolyline()`, lines ~913-946)
   - Resamples to uniform 10px spacing in image space
   - Preserves exact endpoints
   - Ensures smooth, stable motion

5. **Label Motion** (`updateMovingLabels()`, lines ~1163-1223)
   - Advances `s` (arc-length position) along locked route at 55-85 px/sec
   - Bounces at [24px, len-24px] to stay off endpoints
   - Computes screen-space normal for 12px outward offset
   - **PRM: freezes motion** when `prefers-reduced-motion` is enabled
   - Position set with `transform: translate(-50%, -50%)` only

6. **Ritual Sparks** (`ritualCatchUp()`, lines ~1259-1276)
   - Gets current image-space position of each moving label
   - Routes spark from intro to that exact point using A* on graph
   - Staggered delays: 60-100ms between labels
   - Falls back gracefully if no graph node found (logs warning once)

7. **Resize Handling** (lines ~753-774)
   - Reprojects `projPts/cum/len` from unchanging `imgPts`
   - Preserves `s` as ratio of total length
   - Labels maintain relative position on their branch

8. **HUD Diagnostics** (`renderHUD()`, lines ~376-457)
   - White: design anchor (static reference)
   - Cyan polyline: locked route the label travels on
   - Green: live label position
   - Logs warning if label drifts >8px from its route (should never happen)

### Key Features

✅ **No branch hopping**: Each label locked to single polyline at init
✅ **Smooth motion**: Uniform resampling + bounded bounce motion
✅ **Ritual sparks**: Light travels to current position, not fixed anchor
✅ **Resize stable**: Labels maintain position along same branch
✅ **PRM compliant**: Motion freezes with `prefers-reduced-motion`
✅ **Debug support**: HUD shows locked routes with `?hud` query param

### Testing Checklist

- [ ] Let page idle 30s: no label jumps between branches
- [ ] Click sigil: sparks travel to current label positions
- [ ] Resize window: labels stay on their locked routes
- [ ] Enable `?hud`: cyan routes visible, green stays on route (<8px)
- [ ] Enable reduced motion: labels freeze at initial position
- [ ] Console: no warnings about missing graph nodes or route drift

### Files Modified

- `script.js`: Complete locked-route system implementation
  - Updated NAV_COORDS to design spec
  - Replaced PATH_CACHE_FULL/LABEL_STATE with LOCKED_ROUTES
  - New functions: resamplePolyline, projectOntoPolyline, lockNavRoutes, pointAtRoute, imgPointAtRoute, updateMovingLabels, startSparkToPoint, ritualCatchUp
  - Updated: initNetworkAndNav, resizeAll, renderHUD

### Performance Notes

- Route locking happens once at init (O(n*m) where n=labels, m=polylines)
- Runtime motion is O(log n) per label per frame for binary search
- No nearest-node queries during motion (only for ritual sparks)
- 7 moving labels @ 60fps = negligible overhead

### Accessibility

- `prefers-reduced-motion`: Labels freeze at initial position, ritual uses highlight classes
- All keyboard navigation and focus states preserved
- Screen reader announcements unchanged
