# Design System — VolunteerReady

## Product Context
- **What this is:** Multi-tenant nonprofit SaaS platform for the full volunteer lifecycle (recruit, screen, schedule, retain)
- **Who it's for:** Primary: volunteer coordinators at small-to-mid nonprofits (20-200 volunteers). Secondary: volunteers using public apply flow and opportunity listings.
- **Space/industry:** Volunteer management (VolunteerMatch, Galaxy Digital, Civic Champs, Bloomerang, Golden)
- **Project type:** Web app (data-heavy staff dashboard + warm public-facing pages)

## Aesthetic Direction
- **Direction:** Refined Editorial — warm editorial authority meets operational precision
- **Decoration level:** Intentional — warm surface textures (cream, sand), subtle borders. No decorative illustrations, blobs, or stock photography. Warmth comes from material and color, not cartoons.
- **Mood:** Professional tool with soul. Not friendly-nonprofit, not cold-enterprise. The design team behind a great transit app decided to build volunteer management software. Operational, but never sterile. Human, but never soft.
- **Visual hero:** Product data and real UI screenshots, not stock photography. The product itself is the visual asset.
- **Reference sites:** Linear (operational precision), Golden (breaks from category norms)

## Typography
- **Display/Hero:** Fraunces 700 — editorial serif with personality. Instant distinction from the sea of rounded-sans volunteer platforms. For headlines, marketing pages, impact numbers, section titles on public pages.
- **Body/UI:** Geist 400/500/600 — clean, modern, built for interfaces. For everything operational: body text, labels, navigation, forms, tables.
- **UI/Labels:** Same as body (Geist)
- **Data/Tables:** Geist Mono — tabular-nums, dates, counts, IDs, application numbers. Gives data fields terminal authority.
- **Code:** Geist Mono
- **Loading:** Google Fonts for Fraunces (`https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700`). Vercel CDN / npm for Geist (`geist` package).
- **Scale:** 12px / 14px / 16px / 20px / 24px / 30px / 36px / 48px / 60px / 72px

## Color
- **Approach:** Restrained — deep forest green primary, warm neutrals, gold accent for warmth
- **Primary:** `#1B3C2A` — deep forest green. Confident, not pastel-nonprofit. Used for CTAs, active states, selection, sidebar.
- **Primary Hover:** `#2D5E42`
- **Primary Soft:** `rgba(27, 60, 42, 0.08)` — hover backgrounds, subtle highlights
- **Warm Accent:** `#C4A882` — burnished gold. Prevents clinical feel. Used sparingly for emphasis, badges, warmth cues.
- **Warm Accent Soft:** `#E8DCC8` — warm badge backgrounds, subtle highlights
- **Neutrals:** Warm-toned (not cool/blue grays)
  - Background: `#FAFAF8` (warm off-white, feels like good paper)
  - Surface: `#F5F4F0` (cards, panels)
  - Surface Strong: `#E8E6E1` (elevated surfaces, table headers)
  - Border: `#E8E6E1`
  - Text Primary: `#141311`
  - Text Secondary: `#3D3B38`
  - Text Muted: `#787571`
- **Semantic:**
  - Success: `#2D7A4F`
  - Warning: `#B8860B`
  - Error: `#B33A3A`
  - Info: `#2563EB`
- **Dark mode strategy:** Same hues, adjusted for dark surfaces. Reduce saturation 10-20%.
  - Background: `#111110`
  - Surface: `#1A1918`
  - Surface Strong: `#252422`
  - Border: `#2A2927`
  - Text Primary: `#E8E6E1`
  - Text Secondary: `#B5B1AB`
  - Text Muted: `#787571`
  - Primary: `#3D8B5F` (lightened for dark backgrounds)
  - Primary Hover: `#4DA672`
  - Success: `#3D8B5F`
  - Warning: `#D4A017`
  - Error: `#D35050`
  - Info: `#4B8BF5`

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Hybrid — grid-disciplined for the app dashboard, creative-editorial for marketing/public pages
- **Grid:** 12-column grid. Dashboard uses sidebar (220px) + main content. Marketing pages use asymmetric splits (7/5, 8/4).
- **Max content width:** 1120px
- **Border radius:** Hierarchical scale
  - sm: 4px (small elements, code blocks)
  - md: 8px (buttons, inputs, cards)
  - lg: 12px (panels, modals, dashboard sections)
  - full: 9999px (badges, pills, avatars)

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. No decorative animation.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)

## Anti-Patterns (never use)
- Purple/violet gradients
- 3-column feature grids with icons in colored circles
- Centered-everything layouts
- Stock photography of volunteers
- Decorative illustrations or blobs
- Gradient buttons as primary CTA
- Uniform bubbly border-radius on all elements
- Generic "Built for X" / "Designed for Y" marketing copy

## Dual Personality
The staff dashboard and volunteer-facing pages are different visual contexts:
- **Staff dashboard:** Data-dense, operational, forest green sidebar, Geist everywhere, Geist Mono for data values. Feels like a command center.
- **Public/volunteer pages:** Warmer, Fraunces headlines, more generous spacing, cream backgrounds, editorial feel. Feels like a well-designed nonprofit annual report.
- **Shared:** Same color palette, same spacing system, same border radius scale. The green anchors both worlds.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-04 | Initial design system created | Created by /design-consultation based on competitive research (VolunteerMatch, Galaxy Digital, Civic Champs, Golden, Linear) + Codex and Claude subagent outside voices. All three voices converged on editorial serif + operational sans, warm neutrals, and product data as visual hero. |
| 2026-04-04 | Fraunces chosen over DM Serif Display | More personality, variable-axis, harder to confuse with another product. Both Codex and Claude agreed on editorial serif direction. |
| 2026-04-04 | Deep forest green (#1B3C2A) over ochre gold | Green is category-appropriate (trust, growth) but differentiated by depth. Gold used as warm accent instead of primary. |
| 2026-04-04 | Warm cream backgrounds (#FAFAF8) over pure white | Reduces eye strain, signals taste, breaks from clinical SaaS white. Both outside voices recommended this. |
