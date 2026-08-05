## Summary

<!-- What changed and why. Link the issue or advisory if there is one. -->

## Test Coverage

<!-- What is newly tested, and what was mutation-verified. -->

---

## Manual verification

**Delete the sections below that do not apply.** Everything here exists because
CI cannot check it. `.github/workflows/ci.yml` runs lint, typecheck,
`docs:build`, unit, scripts, integration, and the deploy path (production seed
+ `next build`) — it does **not** run `pnpm e2e`. So every e2e-covered
behaviour falls to a human until that TODO lands. Tick what you actually did;
strike through with a reason what you skipped.

<!-- ------------------------------------------------------------------ -->
<!-- Applies to: any PR touching a RUNTIME dependency (next, next-auth,  -->
<!-- react, @prisma/client, resend, stripe, sentry, …)                   -->
<!-- ------------------------------------------------------------------ -->

### Runtime dependency bump

- [ ] **Vercel preview build is green.** CI now runs `next build` too, so this
      is no longer the only build signal — but it is the only one that runs the
      *production* branch of `scripts/vercel-build.sh` (the email-collision
      pre-check and `prisma migrate deploy`), against real data.
- [ ] **Lockfile diff is scoped.** `git diff pnpm-lock.yaml` moves only the
      intended package, its platform binaries, and peer re-resolution keys — no
      collateral version bumps. (`pnpm update <pkg>` takes the highest version
      the range permits, which for a `^` range means a MINOR, not the security
      patch. Pin explicitly with `pnpm add <pkg>@<exact>` and re-read the diff.)
- [ ] **Turbopack dev loop.** Boot `pnpm dev` and exercise a raw-SQL path
      (e.g. the ESG dashboard or an analytics query). The `Prisma.sql`
      `instanceof` class of bug reproduces **only** under `next dev` — never in
      the build, never in unit tests.

### Auth (`next-auth`, `@next-auth/prisma-adapter`, `nodemailer`, `src/server/auth.ts`)

- [ ] **Magic-link sign-in, end to end.** Request a link, open it from the
      inbox, land signed in. The integration suite drives `callbackHandler`
      directly; it does not prove the HTTP route or the mail round trip.
- [ ] **Google sign-in on an account that already has an email-provider user
      row.** This is the account-linking path, and it is the branch that
      distinguishes `events.signIn` from `events.updateUser` — the whole point
      of the SECURITY note at `auth.ts:143`.
- [ ] **`normalizeIdentifier` re-diffed against upstream.** Supplying it
      **replaces** next-auth's default outright, so an upstream tightening does
      not reach us. Compare `src/server/domain/magic-link-identifier.ts`
      against the installed version's patched default on every bump.
- [ ] **Signed-out `/app/volunteers` redirects to `/login` with `callbackUrl`
      preserved.**

### Image handling (`next`, `sharp`, `next/image`, `next.config.ts`)

- [ ] **`/locations/stockton` renders its hero screenshot.** Check it
      **visually**, not for a 200 — `LocationHero` hides the image on `onError`,
      so a broken `/_next/image` renders as an *empty right-hand column*, which
      looks like a layout choice rather than a failure. Six geo pages share the
      component.
- [ ] **Marketing screenshots load** on `/`, `/how-it-works`, `/screening`,
      `/for/animal-shelters`, in both light and dark.
- [ ] **If `images.remotePatterns` / `images.domains` was added**: re-open the
      dismissed sharp alert and upgrade sharp to >= 0.35.0. The dismissal
      rests on there being no remote origins — see
      `src/lib/next-config-images.guard.test.ts`.

### Request bodies / webhooks (`next`, webhook routes, `src/proxy.ts`)

- [ ] **Checkr and Sterling webhook signature verification passes** against a
      real delivery, and the `BackgroundCheckRequest` resolves. Both verify an
      HMAC over the raw bytes; anything that re-encodes the body rejects every
      legitimate delivery as forged. (This is the PII path — a silent break
      here is silent for a long time.)
- [ ] **Stripe and Resend webhooks still deliver.**
- [ ] **`/screening/feedback` submits.** The only Server Action in the app.

---

## Pre-Landing Review

<!-- Findings from /review, and what was done about each. -->
