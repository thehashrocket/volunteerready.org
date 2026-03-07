# SYSTEM_DIAGRAM

This document provides a visual overview of the VolunteerReady platform using Mermaid diagrams.

It is intended for:

- human developers onboarding to the project
- AI coding agents that need a visual mental model
- architects making decisions about future modules

VolunteerReady is being built as a multi-tenant nonprofit platform that will expand from volunteer screening into a larger VolunteerMatch-style ecosystem.

---

# 1. High-Level System Architecture

```mermaid
flowchart TD
    A[Volunteer / Staff User] --> B[Next.js App Router]
    B --> C[React UI Components]
    C --> D[tRPC Client]
    D --> E[tRPC Routers]
    E --> F[Service Layer]
    F --> G[Repository Layer]
    G --> H[Prisma ORM]
    H --> I[(PostgreSQL)]

    F --> J[Audit Logging]
    J --> I

    E --> K[Auth.js / NextAuth]
    K --> I

    K --> L[Google OAuth]
    K --> M[Resend Magic Link Email]
```

## Notes

- The UI should never talk directly to the database.
- tRPC routers are entry points, not workflow engines.
- Services contain business logic and orchestration.
- Repositories contain Prisma queries and persistence concerns.
- Authentication is handled via NextAuth/Auth.js with database sessions.

---

# 2. Layered Request Flow

```mermaid
flowchart LR
    A[Page / Component] --> B[tRPC Procedure]
    B --> C[Service]
    C --> D[Repository]
    D --> E[(Postgres)]

    C --> F[Audit Log]
    F --> E
```

## Intent

This is the default request pattern for most features in the system.

Use this flow unless there is a compelling reason not to.

---

# 3. Repository Structure and Responsibility Boundaries

```mermaid
flowchart TB
    subgraph UI
        A[src/app]
        B[src/components]
    end

    subgraph Server
        C[src/server/trpc]
        D[src/server/services]
        E[src/server/repositories]
        F[src/server/domain]
    end

    subgraph Data
        G[Prisma]
        H[(PostgreSQL)]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    D --> F
    E --> G
    G --> H
```

## Boundary Rules

- `src/app/**` handles routing and page composition.
- `src/components/**` contains reusable UI pieces.
- `src/server/trpc/**` contains routers and procedures only.
- `src/server/services/**` contains workflows and business orchestration.
- `src/server/repositories/**` contains Prisma access only.
- `src/server/domain/**` contains pure types, invariants, and helper logic.

---

# 4. Core Multi-Tenant Domain Model

```mermaid
erDiagram
    User ||--o{ OrganizationMember : belongs_to
    Organization ||--o{ OrganizationMember : has
    Organization ||--o{ FeatureFlag : has
    Organization ||--o{ AuditLog : has
    Organization ||--o{ ScreenerQuestion : has
    Organization ||--o{ VolunteerApplication : receives
    VolunteerApplication ||--o{ VolunteerAnswer : contains
    ScreenerQuestion ||--o{ VolunteerAnswer : answered_by

    User {
        string id
        string email
        string name
    }

    Organization {
        string id
        string name
    }

    OrganizationMember {
        string id
        string userId
        string organizationId
        string role
    }

    FeatureFlag {
        string id
        string orgId
        string key
        boolean enabled
    }

    AuditLog {
        string id
        string orgId
        string action
        datetime createdAt
    }

    ScreenerQuestion {
        string id
        string orgId
        string prompt
        string type
    }

    VolunteerApplication {
        string id
        string orgId
        string applicantName
        string applicantEmail
        string status
    }

    VolunteerAnswer {
        string id
        string applicationId
        string questionId
        string value
    }
```

## Important Invariants

- `Organization` is the tenant boundary.
- Users may belong to multiple organizations.
- `OrganizationMember` is unique per `(organizationId, userId)`.
- `FeatureFlag` is unique per `(orgId, key)`.
- `AuditLog` is append-only.

---

# 5. Authentication and Authorization Flow

