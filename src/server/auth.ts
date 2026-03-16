import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { cookies } from 'next/headers';
import type { NextAuthOptions, Session } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { buildMagicLinkEmail } from '@/lib/email/auth';
import type { CompanyMemberRole, Role } from '@/prisma/generated/client';
import { getResend } from '@/server/lib/resend';
import { prisma } from '@/server/repositories/prisma';

/** Extended session returned by our callback (custom fields NextAuth doesn't type) */
type SessionWithExt = Session & {
	sessionToken?: string | null;
	currentOrgId?: string | null;
	currentCompanyId?: string | null;
	orgId?: string | null;
	role?: Role | null;
	companyId?: string | null;
	companyRole?: CompanyMemberRole | null;
	user?: Session['user'] & { id?: string };
};

const emailFrom =
	process.env.EMAIL_FROM ?? 'VolunteerMatch <no-reply@volunteeermatch.local>';

export const authOptions: NextAuthOptions = {
	// biome-ignore lint/suspicious/noExplicitAny: PrismaAdapter expects node_modules PrismaClient, not our generated one
	adapter: PrismaAdapter(prisma as any),
	session: { strategy: 'database' },
	pages: { signIn: '/login' },
	debug: false,
	logger: {
		error(code, metadata) {
			console.error('next-auth error', code, metadata);
		},
		warn(code) {
			console.warn('next-auth warn', code);
		},
		debug(code, metadata) {
			console.debug('next-auth debug', code, metadata);
		},
	},
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID ?? '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
		}),
		EmailProvider({
			from: emailFrom,
			sendVerificationRequest: async ({ identifier, url }) => {
				const { subject, html } = buildMagicLinkEmail(url);
				await getResend().emails.send({
					from: emailFrom,
					to: identifier,
					subject,
					html,
				});
			},
		}),
	],
	callbacks: {
		session: async ({ session, user }) => {
			const s = session as SessionWithExt;
			// user.id is available with database sessions
			if (s.user && user?.id) {
				s.user.id = user.id;
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
					companyId = currentCompanyId;
					companyRole = match?.role ?? null;
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
