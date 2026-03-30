# UI Consistency Review — VolunteerMatch

**Reviewed**: March 8, 2026
**Stack**: Next.js 16 · Tailwind CSS v4 · shadcn/ui (New York) · Radix UI · React 19
**Pages audited**: 22 routes (17 authenticated, 5 public)
**Components audited**: 22 shared components (13 UI primitives + 9 feature components)

---

## Executive Summary

The VolunteerMatch frontend has a solid foundation — shadcn/ui provides a well-structured component library, Tailwind v4 with CSS custom properties enables good theming, and most pages follow consistent layout patterns. However, there are **three systemic issues** that undermine UI consistency across the app:

1. **Hardcoded colors bypass the design system** — Status badges and several pages use raw Tailwind colors (`emerald-*`, `stone-*`, `green-*`) instead of theme tokens, breaking dark mode and theming support.
2. **Form handling is fragmented** — Three different form patterns coexist (react-hook-form + zod, raw useState, FormData), creating inconsistent validation and error feedback.
3. **The public opportunities page diverges visually** — It introduces a separate font (Playfair Display), a stone/green color palette, and custom button elements, making it feel like a different app.

Below are the prioritized findings across visual consistency, component patterns, accessibility, and code quality.

---

## Critical Issues (P0)

### 1. Status badges have zero dark mode support

**Affected files**:
- `src/components/my-applications/ApplicationStatusBadge.tsx`
- `src/components/my-applications/ScreeningStatusBadge.tsx`
- `src/components/opportunities/OpportunityStatusBadge.tsx`

All three status badge components use hardcoded Tailwind colors like `border-blue-200 bg-blue-50 text-blue-800` instead of the semantic color tokens defined in `globals.css`. These colors will not respond to dark mode toggling, creating broken contrast in dark theme.

Additionally, the "success" state uses inconsistent greens — `emerald-*` in ApplicationStatusBadge and ScreeningStatusBadge, but `green-*` in OpportunityStatusBadge. Users may perceive these as different status levels.

**Recommended fix**: Create status-specific CSS custom properties in `globals.css` (with dark mode variants) and update all three badge components to reference them. Alternatively, extend the Badge component's variant API to include `success`, `warning`, and `info` variants.

### 2. Missing global error and loading boundaries

**Affected location**: `src/app/`

The app has no root-level `error.tsx`, `loading.tsx`, or `not-found.tsx`. If an unhandled error occurs outside a route-specific boundary, users see the default Next.js error page. Five authenticated pages (Dashboard, Dev Console, My Shifts, Shifts, Welcome) also lack page-level error handling.

**Recommended fix**: Add `error.tsx` and `not-found.tsx` to `src/app/` using the existing Card/EmptyState components for visual consistency.

### 3. Accessibility gaps in form radio groups

**Affected file**: `src/app/apply/[orgSlug]/ApplyFormClient.tsx` (QuestionField function, ~lines 380-390)

Radio group labels in the public application form lack proper `id`/`aria-labelledby` associations. Screen reader users won't get proper context for which question each radio group answers.

**Recommended fix**: Add `aria-labelledby` pointing to the question text element for each RadioGroup.

---

## High Priority Issues (P1)

### 4. Hardcoded colors on 7+ pages

The dashboard page uses `bg-green-500`, `bg-blue-400`, `bg-amber-400`, and `bg-emerald-500` for stat indicators. The opportunity detail page uses `border-l-green-500`, `border-l-stone-300`, `border-l-slate-400`. The profile page uses hardcoded colors in the CompletenessBar. The shifts page has `STATUS_COLORS` and `ATTENDANCE_COLORS` objects with raw color values. The screener's QuestionsClient has `TYPE_CLASSES` with hardcoded colors.

These will all break under theming or dark mode. Each should map to semantic tokens.

### 5. Form library fragmentation

The standard is react-hook-form + zod (used in onboarding, settings/team, and the apply flow). However:

- **Credentials page** (`IssueCredentialDialog`): Uses `useState` with no validation
- **Profile page**: Uses manual `useState` state management
- **Shifts page** (`CreateShiftDialog`): Uses raw `FormData`

This creates inconsistent validation behavior, error message patterns, and submit-button loading states.

**Recommended fix**: Migrate all form pages to react-hook-form + zod. Extract a shared `FormField` wrapper component for consistent label/error rendering.

### 6. Opportunities listing diverges from design system

**Affected file**: `src/app/opportunities/[orgSlug]/OpportunitiesListing.tsx`

This page introduces:
- A separate font (`Playfair_Display`) via inline style injection
- A `stone-*`/`green-*` color palette instead of the app's theme tokens
- Custom `<button>` elements for filters instead of the `Button` component
- Custom styled opportunity cards instead of the `Card` component

While this may be an intentional "marketing" design choice, it breaks consistency with the rest of the app.

**Recommended fix**: If the divergent design is intentional, document it as a deliberate exception. If not, migrate to the standard theme tokens and component library.

### 7. Two pages skip the PageHeader component

