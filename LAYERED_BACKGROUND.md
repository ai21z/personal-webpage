# Layered Background System

## Architecture

The mycelium network uses a **three-layer system** where the front layer is static and serves as the coordinate truth for all overlay elements (navigation dots, reveal sparks).

### Layer Stack (back to front)

1. **`#bg-deep`** (z-index: 0)
   - Slowest parallax motion + organic swell
   - Low opacity (0.18), heavy blur (1px)
   - 50s parallax cycle, 14s breathing cycle

2. **`#bg-mid`** (z-index: 1)
   - Moderate parallax + swell
   - Low opacity (0.22), medium blur (0.5px)
   - 30s parallax cycle, 11s breathing cycle
   - Blend mode: lighten

3. **`#bg-front`** (z-index: 2) ⭐ **STATIC TRUTH LAYER**
   - **NO transform or animation**
   - Higher opacity (0.42), crisp (no blur)
   - All navigation coordinates reference this layer
   - Blend mode: lighten

4. **`#spore-canvas`** (z-index: 3)
   - Ambient animated spores

5. **`#reveal-canvas`** (z-index: 4)
   - Interactive "current" spark effect

6. **`#network-nav`** (z-index: 5)
   - Navigation dot buttons

## Coordinate System

### Core Principle
**Front layer = coordinate truth**. Since `#bg-front` never transforms, we can use simple linear mapping:

```javascript
function toViewportFront([mapX, mapY]) {
  return [
    mapX * cover.s + cover.dx,
    mapY * cover.s + cover.dy
  ];
}
```

### Cover Computation
Read the front layer's rendered rect (which naturally implements `object-fit: cover`):

```javascript
function computeCoverFromFront() {
  const rect = frontEl.getBoundingClientRect();
  const s = rect.width / MAP_WIDTH;
  cover = {
    s: s,           // Scale factor
    dx: rect.left,  // X offset
    dy: rect.top,   // Y offset
    w: rect.width,  // Rendered width
    h: rect.height  // Rendered height
  };
}
```

## Motion & Breathing

### Parallax
Back layers move in different directions at different speeds to create depth:
- **Deep**: Slow circular motion (-1.2% to +1.0% translate)
- **Mid**: Moderate opposing motion (+1.2% to -0.9% translate)

### Organic Swell
Simulates mycelium growth/shrink via:
- Subtle scale changes (1.00 → 1.02)
- Contrast breathing (1.05 → 1.12)
- Brightness pulsing (0.72 → 0.76)

Combined with parallax on separate timings, this creates a biological "breathing" effect without complex shaders.

## Accessibility

### Prefers Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  #bg-deep, #bg-mid {
    animation: none !important;
    transform: none !important;
  }
}
```
- Back layers become static
- Front layer (already static) unaffected
- Navigation alignment remains perfect

## Alignment Guarantees

✅ **Nav dots stay on junctions** - front layer never moves  
✅ **Reveal sparks follow paths** - mapped to front layer coords  
✅ **Zoom/DPR stable** - linear transform scales predictably  
✅ **Resize re-locks** - recompute cover from front layer rect  
✅ **No transform tracking needed** - front is static reference frame  

## Performance

- **Back layer animations**: GPU-accelerated (transform3d + will-change)
- **Cover computation**: Only on resize (~150ms debounce)
- **Nav updates**: Only on resize (no per-frame tracking needed)
- **Reveal drawing**: Standard 2D canvas (60fps with 4-5 paths)

## Testing Alignment

### Visual Debug
```javascript
// Add crosshairs at strategic junction positions
MYC_MAP.strategic.forEach(node => {
  const [x, y] = toViewportFront([node.x, node.y]);
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
});
```

### Drift Test
1. Let animation run for 60 seconds
2. Hover each nav node
3. Verify reveal effect stays on correct branches
4. Check: no lateral drift, dots stay centered on junctions

### Zoom Test
- 100%, 125%, 150% browser zoom
- DPR 1.0, 1.5, 2.0
- Should maintain sub-pixel alignment

## Files Modified

- **`index.html`**: Added layer structure (`#bg` → `#bg-deep`, `#bg-mid`, `#bg-front`)
- **`styles.css`**: Parallax animations, swell effects, layer stacking, PRM rules
- **`script.js`**: `computeCoverFromFront()`, `toViewportFront()`, updated resize handlers

---

**Key Insight**: By keeping the front layer static, we eliminate all transform tracking complexity. The back layers move independently for visual depth, but alignment logic is trivially simple.
