# Dedupe Volunteer Applications — Design Plan

## Problem
Volunteers can apply to the same opportunity multiple times with no warning or prevention. There's no visual indication on the opportunities listing that a volunteer has already applied.

## User Story
As a volunteer, if I've already applied for an opportunity, I should see that I've already applied and be prevented from submitting a duplicate application.

## Scope
- Public opportunities listing (`/opportunities/[orgSlug]`) — show "Already Applied" state
- Apply form (`/apply/[orgSlug]?opportunityId=X`) — prevent duplicate submission
- My Applications linkage — connect "Already Applied" badge to existing application

## Design Decisions

### 1. Applied Opportunity Card — Information Hierarchy

Applied opportunities remain visible in the listing but communicate "you're already in" immediately:

```
┌─────────────────────────────────────────┐
│  [Already Applied ✓]  [Match: 85%]     │  ← Status badges (top-right)
│                                         │
│  Community Garden Cleanup               │  ← Title (slightly muted)
│  Help maintain the downtown garden...   │  ← Description
│                                         │
│  📍 In-Person  📅 Apr 5  ⏱ 3hrs       │  ← Details
│                                         │
│  [View My Application →]               │  ← Secondary CTA (replaces "Apply now")
└─────────────────────────────────────────┘
```

- **CTA:** "Apply now" is replaced with "View My Application" linking to `/app/my-applications/[id]`
- **Badge:** "Already Applied ✓" badge at top of card
- Applied cards stay in the listing (not hidden) so volunteers can review what they applied to

### 2. Navigation Flow

```
Opportunities Listing
  ├── Card (not applied) → "Apply now" → Apply Form → Success
  └── Card (already applied) → "View My Application" → My Applications Detail
```

### 3. Apply Form — Duplicate Interception

If an authenticated volunteer navigates to the apply form for an opportunity they've already applied to (bookmarked URL, shared link), show a friendly interception instead of the form:

```
┌─────────────────────────────────────────┐
│  ✓ You've already applied              │
│                                         │
│  You submitted an application for       │
│  "Community Garden Cleanup" on Mar 15.  │
│                                         │
│  [View My Application]                  │
│  [Browse Other Opportunities]           │
└─────────────────────────────────────────┘
```

- Uses the existing success card pattern (same container style)
- Shows the opportunity name and submission date for context
- Two clear CTAs: view existing application or browse more
- For unauthenticated users: form shows normally (dedup only possible for logged-in users)

### 4. Interaction States

| Feature | Loading | Empty | Error | Success | Partial |
|---------|---------|-------|-------|---------|---------|
| Applied status check (listing) | Show "Apply now" initially, swap to "Already Applied ✓" + "View My Application" once check completes | No apps = normal "Apply now" | Show "Apply now" as fallback (safe — worst case is a duplicate, caught by backend) | Show "Already Applied ✓" badge + swap CTA | N/A |
| Apply form dedup check | Spinner in form area | N/A | Show form as fallback (safe) | Show interception card | N/A |
| Backend dedup rejection (race condition) | N/A | N/A | Toast: "You've already applied to this opportunity" + link to view application | N/A | N/A |

**Error philosophy:** All error states fail OPEN — if the dedup check fails, show the normal form/button. The backend unique constraint is the safety net. Better to allow a rare duplicate than to block a legitimate first application.

### 5. Tone & Emotional Arc

**Interception card tone:** Warm confirmation — "You're already on the list!"

```
┌─────────────────────────────────────────┐
│  ✓ You're already on the list!         │
│                                         │
│  You applied for "Community Garden      │
│  Cleanup" on March 15, 2026.            │
│                                         │
│  [View My Application]                  │
│  [Browse Other Opportunities]           │
└─────────────────────────────────────────┘
```

- Checkmark icon (lucide `CheckCircle2`) in Success green (`#2D7A4F`)
- Heading uses Fraunces (h2 scale) for warmth
- Body uses Geist at body scale
- Same card container style as the post-submission success card
- Tone builds trust: the platform remembers you and respects your time

### 6. Applied Card Visual Treatment

Applied opportunity cards get three visual changes:

1. **Left border:** 3px solid Success green (`#2D7A4F`) — signals "this one's yours" without competing for attention
2. **Badge:** "Already Applied ✓" using shadcn Badge with `variant="outline"` + Success green text + green border. Positioned top-right alongside match score badge.
3. **CTA swap:** "Apply now" button replaced with "View My Application →" as a text link (not a button) in Success green

The card itself retains full opacity and readability — applied opportunities are not errors, they're accomplishments. The left border is the same pattern used for "active" or "selected" states in sidebar navigation (familiar, not novel).

### 7. Design System Tokens

| Element | Token/Component | Value |
|---------|----------------|-------|
| "Already Applied ✓" badge | shadcn `Badge variant="outline"` | text: `#2D7A4F`, border: `#2D7A4F`, bg: transparent |
| Left border on applied card | `border-l-[3px]` | color: `#2D7A4F` (Success) |
| "View My Application →" link | Text link with arrow | color: `#2D7A4F`, hover: underline, focus-visible: `ring-2 ring-primary ring-offset-2` |
| Interception card heading | Fraunces h2 (32px/2rem, 700) | color: `#252422` (neutral-800) |
| Interception checkmark icon | lucide `CheckCircle2` | size: 24px, color: `#2D7A4F` |
| Interception card container | Same as post-apply success card | bg: `#F5F4F0` (neutral-100), rounded-md (8px), p-6 |
| Backend error toast | shadcn Toast | variant: destructive (for race condition duplicate rejection) |

