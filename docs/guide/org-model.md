# Org Model

## Entities

- `Organization`: top-level tenant.
- `OrganizationMember`: join table between `User` and `Organization` with role.
- `FeatureFlag`: per-org feature flags.
- `AuditLog`: append-only actions scoped to an org.

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
