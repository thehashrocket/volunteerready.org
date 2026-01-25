# Auth Flows

## Overview

Authentication uses NextAuth with the Prisma adapter and database sessions.

## Sign in

1) User hits `/login` and completes a provider flow (Google or email magic link).
2) NextAuth creates/links `User`, `Account`, and `Session` records.
3) The session cookie is set and used for server-side access.

## Session usage

- `getServerSession(authOptions)` reads the current session on the server.
- `auth.getSession` (tRPC) returns the session to the client.

## Route protection

- Middleware protects `/app/*` and redirects to `/login`.
- tRPC `protectedProcedure` blocks unauthenticated calls.
- The `/login` page uses `signIn()` from NextAuth.
- Email magic links are sent via Resend.
- Successful sign-in redirects to `/app`.
