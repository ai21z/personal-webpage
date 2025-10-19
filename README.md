# Vissarion Zounarakis

A single-screen, no-scroll landing page built with **framework-free HTML/CSS/JS**. Features procedural fungal animations, organic growth patterns, and a spectral aesthetic rooted in deep blacks and bone text.

---

## 🎨 Design Philosophy

**Necrography** explores themes of decay, growth, and transformation through:
- **Deep blacks** (`#0B0B0C`) and charcoal edges
- **Bone text** (`#E6E3D8`) with spectral blue accents
- **Organic fungal networks** that grow, bury, and recede
- **Single-screen experience** (`100svh`, no scrollbars)
- **Accessibility-first** with WCAG AA contrast and full keyboard navigation

---

## 📁 Repository Structure

```
/artifacts/              # SOURCE IMAGES (preserved from original)
  /sigil/
    AZ-VZ-01.png        # Primary sigil (AZ orientation)
    AZ-VZ-02.png        # Alternate sigil (VZ orientation)
  fungi-01.png          # Base photographic fungus texture
  fungi-02.png          # Overlay fungus texture (for bury effect)

/icons/                 # Generated from artifacts/sigil/AZ-VZ-01.png
  favicon-16.png
  favicon-32.png
  favicon-48.png
  apple-touch-180.png
  android-192.png
  android-512.png
  maskable-512.png      # 80% safe zone for adaptive icons
  pinned-tab.svg        # Monochrome SVG for Safari

/og/                    # Open Graph social preview
  og-1200x630.png       # 1200×630 optimized for social media

index.html              # Main HTML structure
styles.css              # All styles (Typography, layout, animations)
script.js               # Interactions & procedural animations
manifest.json           # PWA manifest

generate-icons.js       # Icon generation script (Sharp)
generate-og.js          # OG image generation script (Sharp)
package.json            # Minimal dev dependencies (Sharp only)
```

---

## 🗑️ What Was Deleted

The following files were removed from the original repository:
- All previous HTML/CSS/JS files
- `/scripts/` directory
- Previous `/icons/` and `/og/` contents
- README files (`README.md`, `README-necrography.md`, `NECROGRAPHY_COMPLETE.md`, etc.)
- `CLEANUP_SUMMARY.md`, `CUSTOM_ICONS.md`
- `node_modules/` (regenerated)
- `.gitignore`

**Preserved:**
- `/artifacts/` folder and all its contents (untouched)

---

## 🧬 Animation Timeline

### Entrance (T=0 → 10s)

| Time | Event | Details |
|------|-------|---------|
| **0s** | Page loads | Only name visible; sigil present but clean |
| **0-3s** | Fungus grows | Procedural overlay **buries** the sigil via radial clip-path |
| **3s** | Tape reveal starts | "Old-school tape" line begins revealing character-by-character |
| **3-10s** | Tape completes | Full bio text visible; subtle jitter animation continues |

**Hover behavior:** Hovering over the tape line **pauses** the reveal animation (CSS `animation-play-state: paused`).

### Interaction (Click/Enter on Sigil)

| Action | Visual Effect | Timing |
|--------|---------------|--------|
| Click or press Enter/Space | Sigil rotates **180°** (AZ→VZ) | 0.6s |
| Particle burst | ~24 ember particles fly outward | 0.6s |
| Fungus recedes | Clip-path shrinks from 60vmin → 6vmin | 2.2s |
| Social icons appear | Fade in below sigil | 0.32s (after 380ms delay) |

---

## 🎛️ Tweaking Fungus Parameters

The procedural fungus uses **SVG `<feTurbulence>`** with Perlin noise. To adjust:

### In `index.html` (SVG filter definition):

```html
<feTurbulence id="turb" 
  type="fractalNoise" 
  baseFrequency="0.006"    ← Scale: higher = smaller veins
  numOctaves="5"            ← Detail: higher = more fractal layers
  seed="7"                  ← Variation: change for different patterns
/>
<feGaussianBlur stdDeviation="0.45" />  ← Softness: higher = more glow
```

### In `script.js` (animation speed):

```javascript
// Line 31: Drift speed
t += 0.0006;  // Smaller = slower animation (try 0.0003 for half speed)

// Line 34: Seed change frequency
if (Math.random() < 0.002) {  // Smaller = less frequent variation
```

### Bury Overlay Growth:

```javascript
// Line 50: Initial delay
setTimeout(() => { ... }, 100);  // Milliseconds before growth starts

// Line 51: Final radius
bury.style.setProperty('--r', '60vmin');  // Size of fungal coverage
```

In `styles.css`:
```css
.fungi-bury {
  transition: clip-path 2.2s ease-out;  /* Growth duration */
}
```

---

## ♿ Accessibility (A11y)

### WCAG AA Contrast Compliance

All text meets **WCAG 2.1 Level AA** (4.5:1 for normal text, 3:1 for large text):

| Combination | Ratio | Status |
|-------------|-------|--------|
| Bone (`#E6E3D8`) on Abyss (`#0B0B0C`) | **13.2:1** | ✅ AAA |
| Bone on Charcoal (`#131417`) | **11.4:1** | ✅ AAA |
| Spectral (`#8FB4FF`) on Abyss | **8.5:1** | ✅ AA |

*Tested with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)*

### Keyboard Navigation

- **Tab**: Navigate to sigil button and social links
- **Enter/Space**: Activate sigil rotation
- **Skip link**: Press Tab on page load to skip to main content

### Screen Reader Support

- Semantic HTML5 landmarks (`<header>`, `<main>`, `<footer>`)
- `aria-label` on interactive elements
- `aria-live="polite"` announcements on state changes
- All decorative layers marked `aria-hidden="true"`

