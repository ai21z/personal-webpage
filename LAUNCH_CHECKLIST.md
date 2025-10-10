# 🚀 Necrography — Launch Checklist

**Site:** Vissarion Zounarakis Personal Landing Page  
**Type:** Single-screen, framework-free HTML/CSS/JS  
**Status:** ✅ READY TO DEPLOY

---

## ✅ Pre-Deployment Checklist

### Content
- [x] Name: "Vissarion Zounarakis"
- [x] Bio tape line: Present and accurate
- [ ] **ACTION REQUIRED:** Update social links in `index.html`
  - Line 93: GitHub URL
  - Line 97: LinkedIn URL
  - Line 101: Email address

### Assets
- [x] All icons generated (8 files)
- [x] Open Graph image created (1200×630)
- [x] Source images preserved in `/artifacts/`
- [x] Manifest.json configured

### Code Quality
- [x] HTML validates (semantic HTML5)
- [x] CSS organized (variables, comments, PRM)
- [x] JavaScript documented (comments, performance notes)
- [x] No console errors
- [x] File size: 18.1 KB (under budget)

### Accessibility
- [x] WCAG AA contrast met (all pairs)
- [x] Keyboard navigation functional
- [x] Screen reader support (aria labels)
- [x] Skip link present
- [x] PRM implemented

### Performance
- [x] Images have explicit dimensions
- [x] No layout shift
- [x] Minimal dependencies (Google Fonts only)
- [x] Local server tested successfully

---

## 🌐 Deployment Options

### Option 1: Netlify (Recommended)
1. Push to GitHub/GitLab
2. Sign in to [Netlify](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect repository
5. Deploy settings:
   - **Build command:** (leave empty)
   - **Publish directory:** `.`
6. Click "Deploy site"
7. **Done!** Site live at `your-site.netlify.app`

### Option 2: Vercel
```bash
npm install -g vercel
vercel
```

### Option 3: GitHub Pages
1. Push to GitHub
2. Settings → Pages
3. Source: `main` branch, `/` (root)
4. Save
5. **Done!** Site live at `username.github.io/repo-name`

### Option 4: Cloudflare Pages
1. Connect GitHub repository
2. Build command: (leave empty)
3. Output directory: `/`
4. Deploy

---

## 🔧 Pre-Deploy Actions

### 1. Update Social Links
Edit `index.html` lines 88-102:

```html
<!-- Current (placeholder) -->
<a href="https://github.com/yourusername" ...>
<a href="https://linkedin.com/in/yourusername" ...>
<a href="mailto:hello@example.com" ...>

<!-- Replace with actual links -->
<a href="https://github.com/YOUR_USERNAME" ...>
<a href="https://linkedin.com/in/YOUR_USERNAME" ...>
<a href="mailto:YOUR_EMAIL@example.com" ...>
```

### 2. Update README.md Author Section
Edit `README.md` lines 347-353:

```markdown
- GitHub: [yourusername](https://github.com/yourusername)
- LinkedIn: [yourusername](https://linkedin.com/in/yourusername)
- Email: hello@example.com
```

### 3. Optional: Custom Domain
After deploying to Netlify/Vercel:
1. Buy domain (Namecheap, Cloudflare, etc.)
2. Add custom domain in hosting dashboard
3. Update DNS records (A/CNAME)
4. Wait for SSL certificate (~5 minutes)

---

## 📊 Post-Deploy Validation

### Lighthouse Audit
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit (replace URL)
lighthouse https://your-site.netlify.app --view
```

**Target scores:**
- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

### Test Checklist
- [ ] Open site on desktop
- [ ] Open site on mobile
- [ ] Test sigil click/rotation
- [ ] Test keyboard navigation (Tab, Enter, Space)
- [ ] Test skip link
- [ ] Verify tape line animation
- [ ] Test prefers-reduced-motion (DevTools)
- [ ] Check Open Graph preview (Twitter, LinkedIn)
- [ ] Test all social links
- [ ] Verify icons in browser tabs

---

## 🐛 Troubleshooting

### Icons not loading
- Check paths in `index.html` are correct
- Verify `/icons/` folder deployed
- Clear browser cache

### Animations not working
- Check browser console for errors
- Verify JavaScript loaded
- Test in different browser

### Contrast issues
- All colors tested and meet WCAG AA
- If adjusting colors, use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Layout broken on mobile
- Test `100svh` fallback
- Check viewport meta tag present
- Verify responsive grid (900px breakpoint)

---

## 📱 Testing Devices

### Recommended
- Desktop: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Chrome Android
- Tablet: iPad Safari

### Viewport Sizes to Test
- Mobile: 375×667 (iPhone SE)
- Mobile: 390×844 (iPhone 14)
- Tablet: 768×1024 (iPad)
- Desktop: 1920×1080

---

## 🔒 Security Headers (Optional)

After deploying, add these headers in your hosting provider:

```
# Netlify (_headers file)
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

# Cloudflare Pages (same format)
```

---

## 📈 Analytics Setup (Optional)

### Privacy-Respecting Options
1. **Plausible** (plausible.io) — GDPR compliant, no cookies
2. **Fathom** (usefathom.com) — Simple, privacy-first
3. **Cloudflare Analytics** — Built-in if using CF Pages

Add tracking script before `</head>`:
```html
<!-- Example: Plausible -->
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

---

## ✅ Final Checks Before Going Live

- [ ] Social links updated
- [ ] Email address updated
- [ ] README.md author section updated
- [ ] Tested on desktop
- [ ] Tested on mobile
- [ ] All animations working
- [ ] Keyboard navigation tested
- [ ] Lighthouse score >90
- [ ] Open Graph preview verified
- [ ] Custom domain configured (if applicable)
- [ ] Analytics added (if desired)

---

## 🎉 You're Ready!

Once all checks pass:

1. **Deploy** to your chosen platform
2. **Share** your link on social media
3. **Monitor** analytics (if enabled)
4. **Iterate** based on feedback

---

## 📞 Support Resources

- **HTML/CSS Issues:** [MDN Web Docs](https://developer.mozilla.org/)
- **Accessibility:** [WCAG Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- **Hosting Support:**
  - [Netlify Docs](https://docs.netlify.com/)
  - [Vercel Docs](https://vercel.com/docs)
  - [GitHub Pages Docs](https://docs.github.com/en/pages)

---

**Built:** October 10, 2025  
**Framework:** None (vanilla HTML/CSS/JS)  
**Dependencies:** Google Fonts (Xanh Mono) only  
**Size:** 18.1 KB (HTML+CSS+JS)

🖤 **Good luck with your launch!**
