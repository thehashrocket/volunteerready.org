# Staff-Created Volunteers & Unclaimed Accounts — Design Plan

## Problem

VolunteerReady is only useful to an org once volunteers exist in the system, and
today volunteers can only exist by applying through the public form. Every org
arrives with a roster already in hand (spreadsheet, binder, group text), which
means the first week on the platform is spent asking 60 existing volunteers to
create accounts before the tool does anything. That is a marketplace assumption
living inside a management app.

Partial plumbing already exists: `VolunteerApplication.submittedByUserId` is
nullable with `submittedByEmail` as fallback, and `bulk-import-service.ts`
creates email-only applications from CSV. But everything operational —
`ShiftSignup`, `VolunteerCredential`, `VolunteerProfile` — requires a real
`User`, so an email-only volunteer can't be scheduled, checked in, or reported
on. The feature completes the loop.

## User Stories

- As an org coordinator, I can add a volunteer (name, email, phone) directly,
  so my existing roster is in the system on day one without the volunteer
  doing anything.
- As a coordinator, I can optionally send that volunteer an invitation. If I
  don't, or they ignore it, they still work like any other volunteer: I can
  assign them shifts, mark attendance, and their hours appear in reports.
- As an invited volunteer, I land on a page carrying the org's name that
  explains who added me and why activating is worth it. If I activate, I see
  my shifts and hours and can carry my credentials to other orgs. If I
  decline or ignore it, nothing changes for the org.
- As anyone else on the platform, I never see an unclaimed volunteer. They are
  visible only to the org(s) that hold a roster relationship with them.

## Core Design Decision: Unclaimed Users, Not a Parallel Record Type

Two options were considered:

**A. New `OrgVolunteer` record type** (org-owned, separate from `User`).
Cleaner ownership semantics, but every operational table (`ShiftSignup`,
`VolunteerCredential`, `VolunteerSkill`, attendance, reports) would need a
union FK (`userId | orgVolunteerId`) plus a migration path when a record
becomes a user. That refactor touches the entire scheduling and reporting
stack and creates permanent dual-path complexity.

**B. Shadow `User` rows in an UNCLAIMED state.** Staff-created volunteers are
real `User` rows that nobody has logged into yet. Every existing FK works
unchanged: shifts, credentials, skills, profile, hours reports. "Activation"
is simply the first authenticated session, gated by proof of email ownership
(the same bar as magic-link auth). Claiming is a state flip, not a data
migration.

**Decision: B.** The entire operational layer works for free, and the claim
flow reuses auth machinery that already exists. The cost is guardrails:
unclaimed users must be invisible everywhere except to their org(s), and must
never receive marketing-shaped email. Those guards are enumerated below and
are the main review surface of this design.

## Schema Changes

```prisma
enum AccountState {
  ACTIVE      // default; every existing user backfills to this
  UNCLAIMED   // created by org staff; no one has ever authenticated
}

model User {
  // new fields
  accountState    AccountState @default(ACTIVE)
  claimedAt       DateTime?    // set on first authenticated session of an UNCLAIMED user
  createdByOrgId  String?      // provenance; org that created the shadow record
}

model VolunteerActivationInvite {
  id          String    @id @default(cuid())
  orgId       String
  userId      String
  tokenHash   String    @unique   // HMAC-SHA256, same pattern as checkin-token / case-study-token
  sentAt      DateTime  @default(now())
  remindedAt  DateTime? // at most one reminder, org-triggered
  claimedAt   DateTime?
  declinedAt  DateTime?
  expiresAt   DateTime  // 30 days; expired invite can be re-sent (new token)
  createdAt   DateTime  @default(now())

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([orgId, sentAt])
  @@index([userId])
}
```

Naming note: `VolunteerInvitation` already exists and means "org invites an
existing user to an opportunity." This model is deliberately named
`VolunteerActivationInvite` to avoid collision. Do not merge them.