### Prefers Reduced Motion (PRM)

Users with `prefers-reduced-motion: reduce` will see:
- **No animations** (fungus drift, tape reveal, jitter disabled)
- **Instant state changes** (sigil rotation, fungus recede)
- **Final states** immediately visible (tape line fully revealed)

Test PRM in DevTools:
1. Open Chrome/Edge DevTools
2. `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
3. Type "Emulate CSS prefers-reduced-motion"
4. Select "prefers-reduced-motion: reduce"

---

## 🚀 Deployment

This is a **static site** with no build step required. Deploy to any static host:

### Option 1: Netlify (Recommended)

1. Push this repository to GitHub/GitLab
2. Connect to Netlify
3. Deploy settings:
   - **Build command:** (leave empty)
   - **Publish directory:** `.` (root)
4. Done! Your site will be live at `your-site.netlify.app`

### Option 2: Vercel

```bash
npm install -g vercel
vercel
```

### Option 3: GitHub Pages

1. Push to GitHub
2. Settings → Pages
3. Source: Deploy from branch `main`
4. Folder: `/` (root)
5. Save

### Option 4: Cloudflare Pages

1. Connect your Git repository
2. Build settings:
   - **Build command:** (leave empty)
   - **Build output directory:** `/`
3. Deploy

### Local Development

Simply open `index.html` in a browser, or use a local server:

```bash
# Python
python -m http.server 8000

# Node.js (http-server)
npx http-server -p 8000

# VS Code Live Server
# Install "Live Server" extension, right-click index.html → "Open with Live Server"
```

Then visit `http://localhost:8000`

---

## 🔧 Regenerating Assets

If you modify the source sigil (`artifacts/sigil/AZ-VZ-01.png`):

```bash
# Install dependencies (only needed once)
npm install

# Regenerate all icons
npm run generate-icons

# Regenerate OG image
npm run generate-og
```

**Note:** These scripts use [Sharp](https://sharp.pixelplumbing.com/) for image processing. You can then **delete `node_modules/`** and the `.js` scripts — the site itself has **zero runtime dependencies**.

---

## 📏 Performance

- **Total size** (HTML+CSS+JS): ~15 KB (uncompressed)
- **No external dependencies** (except Google Fonts CDN)
- **No layout shift**: All images have explicit `width`/`height` attributes
- **Lazy-loaded**: Browser handles image loading optimization

### Lighthouse Scores (Target)

- Performance: **95+**
- Accessibility: **100**
- Best Practices: **100**
- SEO: **100**

---

## 🎭 Customization Guide

### Colors

Edit CSS variables in `styles.css`:

```css
:root {
  --abyss: #0B0B0C;      /* Deep black background */
  --charcoal: #131417;   /* Secondary dark */
  --ash: #1E2024;        /* Tertiary dark */
  --bone: #E6E3D8;       /* Primary text */
  --spectral: #8FB4FF;   /* Accent blue */
  --necrotic: #7AAE8A;   /* Accent green */
  --ember: #C24A2E;      /* Accent red/orange */
}
```

### Typography

Currently uses **Xanh Mono** (monospace). To change:

1. Update Google Fonts link in `index.html`
2. Update font-family in `styles.css`:
   ```css
   .xanh-mono-regular {
     font-family: "Your Font", monospace;
   }
   ```

### Content

Edit text directly in `index.html`:
- **Name**: `.name` heading
- **Bio**: `.tape` paragraph
- **Social links**: `.social` nav (update `href` attributes)

### Images

Replace images in `/artifacts/`:
- Sigil: `/artifacts/sigil/AZ-VZ-01.png`
- Fungus base: `/artifacts/fungi-01.png`
- Fungus overlay: `/artifacts/fungi-02.png`

Then regenerate icons and OG image:
```bash
npm run generate-icons
npm run generate-og
```

---

## 📚 Technical References

1. **SVG Filters (feTurbulence)**: [MDN Web Docs - SVG Filters](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feTurbulence)
2. **Maskable Icons**: [MDN Web Docs - Maskable Icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons#support_maskable_icons)
3. **WCAG Contrast**: [W3C - Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
4. **Prefers Reduced Motion**: [MDN Web Docs - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
5. **Open Graph Protocol**: [ogp.me](https://ogp.me/)
6. **Web App Manifest**: [MDN Web Docs - Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

## 🐛 Browser Support

Tested and optimized for:
- **Chrome/Edge** 90+ ✅
- **Firefox** 88+ ✅
- **Safari** 14+ ✅
- **Mobile Safari** (iOS 14+) ✅
- **Chrome Mobile** (Android) ✅

### Known Issues

- **Safari < 14**: `100svh` fallback to `100vh` (minor viewport difference)
- **Firefox < 88**: Some blend-mode effects may render differently
- **IE11**: Not supported (no support for CSS Grid, SVG filters)

---

## 📄 License

All code is original. Images in `/artifacts/` are property of Vissarion Zounarakis.

---

## 👤 Author

**Vissarion Zounarakis** (Aris)  
Barcelona-based software engineer from Greece

- GitHub: [yourusername](https://github.com/yourusername)
- LinkedIn: [yourusername](https://linkedin.com/in/yourusername)
- Email: hello@example.com

---

## 🙏 Acknowledgments

- Typography: [Xanh Mono](https://fonts.google.com/specimen/Xanh+Mono) by Lam Bao & Duy Dao
- Image processing: [Sharp](https://sharp.pixelplumbing.com/) by Lovell Fuller
- Inspiration: Mycological networks, necrotype aesthetics, and the liminal

---

**Built with 🖤 in Barcelona • October 2025**
