# Org Model

## Entities

- `Organization`: top-level tenant.
- `Organization.slug`: public slug used for volunteer applications (`/apply/[orgSlug]`).
- `OrganizationMember`: join table between `User` and `Organization` with role.
- `FeatureFlag`: per-org feature flags.
- `AuditLog`: append-only actions scoped to an org.
- `VolunteerApplication`: volunteer submissions per org.
- `VolunteerAnswer`: answers linked to an application.
- `ScreenerQuestion`: configurable per-org screening questions.
- Screener config stores decision logic under `configJson.rules` (e.g. `disqualifierRule`, `reviewIf`, and `reason`), and screening results include the reason plus the question prompt when present.

## Roles

- `OWNER`: full control
- `ADMIN`: elevated access
- `STAFF`: standard access
- `READONLY`: read-only access

## Invariants

- Users can belong to multiple orgs.
- `OrganizationMember` is unique on `(organizationId, userId)`.
- `FeatureFlag` is unique on `(orgId, key)`.
- `AuditLog` is append-only; no updates or deletes.
