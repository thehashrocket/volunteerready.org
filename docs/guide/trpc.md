# tRPC

## Overview

- Context includes `session`, `orgId`, and `prisma`.
- Superjson is the default transformer.

## Base procedures

- `publicProcedure`: no auth
- `protectedProcedure`: requires session
- `orgProcedure`: requires session + orgId
- `adminProcedure`: requires ADMIN or OWNER

## App router

The app router includes `auth`, `org`, `health`, and `screener` routers and is exposed at `/api/trpc`.

## Public screener

- `screener.getPublicForm`: returns org + active questions by `orgSlug`.
- `screener.submit`: accepts public submissions (orgId + answers).
