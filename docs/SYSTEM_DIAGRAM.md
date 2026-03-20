# SYSTEM_DIAGRAM

This document provides a visual overview of the VolunteerReady platform using Mermaid diagrams.

It is intended for:

- human developers onboarding to the project
- AI coding agents that need a visual mental model
- architects making decisions about future modules

VolunteerReady is a multi-tenant nonprofit platform that connects volunteers, nonprofits, and corporate employers.

---

# 1. High-Level System Architecture

```mermaid
flowchart TD
    A[Volunteer / Staff / Corporate User] --> B[Next.js App Router]
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

    F --> N[Checkr API]
    F --> O[Stripe API]
    F --> P[Resend Email API]

    N -.->|Webhooks| Q[/api/checkr/webhook]
    O -.->|Webhooks| R[/api/stripe/webhook]

    Q --> F
    R --> F

    S[Vercel Cron] -.->|Daily 03:00 UTC| T[/api/cron/expire-credentials]
    T --> F
```

## Notes

- The UI should never talk directly to the database.
- tRPC routers are entry points, not workflow engines.
- Services contain business logic and orchestration.
- Repositories contain Prisma queries and persistence concerns.
- Authentication is handled via NextAuth/Auth.js with database sessions.
- External services (Checkr, Stripe) communicate via webhooks processed through service layer.

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
        L[src/server/lib/adapters]
    end

    subgraph Data
        G[Prisma]
        H[(PostgreSQL)]
    end

    subgraph External
        I[Checkr API]
        J[Stripe API]
        K[Resend API]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    D --> F
    D --> L
    E --> G
    G --> H
    L --> I
    L --> J
    D --> K
