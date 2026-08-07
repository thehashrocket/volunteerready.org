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
- **Loading:** Google Fonts for Fraunces (`https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700`). Vercel CDN / npm for Geist (`geist` package). Use `font-display: swap` and preconnect to the font CDN — a display serif that blocks first paint costs more than the FOUT it avoids.
- **Scale:** 12px / 14px / 16px / 20px / 24px / 30px / 36px / 48px / 60px / 72px
- **Rules:**
  - `text-wrap: balance` on headings (h1–h3)
  - Body line length 65–75 characters
  - Minimum 12px for labels, 16px for body text — never smaller
  - No letterspacing on lowercase body text

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
  Surfaces read as elevation (darker = lower, lighter = higher), not a straight inversion.
  Set `color-scheme: dark` on the html element so native controls, scrollbars and form
  widgets follow — without it they render light against a dark page.
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
- **Density:** Comfortable (public/marketing) / Compact (staff app)
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px) 4xl(96px)
- **Section padding (public pages):** vary between `py-12`/`py-16`/`py-20`/`py-24`. Never the
  same padding on two consecutive sections — uniform rhythm is on the anti-pattern list below.
- **Component spacing:** use `gap-` utilities rather than margins. Card inner padding 16–24px,
  button padding 8–12px.

## Layout
- **Approach:** Hybrid — grid-disciplined for the app dashboard, creative-editorial for marketing/public pages
- **Grid:** 12-column grid. Dashboard uses sidebar (224px, `w-56`) + main content. Marketing pages use asymmetric splits (7/5, 8/4).
- **Public/marketing page rules:**
  - Heroes are left-aligned, not centered, with an optional right-side visual on desktop
  - Feature sections alternate left/right rather than repeating one uniform grid
  - Testimonials are a left-aligned blockquote, never a centered card
  - CTA banners run full-width with generous vertical padding
