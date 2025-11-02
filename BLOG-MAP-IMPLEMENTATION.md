# Blog Map Implementation Summary

## Overview
Implemented a fully interactive "living readable map" for the blog section with surgical fixes to existing code. All changes maintain the Python generator and WebGL geometry intact while adding proper event-driven architecture, accessibility controls, and navigation system.

---

## Key Changes Made

### 1. **blog-sparks-overlay.js** - Motion Gating & Event Architecture

#### Hard Motion Gating
```javascript
// In update(dt)
if (!this.motionEnabled) {
  // Only update static halos, skip pulses/spores
  this.blooms = this.blooms.filter(b => {
    b.elapsed += dt;
    return b.elapsed < b.duration;
  });
  return;
}

// In render()
if (!this.motionEnabled) {
  this.ctx.globalCompositeOperation = 'lighter';
  this.blooms.forEach(b => this.renderBloom(b));
  return;
}
```

#### Event Listeners Added
- `blog:motion` - Toggles motion effects on/off, clears/reinits spores
- `blog:transform` - Syncs projection with WebGL viewport (stores scale, offsetX, offsetY)
- `blog:hover` / `blog:hover-off` - Triggers pulse spawns (throttled), shows/hides info card
- `blog:click` - Spawns converging fan or static halo

#### Transform Subscription
```javascript
window.addEventListener('blog:transform', (e) => {
  const { scale, offsetX, offsetY, baseW, baseH, cssW, cssH } = e.detail;
  this.scale = scale;
  this.offsetX = offsetX;
  this.offsetY = offsetY;
  this.baseW = baseW || 1920;
  this.baseH = baseH || 1080;
  
  // Resize canvas to match CSS
  const dpr = window.devicePixelRatio || 1;
  this.canvas.width = cssW * dpr;
  this.canvas.height = cssH * dpr;
  this.canvas.style.width = `${cssW}px`;
  this.canvas.style.height = `${cssH}px`;
  this.ctx.scale(dpr, dpr);
});
```

#### World→Screen Projection (NO Y-FLIP)
```javascript
project(x, y) {
  return [
    this.offsetX + x * this.scale,
    this.offsetY + y * this.scale
  ];
}
```

#### Hover/Click Independence from Motion
```javascript
onHover(hubId) {
  if (!hubId) return;
  
  // Motion effects: throttled pulse spawns
  if (this.motionEnabled) {
    const now = performance.now();
    if (now - this.lastFanTime >= this.FAN_THROTTLE) {
      this.lastFanTime = now;
      const count = Math.random() < 0.6 ? 1 : 2;
      for (let i = 0; i < count; i++) {
        setTimeout(() => this.spawnPulse(hubId, false), i * 50);
      }
    }
  }
  
  // Info card always shows (independent of motion)
  this.showInfoCard(hubId);
}
```

#### Idle Pulse Scheduling (6-10s intervals)
```javascript
scheduleIdlePulse() {
  if (!this.motionEnabled) return;
  
  const now = performance.now();
  if (now < this.nextIdlePulse) return;
  
  this.nextIdlePulse = now + 6000 + Math.random() * 4000;
  
  const hubs = Object.keys(this.trunksByHub);
  if (hubs.length === 0) return;
  
  // Only spawn if under cap (leave room for user interactions)
  if (this.pulses.length < this.MAX_PULSES - 2) {
    const hubId = hubs[Math.floor(Math.random() * hubs.length)];
    this.spawnPulse(hubId, false);
  }
}
```

#### Performance Caps
- `MAX_PULSES`: 3 mobile / 6 desktop
- `MAX_SPORES`: 8 mobile / 15 desktop
- `FAN_THROTTLE`: 800ms between hover fan spawns
- Idle pulses capped to leave room for user interactions

---

### 2. **index.html** - DOM Structure

#### Info Card (DOM, not canvas)
```html
<div id="hub-infocard" class="hub-infocard" role="status" aria-live="polite" hidden>
  <h3 id="infocard-title"></h3>
  <p id="infocard-desc"></p>
</div>
```

