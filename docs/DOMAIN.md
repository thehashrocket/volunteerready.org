# DOMAIN

This document defines the canonical domain model for the VolunteerReady platform.

VolunteerReady is a multi-tenant nonprofit platform that connects volunteers and organizations.
Every domain object must respect the tenant boundary defined by `Organization`.

This file exists to ensure developers and AI agents use **consistent terminology and modeling**.

---

# Core Entities

## User

Represents a person with an account in the system.

Users may:

- belong to multiple organizations
- apply as volunteers
- manage organizations depending on role

Users are global identities.

---

## Organization

Top-level tenant.

All operational data belongs to an organization.

Examples:

- screening questions
- volunteer applications
- organization members
- feature flags
- audit logs

Important rule:

All organization-owned records must contain `orgId`.

---

## OrganizationMember

Join table connecting a `User` to an `Organization`.

Contains the role the user has within that organization.

Roles:

- OWNER
- ADMIN
- STAFF
- READONLY

Constraint:

(organizationId, userId) must be unique.

---

## VolunteerApplication

Represents a volunteer submitting an application to an organization.

An application contains answers to screener questions.

Applications are organization-scoped.

Possible future states:

- submitted
- under_review
- accepted
- rejected
- withdrawn

---

## VolunteerAnswer

Represents a response to a screening question.

Each answer belongs to:

- a `VolunteerApplication`
- a `ScreenerQuestion`

---

## ScreenerQuestion

Questions configured by an organization to screen volunteers.

Examples:

- "Do you have experience working with children?"
- "Are you available on weekends?"
- "Have you passed a background check?"

Questions are organization-specific.

---

## FeatureFlag

Per-organization configuration toggle.

Allows features to be:

- enabled gradually
- tested safely
- rolled out per organization

Constraint:

(orgId, key) must be unique.

---

## AuditLog

Append-only record of organization activity.

Examples:

- volunteer application submitted
- screener question created
- member role changed

Rules:

- audit logs cannot be edited
- audit logs cannot be deleted
- logs should record important actions

---

# Tenant Boundary

The organization is the tenant boundary.

Rules:

1. Every organization-owned record must include `orgId`.
2. Queries must filter by `orgId`.
3. Users may belong to multiple organizations.
4. Authorization must check organization membership.

---

# Domain Vocabulary

Use these terms consistently across the codebase:

- Organization
- OrganizationMember
- VolunteerApplication
- VolunteerAnswer
- ScreenerQuestion
- FeatureFlag
- AuditLog

Do not introduce alternate terminology unless intentionally extending the model.