**Roster membership = an application.** Staff-adding a volunteer creates a
`VolunteerApplication` with a new `ApplicationSource.STAFF_ADDED`, status
`APPROVED` (the coordinator vouches for them; that's what adding them means).
Org rosters, permissions, and "which orgs can see this volunteer" all derive
from applications exactly as they do today — no new visibility mechanism.

**Migration safety:** all new columns nullable or defaulted; `AccountState`
backfills every existing row to `ACTIVE` via the default. No existing query
changes behavior until code opts in. Zero-downtime, same pattern as the
tsvector migration.

## Flows

### 1. Staff adds a volunteer

```
/app/volunteers → "Add volunteer" → name (req), email (req, v1), phone (opt)
  ├── email unknown        → create User{accountState: UNCLAIMED, createdByOrgId}
  │                          + VolunteerProfile{visibility: PRIVATE, phone}
  │                          + VolunteerApplication{source: STAFF_ADDED, APPROVED}
  │                          → roster row appears with "Not activated" badge
  │                          → optional: [Send invitation] (never automatic)
  ├── email is ACTIVE user → no shadow created. Offer "Add to roster" instead:
  │                          creates the STAFF_ADDED application linked to the
  │                          existing user + notifies them ("Tracy Animal
  │                          Services added you to their roster" + remove link)
  └── email is UNCLAIMED   → second STAFF_ADDED application linking the same
      (created by another    shadow user. Each org sees only its own
       org)                   relationship. See Security §3.
```

All writes go through a service (`staffVolunteerService.ts`) with audit log
actions (`volunteer.staff_created`, `volunteer.invite_sent`,
`volunteer.claimed`) per the existing writeAuditLog pattern.

### 2. Invitation email + landing page

- Sent only when the coordinator clicks Send. One invite, at most one
  org-triggered reminder (`remindedAt` enforces). Resend after expiry issues a
  new token. Rate-limit invites per org per day (abuse guard, generous cap).
- From: "{Org} via VolunteerReady", reply-to: the coordinator's email. The
  volunteer trusts the shelter, not us.
- Body: who added you ("Sarah at Tracy Animal Services"), what that means, and
  the volunteer-side benefits: see open shifts and claim them, track your
  hours, carry screening credentials to any other org on the platform.
  Portable credentials are the strongest single reason to activate; lead with
  the practical ones and close with that.
- Link → `/welcome/[token]` (public route group). Page is org-branded: org
  name, location, who invited them. Two paths:
  - **Activate:** token was delivered to their inbox, so token possession is
    proof of email ownership — same trust level as a magic link. Create the
    session, set `emailVerified`, `claimedAt`, `accountState: ACTIVE`, profile
    visibility stays PRIVATE until the user changes it. Land on the volunteer
    dashboard, which already handles upcoming shifts / hours.
  - **"This isn't me / remove me":** sets `declinedAt`, flags the roster row
    for the org ("declined — check the email address"), and suppresses any
    further invite to that address from that org.
- Expired token → friendly page: "Ask {Org} to send a fresh invitation."

### 3. Operating on unclaimed volunteers (the point of the feature)

- **Assign to shift:** new staff mutation `shifts.assignVolunteer` creating a
  `ShiftSignup` for any APPROVED roster member (claimed or not). Works today
  for claimed users only by self-signup; this is the staff-side twin.
- **Attendance:** staff manual check-in already conceptually exists next to
  QR/geo; ensure the attendance UI lists assigned unclaimed volunteers and
  supports check-in-by-name (kiosk path). QR check-in remains a claimed-user
  feature.
- **Reports:** hours/impact reports need no changes — they aggregate over
  users and signups, and shadow users are users. This is the payoff of
  Decision B; verify with a test, not new code.
- **No email to unclaimed users, ever, except the activation invite(s).**
  Explicit exclusions: opportunity digests, marketplace anything, shift
  reminder emails (deferred; see below), feedback prompts, org-feedback cron.
  Enforce centrally: a `canEmail(user)` guard in the email layer that checks
  `accountState`, not per-callsite discipline.

## Security & Privacy

1. **Wrong-email risk.** Coordinator typos an email; a stranger receives an
   invite naming the org. Mitigations: the landing page states who added them
   and offers decline; activation grants access only to that org's
   relationship (shifts/hours with that org), which is data the org itself
   entered; PII on the shadow record is limited to name/email/phone the org
   typed.
2. **Org adds an ACTIVE user's email.** The existing user is notified and can
   remove the roster link. An org can never read an existing user's profile,
   credentials, or other-org history through this path — visibility remains
   application-scoped, same as today.
3. **Cross-org shadow collision.** Org B adds an email org A already created.
   Org B sees the `User.name` org A entered — a minor leak (org B typed the
   email; the name is usually known to them). Accepted for v1; flagged for eng
   review. Alternative if review rejects it: per-application display-name
   override.
4. **Unclaimed invisibility.** `ProfileVisibility.PRIVATE` on creation, plus
   explicit `accountState` filters in volunteer discovery search, marketplace
   queries, and digest enrollment — mirror the `suspendedAt: null` guard
   pattern already used across marketplace queries.
5. **Claiming bar = auth bar.** No password shortcuts on the landing page.
   Token possession is email possession, identical to magic link. Tokens are
   HMAC'd at rest (`tokenHash`), timing-safe compare, like the digest
   unsubscribe tokens.

## What this does to positioning

The differentiation statement — "the marketplace is a directory of orgs
already running their programs here" — currently has a soft spot: running a
program required volunteers to be users. This closes it. It is also the
concrete answer to the "meet orgs where they are" critique: where they are is
a spreadsheet. Concierge onboarding gets teeth: "email me your roster
spreadsheet, it's in the system tomorrow" becomes a script over
`staffVolunteerService`, no UI required.

## v1 Scope

- Schema changes above + backfill migration
- Add-volunteer form on `/app/volunteers` (single add) + roster badges
  (Not activated / Invited / Active / Declined)
- Optional invite email + `/welcome/[token]` landing page + claim flow
- ACTIVE-email and UNCLAIMED-email collision paths
- `shifts.assignVolunteer` staff mutation + attendance listing for unclaimed
- `canEmail()` guard + exclusion filters + audit log actions
- Feature flag (`FeatureFlag` model) for rollout
- Concierge import script under `scripts/` (Jason-operated, not UI)

## Deferred (deliberately)

- **CSV import UI.** Upgrade the existing `bulk-import-service` to create
  shadow users with name/phone columns *after* concierge imports teach us the
  real data mess. The existing email-only import stays untouched until then.
- **No-email volunteers.** Real (shelters have them), but requires making
  `submittedByEmail` nullable — a migration with broad read-path implications.
  Not worth blocking v1.
- **Shift reminder emails for unclaimed volunteers.** Org-toggled, off by
  default, needs its own consent thinking.
- **Invite analytics dashboard.** `VolunteerActivationInvite` rows carry the
  data; read it with SQL until there's a reason to build UI.
- **Dedupe/merge tooling.** The collision paths above prevent most duplicates
  at the door; a merge tool waits for evidence.

## Success Metrics

- Orgs with ≥10 roster records in week one of onboarding (the day-one-useful
  test)
- Staff-assigned shift signups for unclaimed volunteers (proves the
  management loop runs without activation)
- Invite → claim rate (curiosity metric, not a target: the feature succeeds
  even at 0% activation)

## Open Questions for Review

1. Should STAFF_ADDED applications default to `screeningStatus: CLEARED`
   rather than `REVIEW`? The coordinator vouching for them arguably is the
   screening. Leaning yes; needs a look at what REVIEW gates downstream.
2. Does staff manual attendance marking already exist as a mutation, or only
   QR/geo? Determines whether §Flows.3 attendance is new code or a filter fix.
3. Cross-org name visibility (Security §3): accept or per-application
   override?

---

*Next step: run `/plan-eng-review` and `/plan-ceo-review` per repo convention
before implementation.*
