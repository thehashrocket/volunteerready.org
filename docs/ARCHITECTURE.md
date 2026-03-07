# Architecture

This document explains the architectural intent of the VolunteerReady platform for human developers and coding agents.

VolunteerReady is being built as a multi-tenant nonprofit platform that will evolve into a VolunteerMatch-style ecosystem for organizations, volunteers, screening, onboarding, and future nonprofit operations tooling.

---

# Architectural Principles

## Multi-tenant first

Every meaningful domain action must be scoped to an organization.

Assumptions:

- one user may belong to multiple organizations
- each organization has isolated data
- permissions are organization-specific
- features may be enabled per organization

If new code ignores `orgId`, it is probably wrong.

---

## Layered design

Each layer has a single responsibility:

- UI renders state and collects input
- API validates requests and delegates work
- services implement workflows
- repositories perform persistence
- domain contains invariants and pure logic

---

# Repository Structure

src/
 ├─ app/
 ├─ components/
 └─ server/
     ├─ domain/
     ├─ repositories/
     ├─ services/
     └─ trpc/

---

## src/app

Routing and page composition.

Should not contain business logic.

---

## src/components

Reusable UI components and forms.

Should not contain database queries or workflow orchestration.

---

## src/server/domain

Contains:

- domain types
- invariants
- pure functions

No framework or database logic.

---

## src/server/repositories

Database access layer.

Only Prisma queries should exist here.

---

## src/server/services

Application workflows.

Responsible for orchestrating repositories and enforcing business rules.

Example:

src/server/services/volunteer-screening.ts

---

## src/server/trpc

API layer.

Contains routers and procedures that call services.

Routers should stay thin.

---

# Core Domain Model

Entities:

- Organization
- OrganizationMember
- FeatureFlag
- AuditLog
- VolunteerApplication
- VolunteerAnswer
- ScreenerQuestion

Relationship overview:

User
 └─ OrganizationMember
      └─ Organization
           ├─ FeatureFlag
           ├─ AuditLog
           ├─ ScreenerQuestion
           └─ VolunteerApplication
                 └─ VolunteerAnswer

---

# Authentication

Authentication uses NextAuth with:

- Google OAuth
- Email magic links

Flow:

1. user visits /login
2. authentication completes
3. session created
4. user redirected to /app

---

# Authorization

tRPC procedure types:

- publicProcedure
- protectedProcedure
- orgProcedure
- adminProcedure

Use the narrowest access level possible.

---

# Request Flow

Typical request flow:

UI
 -> tRPC procedure
   -> service
     -> repositories
       -> Prisma/Postgres
     -> audit log if needed
   -> response
 -> UI render

---

# Coding Rules for Agents

1. Always respect organization scope
2. Keep business logic in services
3. Keep routers thin
4. Keep Prisma access inside repositories
5. Prefer explicit naming
6. Maintain domain vocabulary consistency

---

# Development Commands

pnpm install
pnpm dev
pnpm build
pnpm start
pnpm prisma migrate deploy
pnpm prisma db seed

Health check:

http://localhost:3005/health
