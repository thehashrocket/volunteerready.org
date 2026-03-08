# Tailwind CSS Consistency Audit Checklist

## Color Token Adherence
- [ ] All colors reference CSS variables or Tailwind theme tokens (bg-primary, text-muted-foreground, etc.)
- [ ] No raw hex, rgb, hsl, or oklch values in className strings
- [ ] Destructive actions consistently use the `destructive` color token
- [ ] Muted/secondary content consistently uses `muted-foreground`
- [ ] Borders use the `border` token, not custom gray values

## Spacing Consistency
- [ ] Page padding follows a uniform pattern (e.g., all pages use p-6 or px-4 py-6)
- [ ] Card internal padding is consistent across all Card components
- [ ] Gap values in flex/grid layouts use the same scale for similar content types
- [ ] Section spacing (margin between major blocks) is uniform
- [ ] No arbitrary values like `p-[13px]` when a standard scale value would work

## Typography
- [ ] Heading sizes follow a consistent hierarchy (text-2xl for page titles, text-xl for section titles, etc.)
- [ ] Font weights are consistent for similar elements (semibold for headings, medium for labels, etc.)
- [ ] Line heights match the design system
- [ ] Text truncation strategies are consistent (truncate, line-clamp)

## Responsive Design
- [ ] Breakpoint usage is consistent (sm:, md:, lg: applied at the same thresholds for similar layouts)
- [ ] Mobile-first approach is followed consistently
- [ ] Grid column counts change at the same breakpoints across similar pages
- [ ] No elements overflow their containers at any standard breakpoint

## Component Variant Usage
- [ ] Button variants (default, secondary, outline, ghost, destructive) are used semantically
- [ ] Badge variants map consistently to status types
- [ ] Card usage follows a uniform pattern (header + content + optional footer)

## Dark Mode
- [ ] All custom colors have dark mode equivalents
- [ ] No hardcoded light-only colors (white, black) without dark mode alternatives
- [ ] Images and icons work in both themes

## Anti-Patterns to Flag
- Mixing Tailwind classes with inline styles
- Using !important overrides
- Creating custom CSS when a Tailwind utility exists
- Inconsistent class ordering (positional → display → spacing → sizing → visual)
- Unused or contradictory classes on the same element
