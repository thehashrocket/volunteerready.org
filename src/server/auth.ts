import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { cookies } from 'next/headers';
import type { NextAuthOptions, Session } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { buildMagicLinkEmail } from '@/lib/email/auth';
import type { CompanyMemberRole, Role } from '@/prisma/generated/client';
import { normalizeMagicLinkIdentifier } from '@/server/domain/magic-link-identifier';
import { sendNewUserAlert } from '@/server/lib/admin-alerts';
import { sendEmail } from '@/server/lib/email';
import { isEnabled } from '@/server/lib/env-flags';
import { getFromEmail } from '@/server/lib/resend';
import { prisma } from '@/server/repositories/prisma';
import { wasUserCreatedWithin } from '@/server/repositories/userAccountStateRepo';
import { claimAccountOnSignIn } from '@/server/services/accountClaimService';

/**
 * How recently a `User` row must have been created for a sign-up alert to be
 * genuine. See `wasUserCreatedWithin` for why this is an age check at all.
 */
const NEW_USER_ALERT_WINDOW_MS = 5 * 60 * 1000;

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
			// row exists for the email but no `Account` row is linked to it — the
			// only place this flag is read in the compiled
			// `next-auth/core/lib/callback-handler.js`. That is the exact shape of
			// a staff-created volunteer: org staff type someone's address, we mint
			// an UNCLAIMED shadow `User`, and that person is then permanently
			// locked out of Google sign-in by an action they never took and cannot
			// undo. It also already affects anyone who signed up by magic link and
			// later tries Google.
			//
			// Scoping this to UNCLAIMED rows only was considered and rejected: it
			// is a provider-level boolean, so narrowing it means hand-rolling the
			// linking decision in `callbacks.signIn` — which the
			// `provider.type === 'oauth'` branch of `core/routes/callback.js`
			// invokes before it reaches `callbackHandler` — to defend against a
			// threat Google's own verification already covers.
			//
			// Behaviour verified against next-auth 4.24.14.
			allowDangerousEmailAccountLinking: isEnabled(
				'GOOGLE_EMAIL_LINKING_ENABLED',
			),
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
			// EmailProvider needs its own equivalent, and it is NOT merely a
			// lowercasing concern — see `normalizeMagicLinkIdentifier` below.
			// (This comment previously said the default normalizer sufficed
			// because it "already lowercases magic-link addresses". That was
			// true and beside the point: the default validated BEFORE Unicode
			// normalization, which is GHSA-7rqj-j65f-68wh.)
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
			// SECURITY: supplying this is the workaround GHSA-7rqj-j65f-68wh
			// prescribes for the critical homoglyph-`@` bypass in next-auth's
			// DEFAULT normalizer. We are on the patched 4.24.15, so this is
			// defence in depth rather than the fix — it mirrors upstream's
			// semantics exactly (NFKC first, then the same validations), so the
			// two cannot disagree about which addresses are valid, and it keeps
			// holding if a later release regresses. Full attack diagram and the
			// rationale for mirroring rather than tightening live in
			// `domain/magic-link-identifier.ts`.
			normalizeIdentifier: normalizeMagicLinkIdentifier,
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
		// `events.createUser` does NOT mean a user was created, once
		// `allowDangerousEmailAccountLinking` is on. next-auth's OAuth branch
		// picks between `user = userByEmail` and `createUser()`, then fires this
		// event unconditionally after the if/else — so it also fires for a row
		// that already existed and was merely linked to a Google account.
		// Without the age check, every staff-created volunteer who claims their
		// account with Google pages admins about a "new user" who has been in
		// the database for weeks. Alerting is best-effort, so a failure to
		// determine age falls through to sending.
		createUser: async ({ user }) => {
			const isGenuinelyNew = await wasUserCreatedWithin(
				user.id,
				NEW_USER_ALERT_WINDOW_MS,
			).catch(() => true);
			if (!isGenuinelyNew) return;

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
		// `allowDangerousEmailAccountLinking` above opens — `callback-handler`
		// assigns `user = userByEmail` directly and never calls
		// `adapter.updateUser`, so `events.updateUser` never fires. A volunteer
		// who claimed their account with Google would stay UNCLAIMED and silently
		// email-suppressed forever. `events.signIn` fires from both the
		// `provider.type === 'email'` and `provider.type === 'oauth'` branches of
		// `core/routes/callback.js`. Verified against next-auth 4.24.14.
		//
		// AWAITED, not detached: on serverless a detached promise can be killed
		// when the response returns, leaving the volunteer permanently
		// email-suppressed. The try/catch is what makes that safe — a throw here
		// would otherwise surface to the person as a failed sign-in, and claiming
		// is a side effect of signing in, never a precondition for it.
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
		// SECURITY: enforce the premise `allowDangerousEmailAccountLinking` rests on.
		//
		// That flag lets a Google sign-in adopt an EXISTING `User` row purely
		// because the email strings match. The justification above is that Google
		// verifies mailbox ownership before asserting `email` — but next-auth
		// never checks the claim that says so, and our `profile()` mapper drops
		// it. Without this callback the justification is an assertion, not a
		// control, and the exposed set is every row in `User`, including org
		// owners and platform admins, not just staff-created shadow rows.
		//
		// `email_verified` is false on Google Workspace / Cloud Identity accounts
		// whose domain ownership was never DNS-verified. Refusing those is what
		// makes the linking decision safe; it is NOT the UNCLAIMED-scoping design
		// rejected earlier, which re-derived the linking decision itself. This
		// only asserts a precondition.
		//
		// Runs BEFORE `callbackHandler` in the `provider.type === 'oauth'` branch
		// of next-auth's `core/routes/callback.js`, so returning false here
		// prevents the link rather than undoing it. Verified against 4.24.14.
		//
		// Everything that is not a Google OAuth sign-in returns true untouched —
		// magic link most of all, since it is the only way out of UNCLAIMED and
		// gating it would lock out the exact people this feature creates.
		signIn: async ({ account, profile }) => {
			if (account?.provider !== 'google') return true;
			const verified = (profile as { email_verified?: boolean } | undefined)
				?.email_verified;
			if (verified === true) return true;
			console.warn('[auth] Refused Google sign-in with unverified email:', {
				email: profile?.email ?? null,
				email_verified: verified ?? null,
			});
			return false;
		},
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
