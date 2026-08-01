# Design System — VolunteerReady

> **Superseded. The canonical design system is [`DESIGN.md`](../DESIGN.md) in the repo root.**
>
> This is an older fork, not a copy — the two diverge from line 4 onward, and where they
> disagree the root file is correct. Known divergences as of v0.38.4.0:
>
> | | root `DESIGN.md` | this file |
> |---|---|---|
> | Direction | Refined Editorial | Organic/Natural (below) |
> | App shell chrome | documented in full | **absent entirely** |
> | Info color | `#2563EB` | `#2A6496` |
> | Max content width | 1120px | 1280px |
> | Decisions Log | through 2026-08-01 | ends 2026-03-16 |
>
> The missing app-shell section is the specific gap that matters: correcting it in the root
> file (T34) was prompted by a stale sentence generating a whole round of wrong mockups, and
> that correction was never applied here. `CLAUDE.md` points every agent at the root file.
> This copy should be deleted and the VitePress nav pointed at the root one.

## Product Context
- **What this is:** Multi-tenant SaaS for nonprofits to recruit, screen, schedule, and credential volunteers. Also serves corporate CSR buyers and individual volunteers.
- **Who it's for:** Nonprofit directors, volunteer coordinators, corporate CSR managers, individual volunteers.
- **Space/industry:** Nonprofit tech / volunteer management. Peers: Galaxy Digital, Rosterfy, Golden, VolunteerHub, SignUpGenius.
- **Project type:** Web app + marketing site (Next.js 16, App Router).

## Aesthetic Direction
- **Direction:** Organic/Natural
- **Decoration level:** Intentional — subtle warmth through varied backgrounds and generous whitespace. No decorative SVG blobs, no floating shapes, no gradient overlays.
- **Mood:** A well-run community center. Warm, grounded, trustworthy, human. The "quality layer" for volunteer engagement should feel real and reliable, not slick or corporate. Every competitor is cold blue/purple — we are warm green and sand.
- **Reference sites:** Golden (goldenvolunteer.com) is closest in warmth. Blackbaud for enterprise trust. Avoid Galaxy Digital / Rosterfy's corporate blue template aesthetic.

## Typography
- **Display/Hero:** Fraunces — Warm, distinctive optical serif with personality. Our most differentiating visual asset. Use for h1, h2, blockquotes, and hero text. Italic variant for emphasis.
- **Body:** Geist — Clean, modern geometric sans with excellent readability. Use for all body text, descriptions, and UI labels.
- **UI/Labels:** Geist (same as body)
- **Data/Tables:** Geist with `font-variant-numeric: tabular-nums` — ensures number columns align.
- **Code:** Geist Mono
- **Loading:** Google Fonts (Fraunces), Vercel (Geist/Geist Mono via `next/font/google`). Font-display: swap. Preconnect to font CDN.
- **Scale (modular, ~1.33x ratio):**
  - h1: 48px / 3rem — bold 700, line-height 1.15, Fraunces
  - h2: 32px / 2rem — bold 700, line-height 1.2, Fraunces
  - h3: 20px / 1.25rem — semibold 600, line-height 1.3, Geist
  - h4: 16px / 1rem — semibold 600, line-height 1.4, Geist
  - body: 16px / 1rem — regular 400, line-height 1.6, Geist
  - small/caption: 14px / 0.875rem — regular 400, line-height 1.5, Geist
  - label: 12px / 0.75rem — semibold 600, uppercase tracking-widest, Geist
- **Rules:**
  - No letterspacing on lowercase body text
  - `text-wrap: balance` on all headings (h1-h3)
  - Maximum line width: 65-75 characters for body text
  - Minimum font size: 12px (labels), 16px (body)

## Color

- **Approach:** Restrained — color is rare and meaningful. Green for action, sand for warmth, neutrals for everything else.

### Primary Palette
- **Primary (forest green):** `#1B3C2A` — trust, action, growth. Used for primary CTAs, nav highlights, active states, primary badges.
- **Primary light:** `#2D5E42` — hover state for primary buttons, secondary emphasis.
- **Primary muted:** `rgba(27, 60, 42, 0.08)` — subtle backgrounds for primary-tinted sections.

### Secondary Palette
- **Sand:** `#C4A882` — warmth, humanity, approachability. Used sparingly: accent borders, secondary badges, highlight backgrounds.
- **Sand light:** `#E8DCC8` — warm background tint for alternating sections (replaces generic gray muted).
- **Sand muted:** `rgba(196, 168, 130, 0.15)` — subtle warm surface.

### Neutrals (warm gray scale)
- **50:** `#FAFAF8` — page background (very slightly warm)
- **100:** `#F5F4F0` — card backgrounds, muted surfaces
- **200:** `#E8E6E1` — borders, dividers
- **300:** `#D1CFC8` — disabled borders
- **400:** `#A8A5A0` — placeholder text
- **500:** `#787571` — muted foreground text
- **600:** `#5C5955` — secondary text
- **700:** `#3D3B38` — body text
- **800:** `#252422` — headings, primary text
- **900:** `#141311` — high-emphasis text