All tokens align with DESIGN.md. No new components introduced — reuses Badge, Toast, and existing card patterns.

### 8. Responsive Behavior

| Viewport | Badge Placement | CTA | Interception Card |
|----------|----------------|-----|-------------------|
| Desktop (≥1024px) | Top-right of card alongside match score | "View My Application →" text link, right-aligned | Centered in content area, max-width 480px |
| Tablet (768-1023px) | Top-right of card | Same as desktop | Same as desktop |
| Mobile (<768px) | Below title, horizontal row with match score | Full-width text link below card details | Full-width with 16px horizontal padding |

**Mobile card layout (applied):**
```
┌───────────────────────────┐
│  Community Garden Cleanup │  ← Title
│  [Already Applied ✓]     │  ← Badges below title
│  [Match: 85%]            │
│                           │
│  Help maintain the...     │  ← Description
│  📍 In-Person  📅 Apr 5  │  ← Details
│                           │
│  View My Application →    │  ← Full-width link
└───────────────────────────┘
```

### 9. Accessibility

- **"Already Applied ✓" badge:** `aria-label="You have already applied to this opportunity"`
- **"View My Application" link:** Standard anchor with descriptive text (self-documenting)
- **Interception card:** `role="status"` + `aria-live="polite"` so screen readers announce it when it replaces the form
- **Left border:** Decorative only — not relied upon for conveying status (badge + text handle that)
- **Keyboard navigation:** "View My Application" link is focusable in normal tab order, replacing the "Apply now" button's tab stop
- **Focus-visible:** `ring-2 ring-primary ring-offset-2` per DESIGN.md
- **Touch targets:** "View My Application" link has min 44px tap height (py-3)
- **Color contrast:** Success green `#2D7A4F` on white/neutral-100 background = 5.2:1 ratio (passes WCAG AA for normal text)

### 10. Status-Aware Badge

The badge reflects the application's current status, not just "applied":

| Application Status | Badge Text | Badge Color | CTA | Can Re-Apply? |
|-------------------|------------|-------------|-----|---------------|
| SUBMITTED | "Applied — Pending" | Warning amber `#B8860B` | "View My Application →" | No |
| REVIEW | "Applied — In Review" | Info blue `#2A6496` | "View My Application →" | No |
| APPROVED | "Applied — Approved ✓" | Success green `#2D7A4F` | "View My Application →" | No |
| REJECTED | "Application Closed" | Neutral gray `#787571` | "Apply Again" (re-enables apply flow) | Yes |

- Rejected volunteers can re-apply — the "Apply Again" button links to the normal apply form
- Left border color matches badge color for visual consistency
- Interception card only blocks SUBMITTED/REVIEW/APPROVED statuses, not REJECTED

### 11. Anonymous User Handling

Dedup is **authenticated users only** for v1:
- Authenticated volunteers: full dedup (badge, CTA swap, form interception)
- Anonymous visitors: normal "Apply now" flow with no dedup check
- Backend unique constraint on `(submittedByUserId, opportunityId)` where userId is NOT NULL
- Anonymous applications (userId IS NULL) are not constrained — duplicates possible but acceptable

### 12. Application Status Change Notifications (added during design review)

Notify volunteers when their application status changes. This closes the feedback loop — the status-aware badge only helps when volunteers are browsing, but they need proactive notification.

**Notification triggers:**
| Status Change | Notification | Channel |
|---------------|-------------|---------|
| SUBMITTED → REVIEW | "Your application for [Opportunity] is being reviewed" | Email |
| REVIEW → APPROVED | "Great news! You've been approved for [Opportunity]" | Email |
| REVIEW → REJECTED | "Update on your application for [Opportunity]" | Email |
| SUBMITTED → APPROVED | "Great news! You've been approved for [Opportunity]" | Email |
| SUBMITTED → REJECTED | "Update on your application for [Opportunity]" | Email |

**Email design:**
- Subject line includes opportunity name for scannability
- Warm, human tone matching the platform's organic/natural voice
- CTA: "View My Application" linking to `/app/my-applications/[id]`
- Uses existing transactional email infrastructure (magic link sender)
- Sent to `submittedByEmail` on the application record

**Design decisions deferred for this notification:**
- In-app notification bell / badge (future feature)
- Notification preferences / opt-out (v2 — all notifications on by default for now)
- SMS notifications (not in scope)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 5 proposals, 5 accepted, 1 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES_FOUND | 12 findings (3 valid, 7 already resolved, 2 moot) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | ISSUES_OPEN | Run 1: 8 issues. Run 2 (post-design): 5 issues. Run 3 (post-impl): 9 issues — orgId scoping, migration safety, DRY, type cast, rate limiting, test gaps, scope additions |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3/10 → 9/10, 8 decisions |
| Adversarial | `/review` | Code review | 1 | ISSUES_FOUND | Large diff tier, issues found and fixed |

- **CODEX:** 12 plan findings — 3 carried forward (migration safety, orgId scoping, notification idempotency), rest resolved in implementation
- **CROSS-MODEL:** Codex and Claude independently flagged orgId scoping and migration safety. Codex uniquely caught accessibility contrast gap for non-green badges.
- **UNRESOLVED:** 0 decisions unresolved. 11 action items accepted and queued for implementation.
- **VERDICT:** CEO + DESIGN CLEARED. ENG NOT CLEARED — 11 action items must be implemented before shipping.
