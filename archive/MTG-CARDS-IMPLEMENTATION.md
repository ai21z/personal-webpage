# MTG-STYLE CARDS IMPLEMENTATION - COMPLETE REWRITE

## 🎯 Objective
Transform Projects section from bare jar specimens to **Magic: The Gathering-inspired project cards** with:
- Consistent design language (reuses altar ring system)
- MTG-style card structure (header, art, textbox, tech badges)
- Necrography/mycelium aesthetic
- Portal-to-body magnification pattern

---

## ✅ What Was Done

### 1. **Lessons Learned from Previous Implementation**
**Previous Mistakes (Avoided):**
- ❌ Ignored existing patterns → ✅ **Copied exact ring SVG from altar sections**
- ❌ Wrong stacking context → ✅ **Panel appended to body from the start**
- ❌ CSS/JS conflicts → ✅ **Used `--card-x/y` custom properties consistently**
- ❌ Missing DOM elements → ✅ **Created all elements upfront**
- ❌ Z-index chaos → ✅ **Clean hierarchy: stage(2) → backdrop(8) → nav(10) → card(50) → panel(51)**

### 2. **Project Data Enhanced**
**File:** `js/projects-wheel.js` (lines 16-63)

Added to each project:
```javascript
{
  title: 'MyceliJ',           // Split from subtitle
  subtitle: 'JVM-Native LLM',  // NEW
  cardType: 'artifact',        // NEW: MTG-style type (artifact/tool/enchantment)
  tech: ['java', 'vector-api', 'concurrency'], // NEW: Tech badges array
  // ... existing fields
}
```

### 3. **MTG-Style Card Component Created**
**File:** `js/projects-wheel.js` (lines 190-252)

**Structure:**
```
┌─────────────────────┐
│ MyceliJ             │ ← .rw-card-header
│ JVM-Native LLM      │
├─────────────────────┤
│     🫙 + RING      │ ← .rw-card-art (ring SVG + jar)
│   (animated)        │
├─────────────────────┤
│ Pure-Java language  │ ← .rw-card-textbox (parchment)
│ model leveraging... │
├─────────────────────┤
│ [☕] [⚡] [🔄]     │ ← .rw-card-footer (tech badges)
└─────────────────────┘
```

**Ring Integration:**
- Copied exact SVG structure from `index.html` lines 94-134 (About/Skills sections)
- Embedded in each card's art box
- Unique orbit path per card (`ring-orbit-${project.id}`)
- Animated spores orbiting jar specimen

### 4. **Complete CSS Rewrite**
**File:** `styles/projects-wheel.css` (673 lines)

**Key Sections:**

**Card Frame** (lines 92-134):
- Width: 240px, Height: 340px
- 3px spore-green border
- Necrographic corner spores (radial gradients)
- Box shadow with mycelial glow
- Breathing animation (scale 0.98 ↔ 1.02)

**Card Header** (lines 147-161):
- Dark background with spore-green gradient
- Title (16px) + subtitle (11px uppercase)
- 2px border-bottom

**Card Art Box** (lines 165-238):
- Flex: 1 (takes remaining space)
- Ring SVG absolutely positioned (opacity 0.8)
- Jar specimen centered (65% size)
- Ring pulses (stroke-opacity 0.3 ↔ 0.6)
- Hover: Ring intensifies, jar glows brighter

**Card Textbox** (lines 242-258):
- Parchment texture (repeating lines + coffee stains)
- 11px text, dark brown on aged paper
- Min-height: 80px

**Card Footer** (lines 262-283):
- Tech badges as circular "mana cost" symbols
- 24px circles with spore-green borders
- Flex gap: 6px

**Hover State** (lines 287-305):
- Lift 12px + scale 1.08
- Border glows brighter
- Ring opacity → 1.0
- Jar drop-shadow intensifies
- Box shadow expands

**Magnified State** (lines 313-324):
- Portal pattern: `transform: translate(--open-tx, --open-ty) scale(--open-scale)`
- Z-index: 50 (above backdrop)
- Transition: 400ms cubic-bezier
- Ring fully visible

### 5. **Portal Pattern Implementation**
**File:** `js/projects-wheel.js` (lines 407-496)

**`openCard()` function:**
1. Get original `getBoundingClientRect()`
2. Create placeholder div
3. **Portal to body:** `document.body.appendChild(card)`
4. Set fixed positioning at frozen coordinates
5. Initialize CSS custom properties (`--open-tx/ty/scale = 0/0/1`)
6. Calculate center translation
7. RAF animate to center (scale 1.5)
8. Dim other cards
9. Activate backdrop (`has-paper-open-global`)
10. Show panel
11. Focus card

