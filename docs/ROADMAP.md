# ROADMAP

This document outlines the planned evolution of the VolunteerReady platform.

VolunteerReady is being built as a long-term nonprofit infrastructure platform.
The roadmap is organized into phases that gradually expand platform capabilities.

These phases are directional rather than strictly sequential. Some capabilities
may develop in parallel.

---

# Phase 1 — Volunteer Screening ✅ Complete

Goal: Build the core infrastructure for organizations to accept and evaluate volunteer applications.

Core capabilities:

- ✅ Organization creation and management
- ✅ Organization member roles and permissions
- ✅ Volunteer application submission (public apply form at `/apply/[orgSlug]`)
- ✅ Configurable screener questions (admin UI at `/app/screener`)
- ✅ Volunteer answers storage
- ✅ Audit logging
- ✅ Feature flag support

Admin capabilities built during this phase:

- ✅ Screener question management — create, edit, toggle active/inactive, reorder, delete
- ✅ Applications review — paginated list with status filter, enriched detail view, status update (Submitted → Review → Approved → Rejected)
- ✅ Volunteer "my applications" view — status tracking and answer history for applicants

Key entities:

- Organization
- OrganizationMember
- ScreenerQuestion
- VolunteerApplication
- VolunteerAnswer
- FeatureFlag
- AuditLog

This phase establishes the **multi-tenant architecture** and core data model.

---

# Phase 2 — Volunteer Opportunities ✅ Complete

Goal: Allow organizations to publish volunteer opportunities and allow volunteers to discover them.

Completed capabilities:

- ✅ Opportunity creation and management (org admin UI at `/app/opportunities`)
- ✅ Opportunity tags (free-text, per-opportunity, up to 10)
- ✅ Status workflow: DRAFT → PUBLISHED → CLOSED
- ✅ `staffProcedure` — STAFF+ role enforcement (OWNER/ADMIN/STAFF can manage; READONLY cannot)
- ✅ Public opportunity listings (volunteer-facing at `/opportunities/[orgSlug]`)
- ✅ Search, remote/in-person filter, and sort on public listings
- ✅ Application-to-opportunity linking
- ✅ Organization opportunity dashboards

Key entities added:

- VolunteerOpportunity
- OpportunityTag

This phase enables the **first public-facing discovery layer**.

---

# Phase 3 — Volunteer Matching Engine ✅ Complete

Goal: Match volunteers with opportunities using structured profile and preference data.

Completed capabilities:

- ✅ Opportunity skill requirements with REQUIRED/PREFERRED levels (demand side)
- ✅ Requirements displayed on public opportunity listing cards
- ✅ Volunteer skill profiles (supply side) — self-service skill management at `/app/my-skills`
- ✅ Pure matching/scoring domain logic — case-insensitive skill comparison, 0–100 scoring
- ✅ Match scoring algorithm: REQUIRED skills gate (missing → 0), PREFERRED skills add bonus (50 base + 50 × preferred ratio)
- ✅ Match types: PERFECT (100), PARTIAL (50–99), NONE (0)
- ✅ Personalized opportunity recommendations via tRPC `matching.getRecommendations`
- ✅ Match badges on public opportunity listings (green/amber/gray) for authenticated volunteers
- ✅ "Best match" sort option on public listings when logged in
- ✅ Comprehensive domain tests for scoring and ranking

Key entities added:

- OpportunityRequirement
- RequirementLevel (enum: REQUIRED / PREFERRED)
- VolunteerSkill

This phase introduces **intelligent discovery and matching**.

---

# Phase 4 — Volunteer Profiles ✅ Complete

Goal: Create reusable volunteer identities across organizations.

Completed capabilities:

- ✅ Volunteer profile creation and management (`/app/profile`)
- ✅ Profile completeness scoring (0–100 with MINIMAL/BASIC/STRONG/COMPLETE levels)
- ✅ Bio, phone, location (city/state/country), availability preferences
- ✅ Interest tags (free-text, up to 20)
- ✅ Profile visibility controls (PUBLIC / ORGS_ONLY / PRIVATE)
- ✅ Volunteer credential system — org-scoped verification badges
- ✅ Credential types: Background Check, Training Complete, ID Verified, Reference Check, Orientation Complete
- ✅ Credential lifecycle: PENDING → VERIFIED → EXPIRED / REVOKED
- ✅ Staff credential management UI (`/app/credentials`) — issue, revoke, remove
- ✅ Volunteer credential read-only view on profile page
- ✅ Cross-org profile stats (applications, orgs, skills, verified credentials)

Key entities added:

- VolunteerProfile (1:1 with User, cross-org)
- VolunteerCredential (org-scoped, unique per user + org + type)
- AvailabilityType, ProfileVisibility, CredentialType, CredentialStatus (enums)

This phase establishes **reusable volunteer identity** across organizations.

---

# Phase 5 — Scheduling and Shifts

Goal: Allow organizations to manage volunteer time and scheduling.

Planned capabilities:

- Shift creation
- Volunteer availability
- Signup management
- Attendance tracking
- Reminder notifications

Potential entities:

- Shift
- ShiftSignup
- Availability

This phase supports **operational volunteer coordination**.

---

# Phase 6 — Nonprofit Operations

Goal: Expand the platform into broader nonprofit infrastructure.

Possible areas:

Grant discovery and tracking

- GrantOpportunity
- GrantApplication
- GrantFitScore

Event management

- Event
- EventVolunteer
- EventSchedule

Organization analytics

- Volunteer engagement metrics
- Application conversion metrics
- Volunteer retention tracking

This phase evolves VolunteerReady into a **comprehensive nonprofit operations platform**.

---

# Platform Principles

Across all phases the platform must maintain:

Multi-tenant isolation
Organization-scoped data access
Clear domain boundaries
Audit logging of important actions
Extensible service architecture

---

# Long-Term Vision

VolunteerReady should eventually support a full ecosystem connecting:

- Volunteers
- Nonprofit organizations
- Volunteer opportunities
- Events
- Grants
- Community engagement

The goal is to provide a **shared infrastructure layer for volunteer engagement and nonprofit operations**.
