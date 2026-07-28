import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { cookies } from 'next/headers';
import type { NextAuthOptions, Session } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { buildMagicLinkEmail } from '@/lib/email/auth';
import type { CompanyMemberRole, Role } from '@/prisma/generated/client';
import { sendNewUserAlert } from '@/server/lib/admin-alerts';
import { sendEmail } from '@/server/lib/email';
import { isEnabled } from '@/server/lib/env-flags';
import { getFromEmail } from '@/server/lib/resend';
import { prisma } from '@/server/repositories/prisma';
import { claimAccountOnSignIn } from '@/server/services/accountClaimService';

/** Kill switch for Google account linking. See `lib/env-flags.ts`. */
const GOOGLE_EMAIL_LINKING_FLAG = 'GOOGLE_EMAIL_LINKING_ENABLED';

/** Extended session returned by our callback (custom fields NextAuth doesn't type) */
type SessionWithExt = Session & {
	sessionToken?: string | null;
	currentOrgId?: string | null;
	currentCompanyId?: string | null;
	orgId?: string | null;
	role?: Role | null;
	companyId?: string | null;
	companyRole?: CompanyMemberRole | null;
	user?: Session['user'] & { id?: string; isPlatformAdmin?: boolean };
};

export const authOptions: NextAuthOptions = {
	// biome-ignore lint/suspicious/noExplicitAny: PrismaAdapter expects node_modules PrismaClient, not our generated one
	adapter: PrismaAdapter(prisma as any),
	session: { strategy: 'database' },
	pages: { signIn: '/login', verifyRequest: '/login/verify-request' },
	debug: false,
	logger: {
		error(code, metadata) {
			console.error('next-auth error', code, metadata);
		},
		warn(code) {
			console.warn('next-auth warn', code);
		},
		debug(code, metadata) {
			if (process.env.NODE_ENV !== 'production') {
				console.debug('next-auth debug', code, metadata);
			}
		},
	},
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID ?? '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
			// SECURITY: this flag is named "dangerous" for providers that assert
			// email addresses they have not verified. Google is not one of them —
			// it verifies ownership before asserting `email`, so the address in
			// the profile is proof the caller controls that mailbox, which is the
			// same proof our magic-link provider accepts.
			//
			// Without it, NextAuth throws AccountNotLinkedError whenever a `User`
			// row exists for the email but no `Account` row is linked to it
			// (next-auth/core/lib/callback-handler.js — the sole read of this
			// flag). That is the exact shape of a staff-created volunteer: org
			// staff type someone's address, we mint an UNCLAIMED shadow `User`,
			// and that person is then permanently locked out of Google sign-in by
			// an action they never took and cannot undo. It also already affects
			// anyone who signed up by magic link and later tries Google.
			//
			// Scoping this to UNCLAIMED rows only was considered and rejected: it
			// is a provider-level boolean, so narrowing it means hand-rolling the
			// linking decision in `callbacks.signIn` (which runs BEFORE
			// callbackHandler, at routes/callback.js:78 vs :104) to defend
			// against a threat Google's own verification already covers.
			allowDangerousEmailAccountLinking: isEnabled(GOOGLE_EMAIL_LINKING_FLAG),
			// AVAILABILITY: normalize the address on the READ path.
			//
			// `User.email` is canonicalized to lower(btrim(...)) by a database
			// trigger (migration 20260726225900). That trigger covers every WRITE,
			// but it cannot cover a LOOKUP: PrismaAdapter's `getUserByEmail` runs
			// `findUnique({ where: { email } })` with the raw address Google sent.
			// A profile email carrying any uppercase would miss the now-lowercased
			// row, NextAuth would fall through to `createUser`, the trigger would
			// lowercase that insert, and it would collide with the existing
			// `User_email_key` — a hard sign-in failure instead of linking to the
			// account the user already has.
			//
			// EmailProvider needs no equivalent: NextAuth's default
			// `normalizeIdentifier` already lowercases magic-link addresses.
			profile(profile) {
				return {
					id: profile.sub,
					name: profile.name,
					email: profile.email?.trim().toLowerCase() ?? null,
					image: profile.picture,
				};
			},
		}),
		EmailProvider({
			from: getFromEmail(),
			sendVerificationRequest: async ({ identifier, url }) => {
				const { subject, html } = buildMagicLinkEmail(url);
				const sent = await sendEmail(identifier, subject, html);
				if (!sent) {
					throw new Error(`Failed to send magic link email to ${identifier}`);
				}
			},
		}),
	],
	events: {
		createUser: async ({ user }) => {
			sendNewUserAlert({
				id: user.id,
				email: user.email ?? null,
				name: user.name ?? null,
			}).catch((err) =>
				console.error('[auth] Failed to send new user alert:', err),
			);
		},
		// SECURITY: `signIn`, NOT `updateUser`.
		//
		// The design plan specified `events.updateUser`. That is wrong in the one
		// case this exists to serve. On the Google account-linking path — the path
		// `allowDangerousEmailAccountLinking` above opens — next-auth assigns
		// `user = userByEmail` directly (core/lib/callback-handler.js) and never
		// calls `adapter.updateUser`, so `events.updateUser` never fires. A
		// volunteer who claimed their account with Google would stay UNCLAIMED and
		// silently email-suppressed forever. `signIn` fires on every path:
		// magic-link (routes/callback.js:295) and OAuth (:146) alike.
		//
		// AWAITED, not fire-and-forget. The plan called for `.catch(console.error)`
		// on a detached promise, matching `sendNewUserAlert` above — but a dropped
		// admin alert is a missing notification, while a dropped flip leaves a
		// real person permanently unable to receive mail they have asked for. On
		// serverless a detached promise can be killed when the response returns.
		// It is one indexed UPDATE on a path that runs once per sign-in.
		//
		// The try/catch is what keeps this from being a regression: a thrown error
		// here would surface to the user as a failed sign-in. Claiming is a
		// side effect of signing in and must never be able to prevent it.
		signIn: async ({ user }) => {
			try {
				await claimAccountOnSignIn(user.id);
			} catch (err) {
				console.error('[auth] Failed to claim account on sign-in:', {
					userId: user.id,
					err,
				});
			}
		},
	},
	callbacks: {
		session: async ({ session, user }) => {
			const s = session as SessionWithExt;
			// user.id is available with database sessions
			if (s.user && user?.id) {
				s.user.id = user.id;
			}

			// Expose isPlatformAdmin to the client
			// The Prisma adapter loads the full User row, so isPlatformAdmin is already present.
			// Also check PLATFORM_ADMIN_IDS env var fallback for consistency with platform-admin.ts.
			if (s.user && user?.id) {
				const dbFlag =
					(user as unknown as { isPlatformAdmin?: boolean }).isPlatformAdmin ??
					false;
				const envIds = (process.env.PLATFORM_ADMIN_IDS ?? '')
					.split(',')
					.map((id) => id.trim())
					.filter(Boolean);
				s.user.isPlatformAdmin = dbFlag || envIds.includes(user.id);
			}

			// NextAuth v4 database sessions do NOT pass sessionToken to this callback.
			// Fall back to reading it from the request cookie via next/headers.
			let rawSessionToken: string | null = s.sessionToken ?? null;
			if (!rawSessionToken) {
				try {
					const cookieStore = await cookies();
					rawSessionToken =
						cookieStore.get('next-auth.session-token')?.value ??
						cookieStore.get('__Secure-next-auth.session-token')?.value ??
						null;
				} catch {
					// cookies() throws outside request context (e.g. during build)
					rawSessionToken = null;
				}
			}
			s.sessionToken = rawSessionToken;

			let currentOrgId: string | null = null;
			let orgId: string | null = null;
			let role: Role | null = null;
			let currentCompanyId: string | null = null;
			let companyId: string | null = null;
			let companyRole: CompanyMemberRole | null = null;

			if (rawSessionToken) {
				// Single query: session → currentOrgId/currentCompanyId + user → memberships.
				const dbSession = await prisma.session.findUnique({
					where: { sessionToken: rawSessionToken },
					select: {
						currentOrgId: true,
						currentCompanyId: true,
						user: {
							select: {
								memberships: {
									select: { organizationId: true, role: true },
									orderBy: { createdAt: 'asc' },
								},
								companyMemberships: {
									select: { companyId: true, role: true },
									orderBy: { createdAt: 'asc' },
								},
							},
						},
					},
				});

				// Resolve org context
				currentOrgId = dbSession?.currentOrgId ?? null;
				const memberships = dbSession?.user?.memberships ?? [];

				if (currentOrgId) {
					const match = memberships.find(
						(m) => m.organizationId === currentOrgId,
					);
					orgId = currentOrgId;
					role = match?.role ?? null;
				} else {
					// No explicit org selected — fall back to first membership
					orgId = memberships[0]?.organizationId ?? null;
					role = memberships[0]?.role ?? null;
				}

				// Resolve company context
				currentCompanyId = dbSession?.currentCompanyId ?? null;
				const companyMemberships = dbSession?.user?.companyMemberships ?? [];

				if (currentCompanyId) {
					const match = companyMemberships.find(
						(m) => m.companyId === currentCompanyId,
					);
					if (match) {
						companyId = currentCompanyId;
						companyRole = match.role;
					} else {
						// Stale selection (e.g. removed from the company) — self-heal
						// to the first membership. Keeping the stale id would point
						// /app/company at a company the user can't access and loop
						// its redirect against the company layout's membership guard.
						companyId = companyMemberships[0]?.companyId ?? null;
						companyRole = companyMemberships[0]?.role ?? null;
						// Expose the healed id, not the stale one — CompanySwitcher
						// keys its "current" indicator off currentCompanyId.
						currentCompanyId = companyId;
					}
				} else {
					// No explicit company selected — fall back to first membership
					companyId = companyMemberships[0]?.companyId ?? null;
					companyRole = companyMemberships[0]?.role ?? null;
				}
			}

			s.currentOrgId = currentOrgId;
			s.orgId = orgId;
			s.role = role;
			s.currentCompanyId = currentCompanyId;
			s.companyId = companyId;
			s.companyRole = companyRole;

			return s;
		},
	},
};