**`closePanel()` function:**
- Animate transform back to origin
- Wait for transitionend
- Return card via placeholder
- Restore other cards
- Hide panel
- Deactivate backdrop

### 6. **HTML Updates**
**File:** `index.html` (lines 300-321)

Changed:
```html
<!-- OLD -->
<div class="rw-jar-constellation">
  <!-- Jars populated by JS -->
</div>

<!-- NEW -->
<div class="rw-card-constellation">
  <!-- MTG-style cards populated by JS -->
</div>
```

Removed:
- `.rw-ritual-rings` SVG container (rings now inside each card)

### 7. **State Management Updates**
Changed all references:
- `state.jarElements` → `state.cardElements`
- `state.activeJar` → `state.activeCard`
- `--jar-x/y` → `--card-x/y`
- `getJarAngle()` → `getCardAngle()`
- `positionJars()` → `positionCards()`
- `openJar()` → `openCard()`
- `handleJarClick()` → `handleCardClick()`
- `handleJarKeydown()` → `handleCardKeydown()`

---

## 📁 Files Modified

### Created:
1. `js/projects-wheel-CARDS.js` - New MTG-style implementation
2. `styles/projects-wheel-CARDS.css` - New card styling
3. `js/projects-wheel-BEFORE-CARDS.js` - Backup before rewrite

### Modified:
1. `js/projects-wheel.js` - Complete rewrite (477 lines)
2. `styles/projects-wheel.css` - Complete rewrite (673 lines)
3. `index.html` - Updated HTML structure (lines 300-321)

### Preserved (Backups):
1. `js/projects-wheel-OLD-BROKEN.js` - Original broken jar implementation
2. `js/projects-wheel-REWRITE.js` - Working jar implementation (before MTG redesign)
3. `js/projects-wheel-BEFORE-CARDS.js` - Last version before MTG cards

---

## 🎨 Design System

### Colors:
- **Spore Green:** `rgba(45, 212, 175, ...)`
- **Ember Orange:** `rgba(255, 122, 51, ...)`
- **Card Background:** `#0A0B0C`
- **Parchment:** `rgba(212, 197, 169, 0.85)` → `rgba(186, 168, 142, 0.85)`
- **Text on Parchment:** `rgba(10, 11, 12, 0.9)`

### Typography:
- **Card Title:** 16px, weight 600
- **Card Subtitle:** 11px, uppercase
- **Card Blurb:** 11px, line-height 1.4
- **Tech Badges:** 10px, weight 600

### Dimensions:
- **Card:** 240px × 340px
- **Header:** 40px min-height
- **Art Box:** Flex 1 (fills space)
- **Textbox:** 80px min-height
- **Footer:** 36px min-height
- **Tech Badge:** 24px × 24px circles

### Animations:
- **Breathing:** 4s ease-in-out infinite (scale 0.98 ↔ 1.02)
- **Ring Pulse:** 3s ease-in-out infinite (stroke-opacity 0.3 ↔ 0.6)
- **Hover:** 280ms ease
- **Magnification:** 400ms cubic-bezier(0.4, 0, 0.2, 1)

---

## 🏗️ Architecture

### Z-Index Hierarchy:
```
0-1:  Background (#bg)
2:    Projects stage (.rw-projects-stage)
3:    Cards in constellation (.rw-card-constellation)
8:    Global backdrop (#paper-backdrop)
10:   Navigation (#network-nav) - hidden when card open
50:   Magnified card (.rw-card-magnified) - moved to body
51:   Parchment panel (.rw-parchment-panel) - also in body
100:  Close button (.rw-close)
```

### Stacking Contexts:
- **Stage (z:2):** Contains card constellation normally
- **Body (root):** Magnified card + panel when open
- ✅ **No conflicts:** Everything at body level when active

### CSS Custom Properties:
- `--card-x` / `--card-y`: Percentage positioning (polar coordinates)
- `--card-idle-scale`: Breathing animation scale
- `--open-tx` / `--open-ty` / `--open-scale`: Portal transform values

---

## ✅ Testing Checklist