```

## Boundary Rules

- `src/app/**` handles routing and page composition.
- `src/components/**` contains reusable UI pieces.
- `src/server/trpc/**` contains routers and procedures only.
- `src/server/services/**` contains workflows and business orchestration.
- `src/server/repositories/**` contains Prisma access only.
- `src/server/domain/**` contains pure types, invariants, and helper logic.
- `src/server/lib/adapters/**` wraps external service APIs behind interfaces.

---

# 4. Core Multi-Tenant Domain Model

```mermaid
erDiagram
    User ||--o{ OrganizationMember : belongs_to
    User ||--o{ CompanyMember : belongs_to
    User ||--o| VolunteerProfile : has
    User ||--o{ VolunteerSkill : has
    User ||--o{ ShiftSignup : signs_up

    Organization ||--o{ OrganizationMember : has
    Organization ||--o{ ScreenerQuestion : has
    Organization ||--o{ VolunteerApplication : receives
    Organization ||--o{ VolunteerOpportunity : publishes
    Organization ||--o{ Shift : schedules
    Organization ||--o{ VolunteerCredential : issues
    VolunteerCredential ||--o{ CredentialShareToken : shared_via
    Organization ||--o{ BackgroundCheckRequest : initiates
    Organization ||--o{ FeatureFlag : has
    Organization ||--o{ AuditLog : has

    VolunteerApplication ||--o{ VolunteerAnswer : contains
    ScreenerQuestion ||--o{ VolunteerAnswer : answered_by
    VolunteerOpportunity ||--o{ OpportunityTag : tagged_with
    VolunteerOpportunity ||--o{ OpportunityRequirement : requires
    VolunteerOpportunity ||--o{ Shift : has_shifts
    VolunteerOpportunity }o--o{ VolunteerApplication : receives

    Shift ||--o{ ShiftSignup : has_signups

    CompanyAccount ||--o{ CompanyMember : has
    CompanyAccount ||--o{ CompanyNonprofitLink : sponsors

    User {
        string id
        string email
        string name
    }

    Organization {
        string id
        string name
        string slug
        enum planTier
        string stripeCustomerId
    }

    OrganizationMember {
        string userId
        string organizationId
        enum role
    }

    VolunteerApplication {
        string id
        string orgId
        string opportunityId
        enum status
        enum screeningStatus
    }

    VolunteerOpportunity {
        string id
        string orgId
        string title
        enum status
        int capacity
    }

    Shift {
        string id
        string orgId
        string opportunityId
        datetime startTime
        datetime endTime
        int capacity
        enum status
    }

    ShiftSignup {
        string id
        string shiftId
        string userId
        enum status
    }

    VolunteerCredential {
        string id
        string userId
        string orgId
        enum type
        enum status
        string sharedFromOrgId
        string sharedFromCredentialId
    }

    CredentialShareToken {
        string id
        string tokenHash
        string credentialId
        string createdByUserId
        datetime expiresAt
        enum status
        string claimedByOrgId
    }

    BackgroundCheckRequest {
        string id
        string orgId
        string userId
        enum provider
        enum status
        enum fcraStatus
    }

    VolunteerProfile {
        string id
        string userId
        string bio
        enum visibility
    }

    CompanyAccount {
        string id
        string name
        string slug
        enum planTier
    }
```

## Important Invariants

- `Organization` is the tenant boundary for nonprofit data.
- `CompanyAccount` is the tenant boundary for corporate data.
- Users may belong to multiple organizations and companies.
- `OrganizationMember` is unique per `(organizationId, userId)`.
- `VolunteerCredential` is unique per `(userId, orgId, type)`.
- `ShiftSignup` is unique per `(shiftId, userId)`.
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
- `staffProcedure` requires STAFF, ADMIN, or OWNER role.
- `adminProcedure` requires ADMIN or OWNER.
- `companyProcedure` requires company membership.
- `planTierProcedure(tier)` requires org plan at or above specified tier.

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

    S->>S: Evaluate screening rules (PASS / REVIEW / FAIL)

    S->>AR: Create volunteer application (with screening result)
    AR->>DB: Insert application
    DB-->>AR: Application row
    AR-->>S: Application created

    S->>VR: Create answer records
    VR->>DB: Insert answers
    DB-->>VR: Answer rows
    VR-->>S: Answers created

    S->>AL: Write audit event
    AL->>DB: Insert audit row (all in $transaction)
    DB-->>AL: Audit log stored

    S-->>R: Structured success result
    R-->>UI: Return response
    UI-->>V: Show confirmation
```

---

# 7. Background Check Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING: Staff initiates check

    PENDING --> COMPLETE: Webhook (clear)
    PENDING --> CONSIDER: Webhook (consider)
    PENDING --> FAILED: Webhook (adverse)
    PENDING --> CANCELLED: Staff cancels

    COMPLETE --> [*]: Auto-issue credential

    CONSIDER --> FCRA_FLOW: Staff action needed

    state FCRA_FLOW {
        NONE --> PRE_ADVERSE_SENT: Send pre-adverse notice
        PRE_ADVERSE_SENT --> ADVERSE_ACTION_SENT: Finalize (after 5 days)
        PRE_ADVERSE_SENT --> RESOLVED: Staff resolves favorably
        NONE --> RESOLVED: Staff issues credential directly
    }

    FAILED --> [*]: Terminal
    CANCELLED --> [*]: Terminal
```

---

# 8. Credential Share Token Lifecycle

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: Volunteer generates share link

    ACTIVE --> CLAIMED: Staff claims token
    ACTIVE --> EXPIRED: Time passes (30 days)
    ACTIVE --> EXPIRED: Volunteer revokes

    CLAIMED --> [*]: Credential copy created with provenance
    EXPIRED --> [*]: Token is no longer usable
```

---

# 9. Billing / Plan Tier Flow

```mermaid
sequenceDiagram
    participant S as Staff
    participant UI as /app/billing
    participant T as tRPC billing router
    participant B as billingService
    participant ST as Stripe API
    participant W as /api/stripe/webhook
    participant DB as PostgreSQL

    S->>UI: Click "Upgrade to Starter"
    UI->>T: billing.createCheckoutSession
    T->>B: Create Stripe checkout
    B->>ST: POST /v1/checkout/sessions
    ST-->>B: Checkout URL
    B-->>UI: Redirect to Stripe

    Note over ST: User completes payment

    ST->>W: POST webhook (subscription.created)
    W->>B: processWebhookEvent
    B->>DB: Update org planTier
    B->>DB: Write AuditLog + StripeWebhookEvent
    B->>P: Send billing lifecycle email (fire-and-forget)
    W-->>ST: 200 OK
```

---

# 10. Organization Access Control Model

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
    H -- Yes --> J{Plan tier sufficient?}
    J -- No --> K[FORBIDDEN - Upgrade required]
    J -- Yes --> L[Allow Service Execution]
```

## Security Intent

Any org-scoped action should enforce:

1. authenticated user
2. active organization context
3. organization membership
4. role check when applicable
5. plan tier check when applicable

If any of those are skipped, the feature is likely insecure.

---

# 11. Feature Flag Evaluation Flow

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

# 12. Platform Phase Map

```mermaid
flowchart TD
    A[Phase 1: Volunteer Screening ✅] --> B[Phase 2: Volunteer Opportunities ✅]
    B --> C[Phase 3: Matching Engine ✅]
    C --> D[Phase 4: Volunteer Profiles ✅]
    D --> E[Phase 5: Scheduling & Shifts ✅]
    E --> F[Phase 6A: Employer Accounts & Billing ✅]
    F --> G[Phase 6B: Background Checks ✅]

    G --> H[Phase 6C: Portable Credentials ✅]
    G --> I[Phase 6D: Corporate ESG Reporting ✅]
    G --> J[Phase 6E: Mobile PWA ✅]

    H --> K[Phase 7: Network Growth]
    I --> K
    J --> K

    K --> L[Grant Discovery]
    K --> M[Analytics & Reporting]
    K --> N[Volunteer Public Identity]
```

---

# 13. Agent Guidance

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
- external API wrappers -> `src/server/lib/adapters/**`

The wrong default is usually:
- putting business logic in routers
- putting Prisma everywhere
- forgetting org scoping
- inventing parallel architecture patterns
- storing PII in the database
