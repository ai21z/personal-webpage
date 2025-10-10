# Dark Ambient Horror × Swiss Minimalism Design System

## Design Philosophy

This personal website combines two seemingly contradictory design philosophies into a cohesive, professional experience:

### Swiss Design Principles (Structure & Clarity)
- **Grid-based layout**: Precise 12-column grid system with 8px base unit
- **Clean typography**: Xanh Mono monospace font for technical precision
- **Generous whitespace**: Breathing room between elements
- **Clear hierarchy**: Numerical indexing (00, 01, 02, 03) for navigation
- **Functional honesty**: Every element serves a purpose

### Dark Ambient Horror Aesthetics (Atmosphere & Emotion)
- **Deep blacks & void backgrounds**: Creates atmospheric depth
- **Fungal/organic textures**: Subtle decay and growth metaphors
- **Eerie accent colors**: Decay green (#3FFF9F) as primary accent
- **Floating particles**: Suggests spores, decay, digital degradation
- **Subtle glitch effects**: Technology meeting entropy (hover only)

## Color Palette

### Primary Colors
- **Void** `#08090A` - Deepest background
- **Abyss** `#0B0B0C` - Primary dark surface
- **Charcoal** `#131417` - Secondary surfaces
- **Bone** `#E6E3D8` - Primary text (14:1 contrast ratio)

### Accent Colors
- **Decay Green** `#3FFF9F` - Primary accent (horror aesthetic, high contrast)
- **Necrotic** `#7AAE8A` - Secondary green (organic, muted)
- **Spectral Blue** `#8FB4FF` - Tertiary accent
- **Fungal** `#4A5C52` - Subtle UI elements

### Semantic Colors
- **Blood Red** `#FF3B3B` - Reserved for critical states
- **Ember** `#C24A2E` - Warm accent (used sparingly)

## Typography

**Font**: Xanh Mono (monospace) - Conveys technical precision while remaining readable

**Scale** (fluid, responsive):
- Caption: 10px
- XS: 14px
- Small: 16px
- Base: 16-18px (clamp)
- Large: 24px
- XL: 32px
- 2XL: 38-52px (clamp)
- 3XL: 64px

**Line Heights**:
- Tight: 1.1 (headlines)
- Normal: 1.5 (UI elements)
- Relaxed: 1.7 (body text - Swiss principle of readability)

## Layout Structure

### Four Main Sections

1. **Intro (00)** - Landing page with name, tagline, social links, and sigil
2. **About (01)** - Resume, skills, experience, contact information
3. **Projects (02)** - Portfolio grid with project cards
4. **Blog (03)** - Article list with dates and excerpts

### Navigation
- Fixed position, top-right
- Index-based (00, 01, 02, 03)
- Minimal labels
- Animated active state
- Accessible via keyboard

## Interactive Elements

### Purposeful Animations (Reduced Motion Respected)

1. **Floating Particles**
   - 40-80 particles depending on screen size
   - Slow drift suggesting spores or decay
   - Connected with thin lines when nearby
   - Organic, not geometric movement

2. **Glitch Effect**
   - Hover-only on name element
   - Brief, subtle color separation
   - RGB channel displacement
   - Suggests tech decay without being distracting

3. **Hover States**
   - Cards lift slightly (-2px to -4px)
   - Border color shifts to accent
   - Accent lines reveal
   - Smooth cubic-bezier easing

4. **Sigil Rotation**
   - Interactive focal point
   - 180° rotation on click
   - Particle burst effect
   - Keyboard accessible

## Accessibility Features

### WCAG AAA Compliant
- Bone on Void: 14:1 contrast ratio
- Decay Green on Void: 10:1 contrast ratio
- All interactive elements keyboard accessible
- Skip to content link
- ARIA labels on all navigation
- Screen reader announcements for state changes

### Reduced Motion Support
- All animations disabled when `prefers-reduced-motion: reduce`
- Static final states shown instead
- Particles rendered but not animated

### Semantic HTML
- Proper heading hierarchy
- Semantic sectioning elements
- Form labels and descriptions
- Alt text on images

## Swiss Design Elements (Rams Principles)

1. **Innovative** - Unique horror/Swiss fusion
2. **Useful** - Clear navigation, readable content
3. **Aesthetic** - Beautiful in its starkness
4. **Understandable** - Intuitive structure
5. **Unobtrusive** - Nothing flashy or attention-seeking
6. **Honest** - Authentic representation
7. **Long-lasting** - Timeless approach
8. **Thorough** - Every detail considered
9. **Environmentally friendly** - Lightweight, minimal resources
10. **As little design as possible** - Every element justified

## Horror Aesthetic Elements

### Subtle, Not Overwhelming
- **Fungal growth metaphor**: Organic textures suggesting life/death
- **Decay meets technology**: Circuit boards overtaken by nature
- **Void/absence**: Deep blacks suggest infinite space
- **Emergence from darkness**: Content fades in from void
- **Spores/particles**: Floating elements suggest contamination or growth
- **Glitch artifacts**: Technology failing, entropy increasing

### Professional Balance
- Horror elements are **atmospheric**, not scary
- Creates **intrigue and uniqueness**
- Never sacrifices **readability or usability**
- Maintains **professional credibility**
- Suggests **depth, complexity, interesting character**

## Technical Implementation

### Performance
- No frameworks - vanilla JS only
- Minimal dependencies (just web fonts)
- Canvas-based particles (hardware accelerated)
- CSS animations (GPU accelerated)
- Lazy loading where appropriate

### Browser Support
- Modern evergreen browsers
- Graceful degradation
- Progressive enhancement
- Fallbacks for unsupported features

### Responsiveness
- Mobile-first approach
- Breakpoint at 900px
- Fluid typography
- Touch-friendly targets (min 44x44px)
- Simplified navigation on mobile

## File Structure

```
personal-webpage/
├── index.html          # All sections in one file
├── styles.css          # Complete design system
├── script.js           # Navigation, particles, interactions
├── manifest.json       # PWA manifest
├── artifacts/
│   ├── sigil/         # Personal sigil/logo
│   └── fungi-*.png    # Ambient textures
├── icons/             # Favicon set
└── og/                # Open Graph images
```

## Future Enhancements

- [ ] Blog CMS integration
- [ ] Project detail pages
- [ ] Dark mode toggle (darker horror variant)
- [ ] More particle interaction (mouse tracking)
- [ ] Sound design (optional, muted by default)
- [ ] Additional glitch effects (purposeful, rare)
- [ ] WebGL shader backgrounds (performance permitting)

## Inspiration Sources

### Swiss Design
- Josef Müller-Brockmann's grid systems
- Dieter Rams' "less but better"
- International Typographic Style
- Bauhaus functional clarity

### Dark Ambient Horror
- Annihilation (film) - organic meets sci-fi
- The Last of Us - fungal aesthetic
- Alien - tech decay in isolation
- Blade Runner - atmospheric noir
- Dead Space - industrial horror

---

**Result**: A personal website that is professional, readable, and usable first; uniquely atmospheric and memorable second. The horror elements create interest and personality without compromising function. The Swiss structure ensures clarity and professionalism. Together, they create something distinctive that stands out while remaining approachable and honest.
