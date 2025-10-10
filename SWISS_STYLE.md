# ✅ Swiss International Style + Dieter Rams Design

## Design Principles Applied

### International Typographic (Swiss) Style
✅ **Grid System** — 12-column grid with 8px base unit  
✅ **Mathematical Precision** — All spacing based on multiples of 8px  
✅ **Clarity** — Left-aligned text, clear hierarchy  
✅ **Sans-serif Typography** — Xanh Mono (monospace) maintained  
✅ **Whitespace** — Generous spacing (48px gaps)  
✅ **Asymmetric Balance** — Text left (cols 1-6), Sigil right (cols 8-12)  

### Dieter Rams' "Less, but Better"
✅ **Honest** — No decorative effects, content speaks for itself  
✅ **Unobtrusive** — Subtle animations, minimal hover effects  
✅ **Useful** — Every element serves a clear purpose  
✅ **Thorough** — Consistent spacing system throughout  
✅ **Long-lasting** — Timeless grid-based layout  
✅ **Minimal** — Removed unnecessary transforms and effects  

---

## Technical Implementation

### Swiss Grid System (8px Base Unit)

```
Root Variables:
--unit: 8px              (base unit)
--gap: 24px              (3 units)
--gap-small: 16px        (2 units)
--gap-large: 48px        (6 units)
```

### Typography Scale (Modular)

```
--text-xs: 14px          (footer)
--text-sm: 16px          (unused reserve)
--text-base: 18px        (body, bio text)
--text-lg: 24px          (unused reserve)
--text-xl: 32px          (mobile name)
--text-2xl: 48px         (desktop name)
--text-3xl: 64px         (unused reserve)
```

### Line Heights

```
--leading-tight: 1.25    (name)
--leading-normal: 1.5    (body, footer)
--leading-relaxed: 1.75  (bio text for readability)
```

---

## Grid Layout

### Desktop (>900px)

```
┌─────────────────────────────────────────────────────────┐
│ Name (cols 1-12, row 1)                                 │
│ [with subtle bottom border]                             │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│ Text Column (cols 1-6)       │   Sigil (cols 8-12)      │
│ ├─ Bio text                  │   [240×240px]            │
│ └─ Social icons              │   [centered in columns]  │
│    [GitHub, GitLab,          │                          │
│     LinkedIn, Email]         │                          │
│                              │                          │
├──────────────────────────────┴──────────────────────────┤
│ Footer (cols 1-12, row 3)                               │
│ [with subtle top border]                                │
└─────────────────────────────────────────────────────────┘
```

**Key Spacing:**
- Padding: 48px all around
- Gap between rows: 48px
- Gap between elements in text column: 24px
- Gap between social icons: 16px

### Mobile (<900px)

```
┌────────────────────┐
│ Name (row 1)       │
├────────────────────┤
│ Text Column (row 2)│
│ ├─ Bio             │
│ └─ Icons           │
├────────────────────┤
│ Sigil (row 3)      │
│ [180×180px]        │
├────────────────────┤
│ Footer (row 4)     │
└────────────────────┘
```

---

## Swiss Style Elements

### 1. Mathematical Grid
- **12-column system** (industry standard)
- Text occupies columns 1-6 (50% of content width)
- Sigil occupies columns 8-12 (with breathing room in col 7)
- Perfect for asymmetric Swiss balance

### 2. Consistent Spacing
All spacing follows 8px base unit:
```css
8px  → --unit
16px → --gap-small (icons)
24px → --gap (general)
48px → --gap-large (major sections)
```

### 3. Typography Hierarchy
```
Name:    48px / 1.25 leading (clear focal point)
Body:    18px / 1.75 leading (comfortable reading)
Footer:  14px / 1.5 leading  (subtle, unobtrusive)
```

### 4. Alignment
- **Left-aligned text** (Swiss standard, not centered)
- **Left-aligned name** (with full-width border)
- **Left-aligned footer** (consistent with name)
- Only the sigil is centered within its grid area

