# Banned Grid Patterns on Public Pages — Design Plan

Resolves issue #128.

## Problem
DESIGN.md's own anti-pattern list bans "3-column feature grids with icons in colored circles," yet two public pages used exactly that pattern:
- Homepage "What it does, day to day" — 3-col icon+title+description card grid (`src/app/(public)/page.tsx`, the `pillars` section)
- `/for` — 2x2 audience card grid, each card linking to a sub-page (`src/app/(public)/for/page.tsx`, the `audiences` section)

Flagged by the 2026-07-12 design review (docs/TODOS.md) and both a Codex source audit and a live audit.

## Scope
- Extract a shared `EditorialList` component (`src/components/editorial-list.tsx`) for static content lists — takes `items: {heading, body}[]`, renders a left-`border-accent` row per item, no icons.
- Homepage `differentiators` (already had this exact row shape inline) and `pillars` (icons dropped for visual parity) both route through `EditorialList`.
- `/for`'s `audiences` section is a navigation index (4 clickable links), a different concern from a static content list. Rather than force it through `EditorialList` with an optional `href`, it mirrors the link-row pattern already shipped on `src/app/(public)/locations/page.tsx` (divide-y rows, alternating stripe, hover state, trailing arrow) as inline JSX.
- Out of scope: annotated product-screenshot imagery per pillar/audience (bigger, separate content-production project — tracked as a P3 TODO), and a shared component unifying `/for` + `/locations`' row-link pattern (tracked as a P3 TODO, deferred since `/locations` wasn't otherwise touched).

## Design Decisions

### 1. Why not one shared component for all three sections?
An outside-voice review (Codex) challenged the original plan, which routed `pillars`, `differentiators`, and `audiences` all through one `href`-optional `EditorialList`. Two problems: `pillars`/`differentiators` are static content lists while `audiences` is a navigation index — different concerns being papered over by one component. And `/locations/page.tsx` already has a working, purpose-built navigation-row pattern that's a closer match for `/for` than retrofitting a content-list component. Resolution: `EditorialList` stays scoped to the 2 genuine content-list duplicates; `/for` copies the `/locations` pattern directly.

### 2. Test coverage
`e2e/public-pages.spec.ts` previously smoke-tested `/for/nonprofits`, `/for/volunteers`, `/for/employers`, and `/for/animal-shelters` by navigating to each URL directly — never by clicking through from the `/for` index. That's a real regression risk on this refactor (an `href` typo would pass the existing suite silently). Added a mandatory regression test: visit `/for`, assert all 4 rows render as `<a href>` with correct destinations, click through at least one.

## Success Criteria
- Homepage and `/for` no longer contain any 3-4-column icon-in-circle card grid.
- `/for`'s 4 audience links remain independently clickable and keyboard-navigable.
- Visual consistency between homepage's "What it does" and "Three things you won't find" sections (same list pattern).
