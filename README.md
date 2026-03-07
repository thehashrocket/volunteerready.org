# VolunteerReady Platform

VolunteerReady is a multi-tenant SaaS platform designed to help nonprofit organizations recruit, screen, and manage volunteers.

The system is being built as the foundation for a larger VolunteerMatch-style ecosystem where nonprofits can:

- publish volunteer opportunities
- screen and onboard volunteers
- manage organizational members
- track volunteer activity
- integrate with future tools like grants, events, and nonprofit operations

The platform is intentionally designed as a modular nonprofit infrastructure layer, not just a form builder.

---

# Vision

VolunteerReady aims to become a central operating system for nonprofit volunteer engagement.

Long-term goals include:

- Volunteer discovery and matching
- Volunteer screening and onboarding
- Organization management
- Volunteer activity tracking
- Grant opportunity integration
- Cross-organization volunteer identity
- Nonprofit analytics and reporting

The current system implements the core primitives required to support this ecosystem.

---

# Core Concepts

## Organization

An organization is the top-level tenant in the system.

Each organization has:

- members
- volunteers
- screening questions
- volunteer applications
- feature flags
- audit logs

Organizations are fully isolated from each other.

---

## OrganizationMember

Join table between `User` and `Organization`.

Contains role information used for authorization.

Roles:

- OWNER
- ADMIN
- STAFF
- READONLY

Users may belong to multiple organizations.

---

## VolunteerApplication

Represents a volunteer submission to an organization.

Applications are composed of answers to screening questions.

---

## VolunteerAnswer

Represents an answer to a `ScreenerQuestion`.

Answers are tied to a specific `VolunteerApplication`.

---

## ScreenerQuestion

Questions configured by organizations to screen volunteers.

Each organization controls its own screening questions.

---

## FeatureFlag

Per-organization feature toggles.

Used to enable or disable experimental or premium functionality.

---

## AuditLog

Append-only log of organization actions.

Used for traceability and compliance.

Audit logs cannot be edited or deleted.

---

# Architecture

## Tech Stack

- Next.js (App Router)
- React 19
- Prisma ORM
- PostgreSQL
- NextAuth (Auth.js)
- tRPC v11
- Tailwind CSS
- shadcn/ui
- Biome

---

# Repository Structure

src/
 ├─ app/                # Next.js routes and page composition
 ├─ components/         # Reusable UI components
 └─ server/
     ├─ domain/         # Domain types, invariants, pure functions
     ├─ repositories/   # Database access layer (Prisma only)
     ├─ services/       # Business logic and workflows
     └─ trpc/           # API routers and procedures

---

# Development

## Install dependencies

pnpm install

## Start development server

pnpm dev

Health endpoint:

http://localhost:3005/health

---

# Environment Variables

DATABASE_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
EMAIL_FROM

---

# Database

PostgreSQL is used as the primary database.

Prisma is the ORM.

Apply migrations:

pnpm prisma migrate deploy

Seed development data:

pnpm prisma db seed

---

# Long-Term Goal

VolunteerReady aims to become the infrastructure layer for nonprofit volunteer engagement.

The platform will eventually connect:

- volunteers
- nonprofits
- opportunities
- grants
- events

into a unified ecosystem.