```mermaid
sequenceDiagram
    participant U as User
    participant L as /login
    participant N as NextAuth/Auth.js
    participant P as Prisma Adapter
    participant D as PostgreSQL
    participant G as Google / Email Provider
    participant A as /app

    U->>L: Open login page
    L->>N: Start sign-in
    N->>G: OAuth or magic link flow
    G-->>N: Authentication result
    N->>P: Create/link User, Account, Session
    P->>D: Persist session data
    N-->>U: Set session cookie
    U->>A: Access authenticated app
```

## Auth Rules

- `/app/*` must be protected.
- `protectedProcedure` requires a valid session.
- `orgProcedure` requires session plus active organization context.
- `adminProcedure` requires `ADMIN` or `OWNER`.

---

# 6. Volunteer Application Submission Flow

```mermaid
sequenceDiagram
    participant V as Volunteer
    participant UI as Application Form UI
    participant R as screener.submitApplication
    participant S as volunteer-screening Service
    participant SQ as ScreenerQuestion Repository
    participant AR as VolunteerApplication Repository
    participant VR as VolunteerAnswer Repository
    participant AL as AuditLog Repository
    participant DB as PostgreSQL

    V->>UI: Fill out application and answers
    UI->>R: Submit mutation
    R->>S: Delegate validated input
    S->>SQ: Load and validate screener questions
    SQ->>DB: Query questions
    DB-->>SQ: Question records
    SQ-->>S: Valid questions

    S->>AR: Create volunteer application
    AR->>DB: Insert application
    DB-->>AR: Application row
    AR-->>S: Application created

    S->>VR: Create answer records
    VR->>DB: Insert answers
    DB-->>VR: Answer rows
    VR-->>S: Answers created

    S->>AL: Write audit event
    AL->>DB: Insert audit row
    DB-->>AL: Audit log stored

    S-->>R: Structured success result
    R-->>UI: Return response
    UI-->>V: Show confirmation
```

## Design Intent

This is the canonical example of how workflows should move through the stack:

- router validates
- service orchestrates
- repositories persist
- audit logs are written explicitly

---

# 7. Organization Access Control Model

```mermaid
flowchart TD
    A[Authenticated User] --> B{Has Session?}
    B -- No --> C[Reject Request]
    B -- Yes --> D{Has orgId?}
    D -- No --> E[Reject org-scoped action]
    D -- Yes --> F{OrganizationMember exists?}
    F -- No --> G[Reject Request]
    F -- Yes --> H{Role sufficient?}
    H -- No --> I[Reject Request]
    H -- Yes --> J[Allow Service Execution]
```

## Security Intent

Any org-scoped action should enforce:

1. authenticated user
2. active organization context
3. organization membership
4. role check when applicable

If any of those are skipped, the feature is likely insecure.

---

# 8. Feature Flag Evaluation Flow

```mermaid
flowchart LR
    A[Request hits router] --> B[Service begins]
    B --> C[Load org feature flags]
    C --> D{Flag enabled?}
    D -- Yes --> E[Run new behavior]
    D -- No --> F[Run default behavior]
```

## Use Cases

Feature flags should be used for:

- gradual rollout
- premium features
- experimental modules
- per-org capability toggles

---

# 9. Future Platform Expansion Map

```mermaid
flowchart TD
    A[Phase 1: Volunteer Screening] --> B[Phase 2: Volunteer Opportunities]
    B --> C[Phase 3: Matching Engine]
    C --> D[Phase 4: Volunteer Profiles]
    D --> E[Phase 5: Scheduling & Shifts]
    E --> F[Phase 6: Nonprofit Operations]

    F --> G[Grant Discovery]
    F --> H[Event Management]
    F --> I[Analytics & Reporting]
```

## Strategic Meaning

The current codebase should be treated as a platform foundation, not a one-off app.

New features should be added in ways that support these future modules without requiring a rewrite.

---

# 10. Agent Guidance

When generating code for this repository, prefer the design that is:

- explicit
- org-safe
- modular
- service-oriented
- easy to extend later

If unsure where code belongs:

- page composition -> `src/app/**`
- reusable UI -> `src/components/**`
- input/API entry -> `src/server/trpc/**`
- business workflow -> `src/server/services/**`
- database access -> `src/server/repositories/**`
- pure logic/types -> `src/server/domain/**`

The wrong default is usually:
- putting business logic in routers
- putting Prisma everywhere
- forgetting org scoping
- inventing parallel architecture patterns
