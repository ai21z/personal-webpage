# Render Clarity Audit - Complete Website Analysis

**Date:** 2025-11-05  
**Purpose:** Identify all elements using scale() transforms that may benefit from compositor demotion for improved text antialiasing.

---

## ✅ ALREADY FIXED

### 1. About Section - Paper Cards (`styles/altar.css`, `js/app.js`)
**Location:** `#about .slab.paper`  
**Transform:** `translate() scale(2-2.4x) rotate()`  
**Status:** ✅ **FIXED**
- Uses FLIP animation with scale()
- Compositor demotion after settle (will-change: auto)
- Fallback timeout ensures settle
- Text clarity improved while preserving decorative shape

### 2. Skills Section - Paper Cards (`styles/altar.css`, `js/app.js`)
**Location:** `#skills .slab.paper`  
**Transform:** `translate() scale(2-2.4x) rotate()`  
**Status:** ✅ **FIXED** (shares same system as About)
- Same `initPaperFocusForSection()` function
- Same CSS classes and compositor demotion
- Automatic fix via shared codebase

---

## 🔍 NEEDS INVESTIGATION

### 3. Projects Section - MTG-Style Cards (`styles/projects-wheel.css`, `js/projects-wheel.js`)
**Location:** `.rw-card.rw-card-magnified`  
**Transform:** `translate() scale(1.5x)`  
**Text Content:** ✅ YES - Card titles, descriptions, tech stacks

**Current Implementation:**
```css
.rw-card.rw-card-magnified {
  transform: translate(var(--open-tx, 0), var(--open-ty, 0)) scale(var(--open-scale, 1));
  will-change: transform;
}
```

**JavaScript:** `js/projects-wheel.js:364` - `openCard()` function
- Uses FLIP animation pattern (similar to paper cards)
- Sets --open-scale to 1.5
- NO compositor demotion after settle
- NO .rw-card-magnified--settled class

**Assessment:** 🟡 **NEEDS FIX**
- **Impact:** MEDIUM-HIGH
- **Reason:** Cards contain significant text content that users read
- **Fix Complexity:** EASY (copy paper card pattern)
- **Visual Risk:** LOW (no decorative clip-paths like paper cards)

**Recommendation:** **YES, apply same fix**
1. Add `.rw-card-magnified--settled` CSS class
2. Add transitionend listener in `openCard()`
3. Set `will-change: auto` after animation completes
4. Add fallback timeout (400ms transition + 50ms buffer)

---

### 4. Projects - Card Hover State (`styles/projects-wheel.css`)
**Location:** `.rw-card:hover`  
**Transform:** `translate(-50%, calc(-50% - 12px)) scale(1.08)`  
**Duration:** Permanent while hovering

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** Hover is transient interaction, not settled reading state
- **Scale:** Only 1.08x (minimal blur)
- **Text:** Too brief for reading, user hasn't clicked yet
- **Verdict:** Compositor hints appropriate for smooth animation

---

### 5. Resume Section - Career Spirals (DISABLED)
**Location:** `#resume` section (commented out in HTML)  
**Status:** ⚪ **SKIP** - Section not currently active

---

### 6. Intro Section - Vial Split Bubbles (`styles/components.css`)
**Location:** `.vial-split-bubble` (PDF/DOCX download buttons)  
**Transform:** `translateX() scale(0.92-0.98)`  
**Text Content:** ❌ NO - Only icons

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** No text content, only SVG icons
- **Purpose:** Visual flourish for download buttons
- **Verdict:** Compositor hints appropriate

---

### 7. Cursor Ring (`styles/canvas.css`)
**Location:** `.cursor-ring`  
**Transform:** `translate(-50%, -50%) scale(1-1.35)` (animated)  
**Text Content:** ❌ NO - Pure decoration

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** Animated indicator, no text
- **Performance:** will-change: transform appropriate for continuous animation

---

### 8. Contact Section - Notebook Page (`styles/contact.css`)
**Location:** `.notebook-page`  
**Transform:** `rotate(-0.5deg) translateY() scale(0.95-1)` (entrance animation)  
**Text Content:** ✅ YES - Form labels and inputs

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** Transform is entrance animation only, returns to scale(1)
- **Final State:** No scale transform applied (form at 100%)
- **Verdict:** Text crisp in reading state

---

### 9. Blog Section - Category/Article Panels
**Location:** Various blog navigation elements  
**Transform:** Multiple `translateX/Y()` and `scale()` for UI elements  
**Text Content:** ✅ YES - Article titles, metadata

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** Most transforms are translate-only (no scale)
- **Scale transforms:** Only used for entrance animations
- **Reading State:** Elements at scale(1) or no transform

---

### 10. Work Globe Section - Pin Details
**Location:** Work experience globe with info panels  
**Transform:** Various for WebGL and UI overlays  
**Text Content:** ✅ YES - Job descriptions

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** Detail panels appear without scale transforms
- **Globe:** WebGL-rendered (different rendering path)
- **Text:** Rendered at native DPR in overlays

---

### 11. Navigation Nodes (`styles/navigation.css`)
**Location:** `.network-node`  
**Transform:** `translate(-50%, -50%) scale(1.05)` on hover  
**Text Content:** ✅ YES - Section labels