### 5. Borders
- Subtle borders (10% opacity) to define sections
- Top and bottom borders create visual rhythm
- Clean separation without heavy lines

---

## Dieter Rams Principles

### "As Little Design as Possible"

#### Removed:
- ❌ Excessive hover transforms (`translateY`, `scale(1.05)`)
- ❌ Complex animations
- ❌ Drop shadows on icons
- ❌ Decorative effects

#### Kept Simple:
- ✅ Subtle opacity changes on hover (0.7 → 1.0)
- ✅ Minimal scale on sigil hover (1.0 → 1.02)
- ✅ Clean 1px focus outlines
- ✅ Honest representation of content

### "Good Design is Unobtrusive"

- Footer opacity: 0.4 (recedes into background)
- Icon opacity: 0.7 (present but not demanding)
- Borders: 5-10% opacity (structure without noise)
- Animations: 3s ease (slow, subtle)

### "Good Design is Useful"

Every element serves a purpose:
- **Name** → Identity
- **Bio text** → Context
- **Social icons** → Connection
- **Sigil** → Interactive element / branding
- **Footer** → Attribution

No decorative elements. No flourishes. Only function.

---

## Changes Made

### Grid System
```css
Before: grid-template-columns: 1fr 1fr;
After:  grid-template-columns: repeat(12, 1fr);
```

### Name
```css
Before: centered, variable size, no structure
After:  left-aligned, 48px, subtle bottom border
```

### Text Column
```css
Before: grid-column: 1; justify-self: end;
After:  grid-column: 1 / 7; justify-self: start;
```

### Sigil
```css
Before: 35vmin (variable), place-self: center
After:  240px (fixed), grid-column: 8 / -1
```

### Footer
```css
Before: position: absolute; text-align: center;
After:  grid-row: 3; text-align: left; border-top
```

### Social Icons
```css
Before: gap: 14px; width: 28px;
After:  gap: 16px (2 units); width: 24px (3 units);
```

---

## Performance

| Metric | Value |
|--------|-------|
| **HTML** | 4.94 KB |
| **CSS** | 6.40 KB |
| **JS** | 3.69 KB |
| **Total** | 15.03 KB |

Slightly larger (+1 KB CSS) due to explicit grid definitions, but gains:
- Mathematical precision
- Better responsiveness
- Professional alignment
- Scalable system

---

## Visual Characteristics

### Swiss Style Achieved
- ✅ Clean left alignment
- ✅ Asymmetric balance (60/40 split)
- ✅ Mathematical spacing
- ✅ Clear hierarchy
- ✅ Generous whitespace
- ✅ Structured grid

### Rams' Principles Achieved
- ✅ Honest materials (no fake effects)
- ✅ Unobtrusive (subtle animations)
- ✅ Functional (every element has purpose)
- ✅ Minimal (removed excess)
- ✅ Thorough (consistent 8px system)
- ✅ Long-lasting (timeless grid layout)

---

## Testing

Server: `http://127.0.0.1:8080`

**Verified:**
- ✅ 12-column grid active
- ✅ Left-aligned content
- ✅ Mathematical spacing (8px base)
- ✅ Subtle borders
- ✅ Clean typography scale
- ✅ Responsive breakpoint (<900px)
- ✅ Footer in grid (row 3)

---

## Comparison

### Before (Centered Layout)
- Centered name
- Vague alignment
- Variable spacing
- Absolute positioned footer
- No clear grid structure

### After (Swiss Style)
- Left-aligned system
- 12-column mathematical grid
- 8px base unit spacing
- Grid-integrated footer
- Professional asymmetric balance

---

## Philosophy Summary

> "Weniger, aber besser" (Less, but better) — Dieter Rams

The design now embodies:
1. **Clarity** through alignment and hierarchy
2. **Honesty** through minimal effects
3. **Usefulness** through purposeful elements
4. **Precision** through mathematical spacing
5. **Restraint** through subtle interactions

**Result:** A professional, timeless, functional layout that respects both Swiss typographic tradition and Rams' industrial design principles.
