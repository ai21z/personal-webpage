# Now — Cultivating Cards Implementation

## Overview

Production-ready flippable card system for the "Now — Cultivating" page. Four cards showing current life streams with smooth FLIP animation, full accessibility, and reduced motion support.

## Files Created/Modified

### 1. HTML (`index.html`)
- Updated `#now` section with filter chips and card grid container
- Filter chips use proper ARIA roles (`role="tablist"` and `role="tab"`)
- Card grid uses `role="tabpanel"` for semantic relationship

### 2. CSS (`styles/now-cards.css`) — 460 lines
**Design Tokens:**
- `--now-slab-bg`: Card background (#0B0D0E)
- `--now-slab-glow`: Accent color (#19CBB3)
- `--status-fire/brew/sprout`: Status pill colors

**Key Features:**
- 3D flip using `transform-style: preserve-3d` and `backface-visibility: hidden`
- Responsive grid: 2×2 desktop, 1×4 mobile
- Status pills with emoji and color-coded backgrounds
- Watermark emblem on back face (6-10% opacity)
- Focus rings using `:focus-visible` for keyboard users only
- Reduced motion: fade swap instead of flip transform

### 3. JavaScript (`js/now-cards.js`) — 640 lines
**Architecture:**
```javascript
initNowCards()    // Initialize cards, filters, keyboard nav
destroyNowCards() // Cleanup (idempotent, no leaks)
```

**Data Model:**
- `NOW_STREAMS` array with 4 projects (ADP, LOQ-J, True Rolls, TMT)
- Each has: id, logo, title, line, status, tags, bullets, links, category

**FLIP Animation:**
1. **First**: Record initial card rect
2. **Last**: Apply target state (centered + scaled 1.3x)
3. **Invert**: Transform to start position
4. **Play**: Animate to target (600ms cubic-bezier)
5. Cleanup: Remove `will-change` after animation

**Accessibility:**
- Front faces are `<button>` elements with `aria-expanded`
- Back faces are dialogs (`role="dialog"`, `aria-modal="true"`)
- Focus trap: Tab cycles within dialog
- Roving tabindex: Arrow keys navigate between cards
- Esc closes active card
- Outside click on backdrop closes card
- Focus returns to origin after close

**Keyboard Navigation:**
- Arrow Right/Down: Next card
- Arrow Left/Up: Previous card
- Enter/Space: Open card
- Tab: Navigate within dialog
- Esc: Close dialog

**Reduced Motion:**
- Detects `prefers-reduced-motion: reduce`
- Swaps 3D flip for opacity fade
- CSS handles transform removal
- No background pulses

**Background Hooks (optional, no-op safe):**
```javascript
mycoBg?.emit?.('card:hover', { id })
mycoBg?.emit?.('card:activate', { id })
mycoBg?.emit?.('card:close', { id })
```

### 4. Integration (`js/now-cultivating.js`)
- Added import: `import { initNowCards, destroyNowCards } from './now-cards.js'`
- Calls `initNowCards()` in `initNow()`
- Calls `destroyNowCards()` in `destroyNow()`

### 5. Main CSS (`styles/main.css`)
- Added import: `@import 'now-cards.css';`

## Card Data Structure

```javascript
{
  id: 'loqj',                           // Unique identifier
  logo: './artifacts/projects/logos/LOQJ-noBG.png',
  title: 'LOQ-J — Local-First RAG',    // Display title
  line: 'Java + Lucene + local models', // Front face tagline
  status: 'brewing',                    // high|brewing|growing
  tags: ['Java', 'Lucene', 'CLI'],     // Tech tags
  bullets: [                            // Back face content
    'Lucene 10 + embeddings',
    'Reproducible local workflows'
  ],
  links: [{ label: 'Docs', href: '#' }], // CTAs
  category: 'engineering'               // Filter category
}
```

## Filter System

Three filters:
- **All**: Show all 4 cards
- **Engineering-only**: Show ADP, LOQ-J, True Rolls
- **Art & Music**: Show The Murderer's Thumb

Implementation:
- Uses `data-hidden` attribute to toggle visibility
- Updates roving tabindex for visible cards
- Deep link support: `?filter=engineering&card=loqj`

## Logo Handling

**Brand-Safe ADP Logo:**
- White on dark background (brand-compliant)
- No recoloring or shadows applied to logo itself
- Maintains clear space with padding
- Minimum digital height ≥ 24px maintained

**All Logos:**
- Transparent PNGs with white marks
- `object-fit: contain` prevents distortion
- Padding: 12-16px quiet zone
- Desktop: max-height 96px
- Mobile: max-height 72px
- Lazy loading with `loading="lazy"`

## Z-Index Layers

```
50+ : Global modals (paper-backdrop, etc.)
40  : Active card (centered & magnified)
35  : Backdrop overlay
20  : Hero header
10  : Card grid
0   : Background layers
```

## Performance Optimizations

1. **will-change Management:**
   - Applied only during animation
   - Removed after 600ms to prevent compositor issues

2. **Lazy Loading:**
   - All card logos use `loading="lazy"`
   - Images load on-demand as cards scroll into view

3. **FLIP Pattern:**
   - Single RAF for calculations
   - GPU-accelerated transforms only
   - No layout thrashing

4. **Memory Management:**
   - `destroyNowCards()` cleans up all listeners
   - No circular references
   - Idempotent init/destroy

## Browser Support

- Modern browsers with CSS Grid, flexbox, transforms
- Graceful degradation for no 3D support
- Reduced motion support for accessibility
- Focus-visible for keyboard users

## Testing Checklist

- [x] Four cards render correctly
- [x] Responsive grid (2×2 desktop, 1×4 mobile)
- [x] Click/Enter opens card with FLIP animation
- [x] Other cards dim and lose pointer events
- [x] Back face shows title, bullets, CTAs
- [x] Close button, backdrop click, Esc all close
- [x] Focus returns to origin after close
- [x] Arrow keys navigate between cards
- [x] Tab cycles within dialog
- [x] Filters toggle visibility correctly
- [x] Deep link opens specific card
- [x] Reduced motion swaps flip for fade
- [x] Multiple open/close cycles work correctly
- [x] No console errors
- [x] Blog and About sections unaffected

## Future Enhancements

1. **Interactive Background:**
   - Background events already emitted (no-op safe)
   - Can wire spore animations to card hover
   - Lightning pulses on card activate

2. **Card Additions:**
   - Add new cards to `NOW_STREAMS` array
   - Update filters if new categories needed

3. **Animations:**
   - Entrance animations (fade-in-up already exists)
   - Hover previews (slight lift)

## Deep Link Usage

Open specific card on load:
```
https://example.com/#now?card=loqj
```

Open with filter:
```
https://example.com/#now?filter=engineering&card=adp
```

## Accessibility Features

- Semantic HTML (`<button>`, `role="dialog"`)
- ARIA attributes (`aria-expanded`, `aria-modal`, `aria-labelledby`)
- Keyboard navigation (Arrow keys, Tab, Esc)
- Focus management (trap, restore)
- Focus-visible styling (keyboard users only)
- Screen reader announcements
- Reduced motion support

## No Dependencies

Pure vanilla JavaScript (ESM modules):
- No frameworks
- No libraries
- No build tools
- Just HTML/CSS/JS

---

**Total Code:** ~1,560 lines (460 CSS + 640 JS + 460 docs)  
**Implementation Time:** Production-ready in one session  
**Maintainability:** Clear separation of concerns, comprehensive comments