- [ ] **Visual:** Cards visible in triangle formation
- [ ] **Positioning:** Top (North), Bottom-right (30°), Bottom-left (150°)
- [ ] **Idle:** Breathing animation (subtle scale pulse)
- [ ] **Ring:** Spores orbiting, ring pulsing
- [ ] **Hover:** Card lifts 12px, ring intensifies, jar glows
- [ ] **Click:** Card magnifies to center smoothly
- [ ] **Portal:** Card moved to body (check z-index in devtools)
- [ ] **Backdrop:** Background darkens (not wheel itself)
- [ ] **Navigation:** Completely hidden (opacity 0)
- [ ] **Panel:** Slides up from bottom with project details
- [ ] **Panel Content:** Title, blurb, links populated correctly
- [ ] **Tech Badges:** All 3 badges visible in footer
- [ ] **Escape Key:** Closes panel, returns card
- [ ] **Click Backdrop:** Same as escape
- [ ] **Return Animation:** Card smoothly returns to original position
- [ ] **Other Cards:** Dim (opacity 0.3) when one is magnified
- [ ] **Console:** No errors
- [ ] **Keyboard Nav:** Arrow keys move between cards
- [ ] **Focus:** Visible outline on focused card
- [ ] **Resize:** Cards reposition correctly

---

## 🐛 Known Issues / TODO

### Potential Improvements:
1. **SVG Tech Icons:** Replace emoji/text with proper SVG icons
2. **Card Types:** Add visual distinction for artifact/tool/enchantment
3. **Rotation Animation:** Add gentle card rotation on hover (like MTG showcase frames)
4. **Sparkle Effects:** Add particle effects when card magnifies
5. **Sound Effects:** Card flip sound on magnification
6. **Loading States:** Add skeleton cards while images load
7. **Mobile Gestures:** Swipe between cards on mobile

### Edge Cases to Test:
- Very long project titles
- Very long blurbs (overflow handling)
- Missing jar images (fallback needed?)
- Rapid clicking (prevent multiple opens)
- Resize during magnification (should close?)
- Browser compatibility (Firefox, Safari)

---

## 📊 Performance Metrics

### Bundle Size:
- **JS:** 477 lines (was 482 with jars)
- **CSS:** 673 lines (was 445 with jars)
- **Increase:** Due to card structure detail

### Optimization:
- ✅ Transform/opacity only (GPU accelerated)
- ✅ `will-change: transform` on cards
- ✅ `contain: layout style` on panel
- ✅ RAF for magnification animation
- ✅ Lazy loading on jar images
- ✅ Reduced motion media query support

---

## 🎓 Lessons Learned

### What Worked:
1. ✅ **Reading existing code first** (altar.css ring structure)
2. ✅ **Copying proven patterns** (portal-to-body from papers)
3. ✅ **Creating backups** (3 versions preserved)
4. ✅ **Clean rewrite** (easier than patching dozens of references)
5. ✅ **Incremental approach** (data → JS → CSS → HTML)
6. ✅ **Consistent naming** (card instead of jar throughout)

### What to Remember:
1. **Stacking contexts matter** - Always put portal elements at body level
2. **CSS custom properties** - Use for JS-controlled values
3. **Don't mix approaches** - CSS OR JS positioning, not both
4. **Test early** - Don't wait until everything is done
5. **Document as you go** - This file helps future debugging

---

## 🚀 Next Steps

1. **Test thoroughly** - Use checklist above
2. **Fix any bugs** found during testing
3. **Optimize images** - Compress jar SVGs if needed
4. **Add polish** - Consider TODO items above
5. **Commit to branch:**
   ```bash
   git add .
   git commit -m "Transform projects to MTG-style cards
   
   - Redesigned jar specimens as Magic: The Gathering-inspired cards
   - Integrated ring SVG from altar sections into card art boxes
   - Added parchment textboxes and tech badge mana costs
   - Maintained portal-to-body magnification pattern
   - Updated all references from jar to card terminology
   
   Structure: header → art (ring+jar) → textbox → tech badges
   Dimensions: 240x340px cards with necrographic styling
   Animations: breathing, ring pulse, hover lift, magnification
   
   Files: Complete rewrite of projects-wheel.js + CSS
   Backups: OLD-BROKEN, REWRITE, BEFORE-CARDS versions preserved"
   ```

---

## 📞 Support

If something breaks:
- Check browser console for errors
- Verify z-index hierarchy in devtools
- Check that `.rw-card-constellation` exists in DOM
- Verify `state.cardElements` is populated
- Confirm portal creates placeholder correctly
- Check CSS custom properties are set

**Backup locations:**
- `js/projects-wheel-BEFORE-CARDS.js` - Last working version
- `js/projects-wheel-REWRITE.js` - Original working jars
- `js/projects-wheel-OLD-BROKEN.js` - Original broken version
