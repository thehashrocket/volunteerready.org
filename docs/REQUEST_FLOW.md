# REQUEST_FLOW

This document describes the expected request and workflow patterns in the VolunteerReady platform.

It exists to help developers and AI coding agents understand how data and control should flow through the system.

The architecture follows a strict layered pattern:

UI -> tRPC Router -> Service -> Repository -> Database

Services orchestrate workflows. Routers remain thin.

---

# Standard Request Flow

Typical request lifecycle:

UI (React / Next.js page or component)
    -> tRPC Procedure
        -> Service Layer
            -> Repository Layer
                -> Prisma / PostgreSQL
            -> Optional Audit Log
        -> Return Result
    -> UI Update

---

# Example: Volunteer Application Submission

## Step-by-step flow

1. Volunteer opens application form.
2. UI collects answers to screener questions.
3. Client calls `screener.submitApplication` mutation.
4. Router validates input and ensures organization context.
5. Router calls `volunteer-screening` service.
6. Service validates screener questions and answers.
7. Service creates `VolunteerApplication` record.
8. Service creates `VolunteerAnswer` records.
9. Service writes `AuditLog` entry.
10. Result is returned to client.
11. UI displays success confirmation.

---

# Sequence Diagram

Volunteer
    -> UI Form
        -> tRPC Mutation (submitApplication)
            -> volunteer-screening Service
                -> ScreenerQuestion Repository
                -> VolunteerApplication Repository
                -> VolunteerAnswer Repository
                -> AuditLog Repository
                    -> Database

---

# Organization Membership Check

Any request involving organization data must confirm membership.

Expected flow:

Client
    -> tRPC Procedure
        -> Resolve session
        -> Resolve orgId
        -> Verify OrganizationMember
            -> Continue to Service

If membership fails, the request should return an authorization error.

---

# Feature Flag Flow

When features are gated:

Client
    -> tRPC Procedure
        -> Service
            -> FeatureFlag Repository
                -> Check flag state
                    -> Enable / Disable behavior

Feature flags allow gradual rollout.

---

# Admin Action Flow

Example: Creating a Screener Question

Admin User
    -> UI Form
        -> tRPC Mutation
            -> adminProcedure guard
                -> Screener Service
                    -> ScreenerQuestion Repository
                        -> Database
                    -> AuditLog Repository
                        -> Database
            -> Return created question

---

# Error Handling Pattern

Services should return structured errors.

Recommended pattern:

- validation errors
- authorization errors
- domain rule violations
- persistence failures

Routers should map service errors to appropriate responses.

---

# Key Principles

1. Routers validate and delegate.
2. Services orchestrate workflows.
3. Repositories handle database operations.
4. Domain rules remain explicit.
5. Organization scope is always enforced.
6. Important actions are logged.

---

# Anti-patterns to Avoid

Do not:

- call Prisma directly from UI
- place business logic in routers
- bypass services
- ignore organization scoping
- create hidden side effects in repositories

---

# Future Workflow Extensions

As VolunteerReady grows, request flows will support:

Volunteer Matching
    Volunteer -> Matching Engine -> Opportunity Recommendations

Volunteer Onboarding
    Application -> Onboarding Tasks -> Completion Tracking

Scheduling
    Volunteer -> Shift Signup -> Attendance Tracking

Grants Integration
    Organization -> Grant Discovery -> Application Workflows

These future flows should still follow the same layered architecture.