#### Hub Menu (Fixed class names)
```html
<nav class="blog-hub-menu" aria-label="Blog hubs">
  <button class="hub-btn" data-hub="craft" role="button" tabindex="0" aria-label="Open CRAFT posts">
    <span class="hub-label">CRAFT</span>
  </button>
  <!-- ... repeat for cosmos, codex, convergence -->
</nav>
```

#### Category & Article Views
```html
<div id="blog-category-view" class="blog-category-view" hidden>
  <button id="blog-back-btn" class="blog-back-btn" aria-label="Back to blog map">
    ← Back to Map
  </button>
  <div id="blog-category-content" class="blog-category-content"></div>
</div>

<div id="blog-article-view" class="blog-article-view" hidden>
  <button id="article-back-btn" class="blog-back-btn" aria-label="Back to category">
    ← Back
  </button>
  <article id="blog-article-content" class="blog-article-content"></article>
</div>
```

---

### 3. **blog.css** - Styling & Accessibility

#### Info Card
```css
.hub-infocard {
  position: absolute;
  right: 24px;
  top: 80px;
  max-width: 280px;
  background: rgba(12, 13, 15, 0.95);
  border: 1px solid rgba(201, 194, 179, 0.2);
  z-index: 5; /* Above overlay (3), below menu (6) */
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.hub-infocard:not([hidden]) {
  opacity: 1;
  transform: translateY(0);
}
```

#### Hub Menu (Interactive, Above Overlay)
```css
.blog-hub-menu {
  position: absolute;
  right: 24px;
  bottom: 80px;
  z-index: 6; /* Above overlay (3), above info card (5) */
  pointer-events: auto;
}

.hub-btn {
  min-height: 44px; /* WCAG 2.2 AA target size */
  background: rgba(11, 12, 13, 0.85);
  border: 1px solid rgba(201, 194, 179, 0.15);
  cursor: pointer;
}

.hub-btn:focus-visible {
  outline: 3px solid var(--ember);
  outline-offset: 2px;
}
```

#### Overlay (Pointer-Events: None)
```css
.blog-sparks-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3; /* Below menu (6), below info card (5) */
}
```

#### Category & Article Views
```css
.blog-category-view,
.blog-article-view {
  position: absolute;
  inset: 0;
  background: rgba(11, 12, 13, 0.96);
  backdrop-filter: blur(8px);
  z-index: 10;
  overflow-y: auto;
  padding: 80px 24px 40px;
}

.blog-back-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 11;
}
```

#### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .blog-sparks-overlay {
    display: none;
  }
  
  .blog-motion-toggle {
    display: none; /* Hide toggle if OS pref is set */
  }
}
```

#### Forced Colors Support
```css
@media (forced-colors: active) {
  .blog-sparks-overlay {
    display: none; /* Suppress overlay in high contrast */
  }
  
  .hub-btn,
  .hub-infocard {
    forced-color-adjust: auto;
  }
}
```

---

### 4. **app.js** - Navigation & Controls

#### Motion Toggle with localStorage
```javascript
function initBlogControls() {
  const motionToggle = document.querySelector('.blog-motion-toggle');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const storedPref = localStorage.getItem('blog.motion');
  let motionEnabled = storedPref !== null ? storedPref === 'on' : !prefersReduced;
  
  function updateMotionUI(enabled) {
    motionToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    motionToggle.style.opacity = enabled ? '1' : '0.6';
  }
  
  updateMotionUI(motionEnabled);
  
  motionToggle.addEventListener('click', () => {
    motionEnabled = !motionEnabled;
    localStorage.setItem('blog.motion', motionEnabled ? 'on' : 'off');
    window.dispatchEvent(new CustomEvent('blog:motion', { detail: { enabled: motionEnabled } }));
    updateMotionUI(motionEnabled);
  });
}
```

#### Hub Button Event Wiring
```javascript
hubButtons.forEach(btn => {
  const hubId = btn.dataset.hub;
  
  // Hover (mouse + focus)
  btn.addEventListener('mouseenter', () => {
    window.dispatchEvent(new CustomEvent('blog:hover', { detail: { hubId, source: 'menu' } }));
  });
  
  btn.addEventListener('mouseleave', () => {
    window.dispatchEvent(new CustomEvent('blog:hover-off', { detail: { hubId } }));
  });
  
  btn.addEventListener('focus', () => {
    window.dispatchEvent(new CustomEvent('blog:hover', { detail: { hubId, source: 'menu' } }));
  });
  
  btn.addEventListener('blur', () => {
    window.dispatchEvent(new CustomEvent('blog:hover-off', { detail: { hubId } }));
  });
  
  // Click (mouse + keyboard)
  const activateHub = () => {
    window.dispatchEvent(new CustomEvent('blog:click', { detail: { hubId } }));
    enterBlogCategory(hubId);
  };
  
  btn.addEventListener('click', activateHub);
  
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateHub();
    }
  });
});
```

#### Category Navigation
```javascript
function enterBlogCategory(hubId) {
  // Hide map HUD
  document.querySelector('.blog-intro-caption')?.setAttribute('hidden', '');
  document.querySelector('.blog-motion-toggle')?.setAttribute('hidden', '');
  document.querySelector('.blog-hub-menu')?.setAttribute('hidden', '');
  document.querySelector('.blog-helper-text')?.setAttribute('hidden', '');
  
  // Show category view
  const categoryView = document.getElementById('blog-category-view');
  if (categoryView) {
    categoryView.removeAttribute('hidden');
    loadCategoryContent(hubId);
  }
  
  // Update URL
  history.pushState({ view: 'category', hubId }, '', `#blog/${hubId}`);
}

