# Accessibility (a11y) Review Checklist

## Semantic Structure
- [ ] Each page has exactly one h1
- [ ] Heading levels don't skip (no h1 → h3 without h2)
- [ ] Main content is wrapped in `<main>`
- [ ] Navigation is wrapped in `<nav>` with aria-label if multiple navs exist
- [ ] Lists of items use `<ul>`/`<ol>` rather than divs
- [ ] Tables use proper `<thead>`, `<th>` with scope attributes

## Interactive Elements
- [ ] All buttons have accessible names (text content or aria-label)
- [ ] Icon-only buttons have aria-label or sr-only text
- [ ] Links have descriptive text (not "click here")
- [ ] All form inputs have associated `<label>` elements
- [ ] Required fields are indicated both visually and programmatically (aria-required)
- [ ] Error messages are associated with inputs via aria-describedby

## Keyboard Navigation
- [ ] All interactive elements are reachable via Tab
- [ ] Focus order follows visual layout (no tabindex > 0)
- [ ] Focus styles are visible (outline, ring, or equivalent)
- [ ] Modal dialogs trap focus and return focus on close
- [ ] Dropdown menus support arrow key navigation
- [ ] Escape key closes modals, dropdowns, and popovers

## Color & Contrast
- [ ] Text meets WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text)
- [ ] Status information is not conveyed by color alone (add icons or text)
- [ ] Focus indicators have sufficient contrast against backgrounds
- [ ] Links are distinguishable from surrounding text (not just by color)

## Dynamic Content
- [ ] Loading states are announced to screen readers (aria-busy, aria-live)
- [ ] Toast notifications use role="alert" or aria-live="polite"
- [ ] Route changes announce the new page title
- [ ] Form submission feedback is accessible

## Images & Media
- [ ] Decorative images have alt="" (empty alt)
- [ ] Informative images have descriptive alt text
- [ ] SVG icons used inline have role="img" and aria-label, or aria-hidden="true" if decorative

## Common Anti-Patterns
- Using div/span where a semantic element exists (button, nav, main, header)
- onClick on non-button elements without role="button" and keyboard handling
- Disabled-looking elements that are actually still focusable/clickable
- Placeholder text as the only label for inputs
- Auto-playing animations without motion-reduce support