- **Dev Console** (`src/app/(app)/app/dev/page.tsx`): Uses a raw `<h1 className="text-2xl font-semibold">` instead of PageHeader
- **Opportunity Detail** (`src/app/(app)/app/opportunities/[id]/page.tsx`): Uses `<h1>` inside a Card

Every other authenticated page uses `PageHeader`. These two should follow the same pattern.

---

## Medium Priority Issues (P2)

### 8. Padding inconsistency across public pages

The homepage uses `px-4`, but the apply pages use `px-6`. Authenticated pages inherit `px-4 py-10` from the app layout. The inconsistency is subtle but noticeable on narrower screens.

### 9. Missing page-specific metadata

The login page, apply page, and apply status page don't export `metadata`. They fall through to the root layout's generic title ("Volunteer Match"). The opportunities page correctly uses `generateMetadata` for dynamic titles — other public pages should follow suit.

### 10. Badge component doesn't export `badgeVariants`

The `Button` component exports `buttonVariants` for reuse in custom compositions. The `Badge` component does not export `badgeVariants`, forcing status badge components to bypass the variant system entirely and use raw `className` props.

### 11. Icon sizing inconsistency

Status badge icons use `h-3.5 w-3.5`, AppShell icons use `h-4 w-4`, and EmptyState icons use `h-5 w-5`. While some variation is appropriate for context, there's no documented scale. Consider standardizing to `size-3.5`, `size-4`, and `size-5` as the three icon sizes.

### 12. Missing loading/empty states on some pages

Three pages lack loading skeletons: Dev Console, Welcome, and My Shifts (partial). Six pages lack empty states for zero-data scenarios: Dev Console, Credentials, Profile, My Skills, Screener, and Shifts.

---

## Low Priority Issues (P3)

### 13. Missing viewport and theme-color in root metadata
Root layout should export a `viewport` configuration and `themeColor` for mobile browser chrome.

### 14. Inline style for font injection
`OpportunitiesListing.tsx` uses `style={{ fontFamily: 'var(--font-playfair)' }}` which is redundant with the CSS variable approach. A utility class would be cleaner.

### 15. Naming convention deviation
`OrgSwitcher.tsx` uses PascalCase filename while all other components use kebab-case (`page-header.tsx`, `empty-state.tsx`). Similarly, the status badge files use PascalCase (`ApplicationStatusBadge.tsx`).

---

## Component Usage Matrix

| Page | PageHeader | Card | EmptyState | Loading | Error | Badge | Button | Form (RHF) |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | Yes | Yes | No | Yes | No | Yes | Yes | — |
| Applications | Yes | Yes | Yes | Yes | Yes | Yes | Yes | — |
| Application Detail | Yes | Yes | — | Yes | Yes | Yes | Yes | — |
| Credentials | Yes | Yes | No | Yes | Yes | Yes | Yes | No |
| Dev Console | **No** | **No** | No | No | No | No | Yes | — |
| My Applications | Yes | Yes | Yes | Yes | Yes | Yes | Yes | — |
| My Application Detail | Yes | Yes | — | Yes | Yes | Yes | Yes | — |
| My Shifts | Yes | Yes | Yes | Partial | No | Yes | Yes | — |
| My Skills | Yes | Yes | No | Yes | Yes | — | Yes | — |
| Onboarding | Yes | Yes | — | Yes | Yes | — | Yes | Yes |
| Opportunities | Yes | Yes | Yes | Yes | Yes | Yes | Yes | — |
| Opportunity Detail | **No** | Yes | — | Yes | Yes | Yes | Yes | — |
| Profile | Yes | Yes | No | Yes | Yes | — | Yes | **No** |
| Screener | Yes | Yes | No | Yes | Yes | Yes | Yes | — |
| Settings/Team | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Shifts | Yes | Yes | Yes | Yes | No | Yes | Yes | **No** |
| Welcome | Yes | Yes | — | No | No | — | Yes | Yes |

---

## Top 5 Changes to Make First

1. **Add status color tokens to globals.css** with dark mode variants, and refactor all three status badge components to use them. This fixes the single biggest visual consistency issue.

2. **Create root error.tsx and not-found.tsx** using EmptyState and Card components. Add error handling to the 5 pages that lack it.

3. **Standardize form handling** — migrate Credentials, Profile, and Shifts pages to react-hook-form + zod. Extract a shared FormField wrapper.

4. **Bring Dev Console and Opportunity Detail pages into line** by adopting PageHeader and following the standard page structure pattern.

5. **Decide on the Opportunities listing design direction** — either migrate it to the standard design system or explicitly document it as an intentional brand variant with its own token set.

---

## Skill Created

A reusable `frontend-developer` skill has been saved to your project at `frontend-developer/`. It includes:
- `SKILL.md` — The main review workflow and checklist
- `references/tailwind-audit.md` — Tailwind CSS consistency checklist
- `references/a11y-checklist.md` — Accessibility review checklist
- `references/nextjs-patterns.md` — Next.js App Router best practices

You can use this skill in future reviews by reading its SKILL.md and following the process.