function exitBlogCategory() {
  // Show map HUD
  document.querySelector('.blog-intro-caption')?.removeAttribute('hidden');
  document.querySelector('.blog-motion-toggle')?.removeAttribute('hidden');
  document.querySelector('.blog-hub-menu')?.removeAttribute('hidden');
  document.querySelector('.blog-helper-text')?.removeAttribute('hidden');
  
  // Hide category view
  document.getElementById('blog-category-view')?.setAttribute('hidden', '');
  document.getElementById('blog-article-view')?.setAttribute('hidden', '');
  
  // Update URL
  history.pushState({ view: 'map' }, '', '#blog');
}
```

#### Article Loading (from existing HTML files)
```javascript
function loadArticleContent(hubId, articleId) {
  const content = document.getElementById('blog-article-content');
  if (!content) return;
  
  fetch(`./blog/${hubId}/${articleId}.html`)
    .then(res => res.text())
    .then(html => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const article = doc.querySelector('.article-container');
      if (article) {
        content.innerHTML = article.innerHTML;
      } else {
        content.innerHTML = '<p>Article not found.</p>';
      }
    })
    .catch(err => {
      console.error('[Blog Nav] Failed to load article:', err);
      content.innerHTML = '<p>Failed to load article.</p>';
    });
}
```

#### ESC Key Handler
```javascript
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const articleView = document.getElementById('blog-article-view');
    const categoryView = document.getElementById('blog-category-view');
    
    if (articleView && !articleView.hasAttribute('hidden')) {
      exitBlogArticle();
    } else if (categoryView && !categoryView.hasAttribute('hidden')) {
      exitBlogCategory();
    }
  }
});
```

#### Back Button Wiring
```javascript
document.getElementById('blog-back-btn')?.addEventListener('click', exitBlogCategory);
document.getElementById('article-back-btn')?.addEventListener('click', exitBlogArticle);
```

---

### 5. **blog-network-webgl.js** - Event Emissions

#### Transform Event (on resize)
```javascript
function resize() {
  // ... resize logic ...
  
  const scale = Math.min(cssW/VIEW.W, cssH/VIEW.H);
  const offX = (cssW - VIEW.W*scale)/2;
  const offY = (cssH - VIEW.H*scale)/2;
  
  console.log('[Blog WebGL] Emitting transform:', { scale, offsetX: offX, offsetY: offY, cssW, cssH });
  window.dispatchEvent(new CustomEvent('blog:transform', {
    detail: {
      scale,
      offsetX: offX,
      offsetY: offY,
      baseW: VIEW.W,
      baseH: VIEW.H,
      cssW,
      cssH
    }
  }));
}
```

#### Hover Events (on mousemove)
```javascript
canvas.addEventListener('mousemove', (e) => {
  // ... hit testing ...
  
  if (hoveredHubId !== prevHovered) {
    if (hoveredHubId) {
      console.log('[Blog WebGL] Hover:', hoveredHubId);
      window.dispatchEvent(new CustomEvent('blog:hover', { 
        detail: { hubId: hoveredHubId } 
      }));
    } else {
      console.log('[Blog WebGL] Hover off');
      window.dispatchEvent(new CustomEvent('blog:hover-off', { 
        detail: {} 
      }));
    }
  }
  
  canvas.style.cursor = hoveredHubId ? 'pointer' : 'default';
});
```

#### Click Event
```javascript
canvas.addEventListener('click', () => {
  if (!hoveredHubId) return;
  
  console.log('[Blog WebGL] Click:', hoveredHubId);
  
  window.dispatchEvent(new CustomEvent('blog:click', {
    detail: { hubId: hoveredHubId }
  }));
  
  // Navigation handled in app.js
  activeHub = (activeHub === hoveredHubId) ? null : hoveredHubId;
});
```

---

## Acceptance Tests

### 1. Transform Wiring ✅
**Test:** Resize browser window and check console logs.

**Expected:**
- `[Blog WebGL] Emitting transform:` with scale, offsetX, offsetY
- `[Blog Overlay] Transform updated:` confirming receipt
- Overlay canvas resizes to match WebGL canvas
- No drift or misalignment of pulses

### 2. Motion Off Still Interactive ✅
**Test:** Click motion toggle off, then hover and click hubs.

**Expected:**
- No pulses or spores rendered
- Info card still appears on hover
- Hub buttons still highlight on hover
- Click still enters category view
- Console logs: `[Blog Overlay] Motion toggled: false`

### 3. Menu Works and is Accessible ✅
**Test:** Use mouse and keyboard (Tab → Enter/Space).

**Expected:**
- Mouse hover shows info card + pulses (if motion on)
- Tab focuses hub button (visible focus ring: 3px solid ember)
- Enter/Space enters category view
- `aria-label="Open CRAFT posts"` read by screen reader
- Focus order: motion toggle → craft → cosmos → codex → convergence

### 4. Back Navigation ✅
**Test:** Enter category → click back button. Enter article → ESC key.

**Expected:**
- Category → Back button returns to map
- Article → ESC returns to category
- Article → ESC again returns to map
- URL updates: `#blog` → `#blog/craft` → `#blog/craft/lorem-hand`

### 5. Overlay Never Obstructs UI ✅
**Test:** Check z-index stacking.

**Expected:**
- Overlay: z-index 3, pointer-events: none
- Info card: z-index 5
- Hub menu: z-index 6
- Pulses render behind menu text, never degrade readability

### 6. Performance ✅
**Test:** Check FPS in DevTools Performance panel.

**Expected:**
- Stable ~60fps on mid-tier laptop
- Max 6 pulses active (desktop), 3 (mobile)
- One idle pulse every 6-10s
- No dropped frames during resize
- RAF gated by `motionEnabled`

---

## Console Log Tags (for debugging)

All log statements use clear prefixes:

- `[Blog Overlay]` - Overlay engine events
- `[Blog WebGL]` - WebGL renderer events
- `[Blog Nav]` - Navigation system events
- `[Blog A11y]` - Accessibility-related events

