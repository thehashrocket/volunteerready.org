# Architecture

## Stack

- Next.js App Router
- React 19
- Prisma + Postgres
- NextAuth (Auth.js)
- tRPC v11
- Tailwind + shadcn/ui
- Biome

## Folder boundaries

- `src/app/**`: routing + page composition
- `src/server/services/**`: business logic
- `src/server/repositories/**`: Prisma access only
- `src/server/domain/**`: types + invariants + pure functions
- `src/server/trpc/**`: routers + procedures only
- `src/components/**`: reusable UI building blocks
