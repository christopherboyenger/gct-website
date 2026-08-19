# Golf Creator Tour — marketing site

Static, dependency-free landing page (HTML + CSS + vanilla JS) for **Golf Creator
Tour (GCT)** — the marketing & competitive ecosystem for golf creators. Content
and positioning follow the GCT investor business plan (Aug 2026), §9.2 external
positioning framework.

## Run locally

```bash
python -m http.server 5500
```

Then open http://127.0.0.1:5500/ (any static server works).

## Structure

```
index.html          # single-page layout
css/styles.css      # design tokens, components, responsive rules
js/main.js          # navbar, mobile menu, hero slider, marquees, scroll reveal, stat count-up
assets/
  logo.png          # official "The Golf Creator Tour" lockup, white on transparent (nav + footer)
  logo-navy.png     # official lockup on navy (source file)
  gco-logo.png      # "The Golf Creator Open" lockup (Open banner)
  favicon.png
  photos/           # Golf Creator Open event photos (hero backgrounds, video cards, gallery, CTA)
  brands/           # partner logos from J:\Downloads\Brand Logos (+ PGA National) for the marquee
  brands-visual.svg, creators-visual.svg, tour-card.svg   # illustrated mockups
```

## Page sections (top → bottom)

1. Fixed navbar — Creators / Brands / Solutions dropdowns, The Open, About; CTAs (Book Strategy Call, Join the Tour, Login)
2. Hero slider — 3 slides: ecosystem / for brands / for creators
3. Brands & partners marquee
4. Stats strip — production operating snapshot (240 active creators, 82% completion, 1,685 posts, 10.8M verified views)
5. What We Do — split "For Brands" / "For Creators" with app-store badges
6. The Season — 4-step timeline + Golf Creator Open banner (Oct 2–4, 2026, PGA National)
7. The GCT Value Add — 4 benefit cards (light band)
8. Our Work — 9 campaign-format tiles
9. Solutions — Courses & Destinations / Agencies / Sponsors
10. Tour Membership — gold metal Tour Card
11. CTA banner — "Ready to join the Tour?"
12. Footer — Contact, Discover, Company, Connect, On Tour, legal

## Customising

- **Logo:** `assets/logo.png` is the official lockup (derived from
  `J:\Downloads\The Golf Creator Tour logo.png`). Nav height is set by `--nav-h`.
- **Colors / fonts:** edit the `:root` tokens at the top of `css/styles.css`
  (`--bg`, `--slate`, `--light`, `--gold`, `--font-display`, `--font-body`).
- **Stats:** edit the `data-count` / `data-suffix` attributes on `.stat-num` in
  `index.html`; the count-up animation reads them.
- **Marquee logos:** add/remove `.logo-tile` entries in `index.html`; drop new
  files in `assets/brands/`. The marquee duplicates its track automatically.
- **Hero / CTA photos:** set in CSS — `.hero-slide:nth-child(n)` and `.cta-bg`.
  Gallery photos are the `<img>` tags inside `.tile` in `index.html`.
- **Links:** buttons currently point at `#cta` / `#`; wire them to the app's
  signup, login and booking URLs.
- **Tour Card sample name/number:** edit the `<text>` nodes in `assets/tour-card.svg`.