- **Max content width:** 1120px
- **App shell chrome** (`src/components/app/app-shell.tsx`) — the authenticated staff layout:
  - **Top bar:** 56px (`h-14`), sticky, `border-b border-border/60`, `bg-background/95` with
    `backdrop-blur-sm`. Two clusters, `justify-between`. Left: the 44px mobile nav toggle
    (`lg:hidden`), the `V` mark + **wordmark**, `OrgSwitcher`, `CompanySwitcher`. Right:
    theme toggle, notification bell, account menu.
  - **The top bar's shrink contract is load-bearing, not styling.** The left cluster is
    `min-w-0` and the right is `shrink-0`: the left is the side that gives. Without
    `min-w-0` a flex child's `min-width: auto` floor is its content width, so the cluster
    refuses to shrink and pushes the account menu off the right edge — ~22px at 375px and
    **~126px in the 768-1023px band**, where the wordmark and both switchers render beside
    a toggle that is still `lg:hidden`. The switchers truncate themselves correctly already;
    nothing they do helps while their parent cannot shrink. Both switchers also carry
    explicit width caps.
  - **The wordmark is hidden below `sm`** (`hidden … sm:inline`), not truncated: it is the
    widest unshrinkable node in the cluster, and "Volunt…" is a worse answer than the `V`
    mark alone, which already identifies the app.
  - `PageHeader` carries the same `min-width: auto` fix (`min-w-0 flex-wrap`), so a heading
    with a filter and a button beside it wraps instead of pinning them to the edge.
  - **Sidebar:** 224px (`w-56`), **no background fill**. It sits on the page background,
    separated only by a `border-r border-border/60` hairline, sticky below the top bar.
  - **Active nav item:** `bg-primary/10 text-primary border-l-2 border-primary`
    (`app-sidebar.tsx:106`). This is the only place green appears in the chrome.
  - **Below `lg`:** the sidebar becomes an overlay drawer, same 224px width, `bg-background`.
  - **Ambient notice strip** (`src/components/app/app-update-prompt.tsx`) — a full-width
    band between the top bar and `<main>`, for app-level state that is worth telling a
    coordinator about but is not worth blocking them over. Currently one instance: the
    version-update notice.
    - **Surface:** `bg-accent/10` (warm gold, soft), `border-b border-border/60`,
      `px-4 py-3`, **no radius, no shadow** — it is a band, not a card. `referral-prompt.tsx`
      already uses this tint for an ambient non-urgent notice, so this is existing
      vocabulary rather than a new one. `bg-primary/5` is **not** available: green is
      reserved for active nav state and CTAs, so a green band competes with the sidebar's
      active item.
    - **Contents:** a `h-5 w-5 text-primary` lucide icon, **one line** of 16px body copy,
      then the actions. No title — a bold title stacked over a body sentence inside a 48px
      band reads as a squashed card, which is what both outside voices proposed and why
      this rule is written down.
    - **The copy leads with the REASON, not the event.** "VolunteerReady has been updated"
      names something the user cannot weigh; the strip renders the release's authored
      summary (`src/server/domain/release-notes.ts`) instead, and falls back to the generic
      sentence only when a release has no note or the user rolled backwards. The
      unsaved-work warning stays either way — it is the only thing between the primary
      action and someone's half-typed form.
    - **Additional items are COUNTED, never listed** ("Plus 3 more updates."). A list is
      the stacked block the one-line rule above forbids, and it is the shape this band
      degrades into first. The count includes what the server's wire cap dropped, so a
      coordinator ten releases behind is never told there was one other change.
    - **Actions:** `h-11` buttons, secondary (`ghost`) before primary. The dismissive
      action is named for what it does (`Not now`, not `Dismiss`) and must not read as
      weaker than the primary — the same weighting rule as `Not mine` / `Add to my account`
      on the claim surface.
    - **In flow, never `fixed` or sticky.** It scrolls away. A band that follows you down
      the page is closer to a modal than a notice, and a sticky one costs 48px on every
      screen on top of the 56px top bar. This is only safe when the notice has a **second,
      permanent home** — for the update notice that is the account-menu item, so scrolling
      past the band is not losing it. **A strip with no second home must not use this
      pattern.**
    - **The copy needs a real `min-width`, not `min-w-0`.** With `min-w-0` the paragraph's
      min-content contribution is zero, so `flex-wrap` never fires: `shrink-0` actions keep
      their row and the sentence is squeezed into a ~120px column that wraps over eight
      lines at 375px. **Every horizontal-overflow assertion passes throughout**, because
      nothing leaves the viewport. Use `min-w-56 flex-1` and assert the copy's rendered
      width separately — per the breakpoints note above, a document-level check is
      necessary and not sufficient.
    - **Order is fixed:** `ImpersonationBanner` → top bar → notice strip → `<main>`. The
      impersonation banner is a live security-state warning and must never sit below a
      software-update notice; its `bg-warning/15` is deliberately distinct from this
      strip's `bg-accent/10` so two stacked bands do not read as one confused alert block.
    - **It latches.** Suppression (e.g. while a modal is open) gates the transition *into*
      visible, never the render. Unmounting an already-visible strip makes every row behind
      the overlay jump 48px and back on close — worse than the interruption the suppression
      prevents.
    - **The live region mounts EMPTY and keeps its line.** A region inserted into the DOM
      in the same commit as its first text is unreliably announced, so the first notice —
      the one that proves the surface works — is the one most likely to be silent. `hidden`
      or `empty:hidden` reintroduces the bug, since `display: none` removes it from the
      accessibility tree.
- **Border radius:** Hierarchical scale
  - sm: 4px (small elements, code blocks)
  - md: 8px (buttons, inputs, cards)
  - lg: 12px (panels, modals, dashboard sections)
  - full: 9999px (badges, pills, avatars)
  - **Inner radius rule:** a nested rounded element is `outer − gap`, never the same radius
    as its container.