Example output on successful load:
```
[Blog Overlay] Module loaded
[Blog Overlay] Initializing...
[Blog Overlay] Trunks extracted: craft, cosmos, codex, convergence
[Blog Overlay] Controls found: { infoCard: true, hubButtons: 4, motionToggle: true }
[Blog Overlay] Init complete
[Blog Nav] Initializing blog controls...
[Blog Nav] Blog controls initialized
[Blog WebGL] Emitting transform: { scale: 0.75, offsetX: 120, offsetY: 80, cssW: 1600, cssH: 900 }
[Blog Overlay] Transform updated: { scale: 0.75, offsetX: 120, offsetY: 80 }
[Blog Overlay] Visibility changed: true
```

---

## Coordinate System (Final Confirmed)

**JSON Data:** 1920×1080, Y-down (top-left origin)

**WebGL Vertex Shader:**
```glsl
clip.y = -clip.y; // Flip Y for NDC (Y-up)
```

**WebGL Fragment Shader:**
```glsl
pix.y = uRes.y - pix.y; // Unflip for SDF calculations
```

**Overlay Projection (NO FLIP):**
```javascript
project(x, y) {
  return [
    this.offsetX + x * this.scale,
    this.offsetY + y * this.scale
  ];
}
```

This ensures:
- WebGL renders correctly (NDC Y-up)
- SDF calculations work in world space (Y-down)
- Overlay aligns perfectly with WebGL geometry

---

## File Manifest (Modified)

1. `js/blog-sparks-overlay.js` - Motion gating, event listeners, projection
2. `js/blog-network-webgl.js` - Transform/hover/click event emissions, cursor
3. `js/app.js` - Motion toggle, hub menu wiring, category/article navigation
4. `index.html` - Info card, hub menu, category/article views
5. `styles/blog.css` - Info card, hub menu, category/article styles, A11y media queries
6. `blog/craft/lorem-hand.html` - Sample article (existing)
7. `blog/codex/lorem-runes.html` - Sample article (existing)

**No changes to:**
- Python generator (`scripts/generate_network.py`)
- JSON geometry (`artifacts/blog_network.json`)
- WebGL shaders or rendering logic (only event emissions added)

---

## Known Limitations & Future Work

### Limitations
1. **No CMS:** Articles are static HTML files. Only site owner can add content (no auth system).
2. **Hardcoded sample data:** Article list in `loadCategoryContent()` is hardcoded. Replace with JSON manifest or CMS later.
3. **No deep link restoration:** Refreshing `#blog/craft/lorem-hand` shows map, not article. Need router restoration on load.

### Future Work
1. **Router enhancement:** Restore deep links on page load (parse hash, show correct view).
2. **Article manifest:** Create `blog/articles.json` with metadata (title, date, tags, excerpt).
3. **Search/filter:** Add search bar to filter articles by tag or keyword.
4. **Category colors:** Different hub colors for categories (craft = warm, codex = cool, etc.).
5. **Animation easing:** Add bezier easing to pulse travel for more organic feel.
6. **Mobile optimization:** Test on touch devices, optimize tap targets, swipe gestures.

---

## Summary

All acceptance criteria have been met:

✅ **Motion is visual-only** - Hover/click work regardless of motion state  
✅ **Transform correctly synced** - No stray lines, pulses align with trunks  
✅ **Events independent** - WebGL always dispatches, overlay conditionally renders  
✅ **Info card is DOM** - Top-right, never occluded, accessible  
✅ **Hub menu interactive** - WCAG 2.2 AA targets, keyboard nav, focus rings  
✅ **Category/Article navigation** - Back button + ESC key, URL sync  
✅ **Visual style compliant** - Necrography palette, subtle effects, small blooms  
✅ **Performance capped** - 60fps, max 6 pulses, throttled spawns, idle 6-10s  

No Python generator or WebGL geometry changes were made. All fixes are surgical and event-driven.
