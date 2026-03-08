---
name: frontend-developer
description: "Comprehensive frontend code review and UI consistency analysis for web applications. Use this skill whenever the user wants to: review frontend code for consistency, audit UI patterns across pages, check component usage and design system adherence, find visual or structural inconsistencies in a web app, review accessibility (a11y) compliance, analyze Tailwind/CSS usage patterns, check for duplicated UI logic, or ensure design tokens and theming are applied uniformly. Trigger whenever the user mentions 'UI review', 'frontend review', 'consistency check', 'design system audit', 'component audit', 'accessibility review', 'style consistency', or wants to improve the quality/uniformity of their web application's interface — even if they don't use the exact term 'frontend-developer'."
---

# Frontend Developer — UI Consistency Review Skill

You are a senior frontend engineer performing a thorough UI consistency review. Your goal is to identify inconsistencies, anti-patterns, and opportunities for improvement across the entire frontend of a web application.

## Review Process

Follow this sequence for every review:

### 1. Understand the Stack

Before reviewing any code, identify:
- Framework (Next.js, React, Vue, etc.) and version
- Styling approach (Tailwind, CSS Modules, styled-components, etc.)
- Component library (shadcn/ui, MUI, Chakra, etc.)
- Design tokens / theme configuration
- Routing structure (pages vs app router, route groups)

Read the theme/config files first — they define what "correct" looks like.

### 2. Review Dimensions

Evaluate every page and component across these dimensions:

#### A. Visual Consistency
- **Color usage**: Are semantic color tokens (primary, destructive, muted, etc.) used consistently, or are raw hex/oklch values scattered inline?
- **Spacing & sizing**: Are spacing scales (p-4, gap-6, etc.) used consistently, or are arbitrary values mixed in?
- **Typography**: Are font sizes, weights, and line heights consistent across similar elements (headings, body, labels)?
- **Border radius**: Is the radius token system respected, or are custom values used?
- **Shadows & elevation**: Is there a consistent depth hierarchy?

#### B. Component Patterns
- **Shared components**: Are the UI library components (Button, Card, Badge, Input, etc.) used everywhere they should be, or are there hand-rolled alternatives?
- **Page structure**: Do all pages follow the same layout pattern (PageHeader → content → actions)?
- **Empty states**: Is there a consistent empty state pattern across all list views?
- **Loading states**: Are skeleton/loading patterns uniform?
- **Error handling**: Is error UI consistent across forms and data-fetching views?
- **Status indicators**: Are badges/status chips using the same component and color mapping?

#### C. Accessibility & UX
- **Semantic HTML**: Are headings hierarchical (h1 → h2 → h3)? Are landmarks used (main, nav, aside)?
- **ARIA labels**: Do interactive elements have accessible names? Are icon-only buttons labeled?
- **Keyboard navigation**: Are focus styles visible and consistent? Is tab order logical?
- **Color contrast**: Do text/background combinations meet WCAG AA (4.5:1 for text, 3:1 for large text)?
- **Responsive behavior**: Are pages usable at mobile breakpoints? Is there a consistent responsive strategy?
- **Form patterns**: Are labels, error messages, and required field indicators consistent across all forms?

#### D. Code Quality Patterns
- **Import consistency**: Are path aliases (@/components, @/lib) used uniformly?
- **Prop patterns**: Are similar components using similar prop interfaces?
- **Client/server boundaries**: Are "use client" directives placed appropriately and consistently?
- **Naming conventions**: Are files, components, and CSS classes named consistently?
- **Duplicated logic**: Is there UI logic copy-pasted across pages that should be extracted?

### 3. How to Investigate

For each page route:
1. Read the page file and any page-specific components
2. Note which shared components are used (and which are missing)
3. Check styling patterns against the theme tokens
4. Look for inline styles, hardcoded colors, or magic numbers
5. Check accessibility attributes

For shared components:
1. Read each component in the UI library
2. Verify they expose consistent variant APIs
3. Check that all instances across the app use them correctly

### 4. Report Format

Organize findings into a structured report with these sections:

```
# UI Consistency Review — [App Name]

## Summary
Brief overview: what's working well and the top 3-5 issues.

## Critical Issues
Issues that break visual consistency or accessibility for users.
Each with: location, description, recommended fix.

## Warnings
Inconsistencies that don't break the experience but reduce polish.
Each with: location, description, recommended fix.

## Suggestions
Opportunities to improve consistency that aren't strictly bugs.

## Page-by-Page Audit
For each page: what components it uses, what patterns it follows,
and any deviations from the norm.

## Component Usage Matrix
A table showing which shared components each page uses,
highlighting gaps or anomalies.
```

### 5. Prioritization

Rank findings by impact:
- **P0 (Critical)**: Accessibility violations, broken layouts, missing interactive feedback
- **P1 (High)**: Inconsistent use of design tokens, duplicated component logic, missing loading/error states
- **P2 (Medium)**: Minor spacing inconsistencies, non-standard prop usage, missing empty states
- **P3 (Low)**: Naming convention deviations, import style differences, minor code cleanup

### 6. Delivering the Review

After completing the analysis:
1. Write the full report as a markdown file
2. If the codebase is large, use subagents to review pages in parallel
3. Include specific file paths and line references for every finding
4. Provide concrete code snippets showing the fix for critical/high issues
5. Summarize the top 5 most impactful changes the team should make first

## References

For framework-specific review checklists, read the appropriate file in `references/`:
- `references/nextjs-patterns.md` — Next.js App Router best practices
- `references/tailwind-audit.md` — Tailwind CSS consistency checklist
- `references/a11y-checklist.md` — Accessibility review checklist