- **Breakpoints:** Tailwind defaults — `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.
  `lg` is the one that carries meaning here: it is where every staff list switches between
  its table and card shapes, and where the sidebar becomes an overlay drawer.
  - **The 768–1023px band is the load-bearing viewport for layout bugs, not 375px.** It is
    where the widest chrome renders (wordmark + both switchers) beside a nav toggle that is
    still `lg:hidden`. The app shell was 126px over at 800px against 22px at 375px — anyone
    checking a chrome fix on a phone alone will read the real bug as a rounding error.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension. No decorative animation.
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms, page
  transitions and large reveals only). Nothing animates longer than 700ms.
- **Animate `transform` and `opacity` only** — never layout properties (width, height, top,
  left), which force layout on every frame.
- **Prefer explicit transition property lists** to `transition-all`, so a later style change
  cannot silently start animating layout. ⚠️ **Not universally held:** `transition-all` is the
  shadcn baseline and still appears in ~19 components including `ui/button.tsx`. Treat this as
  the rule for new and touched code, not as a description of the current tree.
- **`prefers-reduced-motion: reduce` is handled globally** at `src/app/globals.css:216`, which
  clamps every animation and transition to 0.01ms. New motion inherits the suppression for
  free — but anything driven by JS (a count that tweens, a staggered reveal) does not, and has
  to check the query itself.
- **Scroll-triggered reveals:** fade + `translateY(8px→0)`, siblings staggered ~75ms. Never on
  above-the-fold content — `FadeInOnScroll` holds children at `opacity-0` until an
  IntersectionObserver reports 15% visibility, which never fires on short viewports, so a
  `priority` LCP image gets preloaded and then painted invisible.

## Interaction States
- **Hover:** every interactive element needs a visible hover state — color shift, elevation,
  or scale. Cards lift ~1.01; buttons darken.
- **Focus-visible:** `focus-visible:ring-ring/50 focus-visible:ring-[3px]` against the `--ring`
  token (`ui/button.tsx:8` is the reference). Never `outline: none` without a replacement.
  ⚠️ **Aspiration, not a description.** The older `ring-2 … ring-offset-2` shape is still the
  MAJORITY in the tree — 18 call sites against 6 for `ring-[3px]`, including
  `ui/checkbox.tsx`, `ui/input.tsx`, `ui/select.tsx` and `public-header.tsx`. Both give a
  visible focus ring, so this is a consistency debt, not an a11y bug. Use the token form for
  new and touched code; do not read this line as a claim the app is uniform.
- **Active/pressed:** subtle darken or scale to 0.98.
- **Disabled:** `opacity-50` plus a non-interactive cue. `ui/button.tsx` uses
  `pointer-events-none`; the form primitives (`input`, `select`, `textarea`, `checkbox`,
  `switch`, `radio-group`, `label`, `command` — 8 files) use `cursor-not-allowed`. Both are
  live and correct: `cursor-not-allowed` still shows a cursor cue on a natively-disabled
  field, which `pointer-events-none` suppresses. Match the primitive you are near rather
  than converting one to the other. Either way, show the control as unavailable rather than
  removing it — a control that vanishes mid-task reads as a broken page.
- **Touch targets:** minimum 44×44px (`h-11`) on every interactive element; pad small links up
  to it. This is enforced in the staff card lists and asserted in the mobile e2e specs.

## Anti-Patterns (never use)
- Purple/violet/indigo gradients
- 3-column feature grids with icons in colored circles (the single strongest AI tell)
- Icons in colored circles as section decoration, anywhere
- Centered-everything layouts
- Stock photography of volunteers
- Decorative illustrations, SVG blobs, floating shapes, or wavy section dividers
- Gradient buttons as primary CTA
- Uniform bubbly border-radius on all elements
- Cookie-cutter section rhythm — every section the same height and padding
- Emoji as design elements
- Fake testimonials with invented names
- Generic hero/marketing copy ("Built for X", "Designed for Y", "Connect with…",
  "Unlock the power of…", "Your all-in-one…")

## Dual Personality
The staff dashboard and volunteer-facing pages are different visual contexts:
- **Staff dashboard:** Data-dense, operational, Geist everywhere, Geist Mono for data values. Light sidebar on the page background with a hairline border and a green *accent* on the active item only — not a filled green panel. Feels like a command center.
  - **Every staff list has two shapes, switched at `lg`.** Volunteers, Applications,
    Opportunities, Shifts and Team render a `Table` above `lg` and a flush divided card
    list below it. The switch is **pure CSS** — both trees render from the same array
    inside `hidden lg:block` / `lg:hidden` wrappers, never a JS media query, which would
    paint the mobile shape to every desktop user and swap it after hydration.
  - The card list is `CardList` (`src/components/app/card-list.tsx`), which is `Card` plus
    `gap-0 divide-y py-0`. That override is a design fact, not an implementation detail:
    `Card`'s own `gap-6 … py-6` fights `divide-y`, so a bare `<Card className="divide-y">`
    draws each hairline on a row's top edge while the 24px gap holds the rows apart, and
    the rule floats in open space instead of separating anything.
  - A card drops a column only when the detail view it links to actually holds that
    column's actions. Where it does not — Publish/Close on Opportunities, Complete/Cancel/
    Delete on Shifts, the whole of Team — the actions stay on the card, so a layout change
    never quietly becomes a capability change.
- **Public/volunteer pages:** Warmer, Fraunces headlines, more generous spacing, cream backgrounds, editorial feel. Feels like a well-designed nonprofit annual report.
- **Shared:** Same color palette, same spacing system, same border radius scale. The green anchors both worlds.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-04 | Initial design system created | Created by /design-consultation based on competitive research (VolunteerMatch, Galaxy Digital, Civic Champs, Golden, Linear) + Codex and Claude subagent outside voices. All three voices converged on editorial serif + operational sans, warm neutrals, and product data as visual hero. |
| 2026-04-04 | Fraunces chosen over DM Serif Display | More personality, variable-axis, harder to confuse with another product. Both Codex and Claude agreed on editorial serif direction. |
| 2026-04-04 | Deep forest green (#1B3C2A) over ochre gold | Green is category-appropriate (trust, growth) but differentiated by depth. Gold used as warm accent instead of primary. |
| 2026-04-04 | Warm cream backgrounds (#FAFAF8) over pure white | Reduces eye strain, signals taste, breaks from clinical SaaS white. Both outside voices recommended this. |
| 2026-07-26 | Corrected the staff-shell description to match the shipped app | This document said the staff dashboard had a **forest green sidebar** and a 220px sidebar. Neither was true: `app-shell.tsx:128` renders `border-r border-border/60` with no fill, at `w-56` (224px), and the 56px sticky top bar was undocumented entirely. CLAUDE.md instructs every agent to read DESIGN.md before a visual decision, so this drove a whole round of `/plan-design-review` mockups to generate a solid green sidebar — confidently wrong work produced by a stale sentence. Corrected during that review (T34). **A design system that misdescribes the shipped product is worse than none.** |
| 2026-08-01 | Absorbed `docs/DESIGN.md` and deleted it | A second, older fork of this file had sat in `docs/` since 2026-03-16, describing a different aesthetic direction (Organic/Natural), a different info color and a different max width, and omitting the app shell entirely. Nothing linked to it — not the VitePress nav, not `CLAUDE.md` — but it was not merely redundant: **nine rule sets existed only there, and the shipped code follows them.** Touch targets (41 `h-11` call sites, asserted in the mobile e2e), the transform/opacity motion rule (cited by CHANGELOG when `transition-all` was replaced), `prefers-reduced-motion` (`globals.css:216`), the focus-visible contract, the inner-radius rule, font-loading (`font-display: swap` + preconnect), the public-page layout rules, `color-scheme: dark`, and the 700ms animation ceiling. **The first pass merged only five of the nine and the adversarial review caught the other four** — which is the honest lesson here: "I checked what was unique to the stale file" is a claim that needs a diff, not a memory. Values were rewritten to match the shipped app rather than imported verbatim, and where the app is NOT uniform the rule says so out loud: `transition-all` has ~19 deviations, `ring-[3px]` is outnumbered 18-to-6 by the older `ring-2 … ring-offset-2`, and `pointer-events-none` vs `cursor-not-allowed` is a real split across 8 form primitives. Per the T34 row above: this file describes what ships, or it misleads — and an aspiration stated as a description is the specific way it misleads. |
| 2026-08-01 | The design system is deliberately NOT a page on the docs site | VitePress builds from `docs/`, and this file lives at the repo root because `CLAUDE.md` sends every agent to `DESIGN.md` there. Deleting `docs/DESIGN.md` therefore removed the design system from the site entirely; a `/DESIGN` bookmark now 404s. Accepted rather than fixed: the site is not deployed anywhere (`vercel-build.sh` never invokes vitepress, no workflow builds it, `dist` is gitignored), and the alternative — a second copy under `docs/` — is the exact duplication this ship exists to end. `docs/index.md` names the file and its path instead of linking it. If the docs site is ever published, revisit with a symlink or a VitePress `rewrites` entry, never a copy. |
| 2026-08-07 | Named the **ambient notice strip** as an app-shell pattern | The version-update notice (v0.41.14.0) introduced a surface this document could not describe: a full-width band between the top bar and `<main>`, for app-level state worth mentioning but not worth blocking on. Recorded here because the two ways to get it wrong are both invisible in a mockup. **One:** the toaster looks like the obvious home and is not — verified against the installed `sonner` stylesheet, below 600px it becomes `position: fixed; width: 100%` at a 16px inset and covers the whole 56px top bar *including the mobile nav toggle*, which below `lg` is the only route to the sidebar. **Two:** `min-w-0` on the copy makes `flex-wrap` inert, so the sentence collapses into a ~120px column at 375px while every overflow assertion stays green — found by screenshotting, not by testing, and the reason this entry says to assert rendered width separately. The pattern also carries a precondition rather than just a recipe: it scrolls away, so it may only be used by a notice that has a second permanent home. |
| 2026-08-01 | Staff data tables become card lists below `lg`; the top bar's shrink contract is documented | T36 (v0.38.4.0) finished what T28 started: all five staff lists now have a table shape and a card shape, switched by CSS at `lg`. Recorded here because it changes what a staff surface *is* — a mockup that shows only a table is now half a design. The same entry documents the top-bar fix it depended on: the shell overflowed the viewport on every authenticated page (~126px at 800px), so any "does this page fit" judgement made before v0.38.4.0 was measured against broken chrome. Per the T34 row above, this file describes the shipped app or it misleads. |