### Semantic Colors
- **Success:** `#2D7A4F` — approved, verified, complete
- **Warning:** `#B8860B` — review needed, pending, attention
- **Error:** `#B33A3A` — rejected, failed, destructive action
- **Info:** `#2A6496` — informational, neutral status

### Dark Mode Strategy
- Surfaces use elevation (darker = lower, lighter = higher), not simple inversion.
- Text: off-white `#E0DDD8` (warm), not pure white.
- Primary green: lighten to `#4A9B6E` for dark mode readability.
- Sand: desaturate 15% in dark mode.
- Set `color-scheme: dark` on html element.

## Spacing

- **Base unit:** 8px
- **Density:** Comfortable (marketing pages) / Compact (app UI)
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px
  - 4xl: 96px
- **Section padding (marketing pages):** Vary between py-12 (48px), py-16 (64px), py-20 (80px), and py-24 (96px) to break monotonous rhythm. Never use the same padding on consecutive sections.
- **Component spacing:** Use `gap-` utilities, not margin. Inner padding: 16-24px for cards, 8-12px for buttons.

## Layout

- **Approach:** Hybrid — grid-disciplined for app, editorial/asymmetric for marketing.
- **Grid:** 12-column at desktop, 8-column at tablet, 4-column at mobile.
- **Max content width:** 1280px (container), 768px for text-heavy sections, 1024px for card grids.
- **Border radius hierarchy:**
  - sm: 4px — inputs, small UI elements
  - md: 8px — cards, modals, larger containers
  - lg: 12px — hero cards, feature sections
  - full: 9999px — buttons, badges, avatars
- **Inner radius rule:** inner = outer - gap (nested rounded elements)
- **Marketing page layout rules:**
  - Heroes: left-aligned text (not centered) with optional right-side visual on desktop
  - Feature sections: alternate left/right layouts, not uniform grids
  - Testimonials: left-aligned blockquote, not centered card
  - CTA banners: full-width with ample vertical padding
- **Breakpoints:** mobile (375px), tablet (768px), desktop (1024px), wide (1440px)

## Motion

- **Approach:** Intentional — every animation communicates something. No decorative motion.
- **Easing:**
  - Enter: `ease-out` (element arriving — fast start, gentle stop)
  - Exit: `ease-in` (element leaving — gentle start, fast exit)
  - Move: `ease-in-out` (element repositioning)
- **Duration:**
  - Micro: 50-100ms — button press, toggle
  - Short: 150-250ms — hover states, focus rings, tooltips
  - Medium: 250-400ms — card entrance, section fade-in
  - Long: 400-700ms — page transitions, large reveals
- **Scroll-triggered animations:** Fade-in + subtle translateY(8px→0) on feature cards and content sections. Stagger siblings by 75ms.
- **Hover effects:** Cards scale to 1.01 with shadow elevation increase. Buttons darken 10%.
- **Rules:**
  - Only animate `transform` and `opacity` (never layout properties like width, height, top, left)
  - Never use `transition: all` — list properties explicitly
  - Respect `prefers-reduced-motion: reduce` — disable all motion, show content immediately
  - No animation slower than 700ms unless it's a page transition

## Interaction States

- **Hover:** All interactive elements must have a visible hover state (color shift, scale, or shadow).
- **Focus-visible:** `ring-2 ring-primary ring-offset-2` on all focusable elements. Never `outline: none` without a replacement.
- **Active/pressed:** Subtle scale-down (0.98) or darken for buttons.
- **Disabled:** `opacity-50` + `cursor-not-allowed`. Never remove the element — show it as unavailable.
- **Touch targets:** Minimum 44x44px on all interactive elements. Add padding to small links.

## AI Slop Blacklist

Never use these patterns in VolunteerReady:
- Decorative SVG blobs, floating circles, or wavy section dividers
- Icons in colored circles as section decoration
- Purple/violet/indigo gradients
- Centered-everything layouts (prefer left-aligned or mixed)
- Uniform border-radius on all elements (use the hierarchy above)
- 3-column feature grid with icon + title + description (the #1 AI tell)
- Generic hero copy ("Connect with...", "Unlock the power of...", "Your all-in-one...")
- Cookie-cutter section rhythm (every section same height/padding)
- Emoji as design elements
- Fake testimonials with made-up names

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-16 | Initial design system created | Created by /design-consultation based on competitive research (Galaxy Digital, Rosterfy, Golden, VolunteerHub). Organic/natural direction chosen to differentiate from the cold corporate blue that dominates the volunteer management space. |
| 2026-03-16 | Keep Fraunces + Geist | Fraunces is the most distinctive visual asset — no competitor uses it. Geist pairs well as a modern body font. |
| 2026-03-16 | Dark green + warm sand palette | Dark green (#1B3C2A) is already differentiating. Added sand (#C4A882) as warm secondary to replace generic gray surfaces. Warm neutral scale throughout. |
| 2026-03-16 | AI slop blacklist established | Design audit scored current site D on AI slop. Decorative blobs, icon-in-circle grids, and uniform layouts explicitly banned. |
