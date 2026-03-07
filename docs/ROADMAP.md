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

# Phase 2 — Volunteer Opportunities (In Progress)

Goal: Allow organizations to publish volunteer opportunities and allow volunteers to discover them.

Completed capabilities:

- ✅ Opportunity creation and management (org admin UI at `/app/opportunities`)
- ✅ Opportunity tags (free-text, per-opportunity, up to 10)
- ✅ Status workflow: DRAFT → PUBLISHED → CLOSED
- ✅ `staffProcedure` — STAFF+ role enforcement (OWNER/ADMIN/STAFF can manage; READONLY cannot)

Planned capabilities:

- Public opportunity listings
- Application-to-opportunity linking
- Organization opportunity dashboards

Key entities added:

- VolunteerOpportunity
- OpportunityTag

This phase enables the **first public-facing discovery layer**.

---

# Phase 3 — Volunteer Matching Engine

Goal: Match volunteers with opportunities using structured profile and preference data.

Planned capabilities:

- Volunteer interests and skills
- Opportunity requirement matching
- Search and filtering
- Matching score algorithms
- Personalized opportunity recommendations

Potential entities:

- VolunteerProfile
- VolunteerSkill
- OpportunityRequirement
- MatchScore

This phase introduces **intelligent discovery and matching**.

---

# Phase 4 — Volunteer Profiles

Goal: Create reusable volunteer identities across organizations.

Planned capabilities:

- Volunteer profile creation
- Skills and interests
- Background verification flags
- Historical applications
- Organization-specific visibility

Potential entities:

- VolunteerProfile
- VolunteerHistory
- VolunteerCredential

This phase allows volunteers to interact with multiple organizations efficiently.

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