**Assessment:** ⚪ **NO FIX NEEDED**
- **Reason:** Hover state, not reading state
- **Scale:** Only 1.05x (minimal)
- **Duration:** Transient interaction
- **Verdict:** Compositor hints appropriate

---

## 📊 SUMMARY

### Critical Findings

| Section | Element | Scale | Text? | Status | Priority |
|---------|---------|-------|-------|--------|----------|
| **About** | Paper cards | 2-2.4x | ✅ Yes | ✅ Fixed | - |
| **Skills** | Paper cards | 2-2.4x | ✅ Yes | ✅ Fixed | - |
| **Projects** | MTG cards | 1.5x | ✅ Yes | 🟡 Needs Fix | **HIGH** |
| Projects | Hover state | 1.08x | ✅ Yes | ⚪ Skip | Low |
| Intro | Vial bubbles | 0.92-0.98x | ❌ No | ⚪ Skip | - |
| Contact | Page entrance | 0.95-1x | ✅ Yes | ⚪ Skip | - |
| Navigation | Node hover | 1.05x | ✅ Yes | ⚪ Skip | - |
| Cursor Ring | Breathe anim | 1-1.35x | ❌ No | ⚪ Skip | - |

### Recommendations

**🎯 IMPLEMENT FIX:**
1. **Projects Section - MTG Cards** (`rw-card-magnified`)
   - High impact: Users read card descriptions in magnified state
   - Easy implementation: Copy paper card compositor demotion pattern
   - Low risk: No decorative elements that could break

**⏭️ SKIP (Not Needed):**
- All hover states (transient, < 1.1x scale)
- Entrance animations (return to scale(1))
- Icon-only transforms (no text content)
- WebGL-rendered content (different pipeline)

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Projects Cards (REQUIRED)

**Files to Modify:**
1. `styles/projects-wheel.css` - Add settled state CSS
2. `js/projects-wheel.js` - Add compositor demotion logic

**CSS Changes:**
```css
/* Add after .rw-card.rw-card-magnified rule */
.rw-card.rw-card-magnified--settled {
  will-change: auto !important;
  backface-visibility: visible !important;
}

/* Ensure hover doesn't override */
.rw-card.rw-card-magnified--settled:hover {
  transform: translate(var(--open-tx, 0), var(--open-ty, 0)) 
             scale(var(--open-scale, 1)) !important;
}
```

**JavaScript Changes** (in `openCard()` function):
```javascript
// After requestAnimationFrame that sets transform variables
let settled = false;
const applySettle = () => {
  if (settled) return;
  settled = true;
  
  card.classList.add('rw-card-magnified--settled');
  card.style.willChange = 'auto';
  card.style.backfaceVisibility = 'visible';
  void card.offsetHeight;
  
  console.log('[AA-FIX] Projects card settled:', card.className);
};

const onEnd = (e) => {
  if (e.propertyName !== 'transform') return;
  card.removeEventListener('transitionend', onEnd);
  applySettle();
};
card.addEventListener('transitionend', onEnd, { once: true });
setTimeout(applySettle, 450); // 400ms transition + 50ms buffer
```

**Also update `closeCard()` function:**
```javascript
// Before removing .rw-card-magnified class
card.classList.remove('rw-card-magnified--settled');
card.style.willChange = 'transform';
```

---

## 🧪 TESTING PROTOCOL

### Projects Cards Testing
1. **Visual Verification:**
   - Open Projects section
   - Click any card to magnify
   - Wait 450ms for settle
   - Check DevTools Computed: `will-change` should be `auto`
   - Compare text clarity before/after settle

2. **Console Verification:**
   - Should see: `[AA-FIX] Projects card settled:` log
   - Indicates demotion occurred

3. **Interaction Testing:**
   - Rapidly click different cards (test interrupt handling)
   - Click backdrop to close
   - ESC key to close
   - Verify no stuck states

4. **Cross-Browser Testing:**
   - Chrome/Edge (primary concern - Chromium AA behavior)
   - Firefox (already handles AA better)
   - Safari (different compositor rules)

---

## 📝 NOTES

### Why Not Fix Everything?

**Scale < 1.1x:** Minimal perceptual blur
- Human eye can't distinguish subpixel differences at these scales
- Performance cost of demotion outweighs benefit

**Hover States:** Transient interactions
- User not reading text during hover
- Smooth animation more important than static crispness
- will-change: transform ensures 60fps

**Entrance Animations:** Temporary states
- Elements settle at scale(1) or no transform
- Text crisp in final reading state
- Demotion during animation would cause jank

### Why Fix Projects Cards?

1. **High Scale:** 1.5x magnification = noticeable blur
2. **Reading Content:** Users spend time reading card descriptions
3. **Settled State:** Cards stay open for extended periods
4. **Easy Win:** Same pattern as paper cards (proven solution)

---

## ✅ NEXT STEPS

**Immediate Action:**
1. Implement Projects card fix (HIGH priority)
2. Test across browsers and DPI settings
3. Update CHANGELOG-AA-FIX.md with Projects section

**Future Monitoring:**
- If new sections added with scale() + text, apply same pattern
- Watch for user feedback on text clarity issues
- Consider A/B testing if uncertain about edge cases

---

**Last Updated:** 2025-11-05  
**Status:** Audit Complete, 1 Fix Required
