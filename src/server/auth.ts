import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextAuthOptions, Session } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { Resend } from 'resend';
import { buildMagicLinkEmail } from '@/lib/email/auth';
import type { Role } from '@/prisma/generated/client';
import { prisma } from '@/server/repositories/prisma';

/** Extended session returned by our callback (custom fields NextAuth doesn't type) */
type SessionWithExt = Session & {
	sessionToken?: string | null;
	currentOrgId?: string | null;
	orgId?: string | null;
	role?: Role | null;
	user?: Session['user'] & { id?: string };
};

const resend = new Resend(process.env.RESEND_API_KEY);
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
				await resend.emails.send({
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

			const rawSessionToken = s.sessionToken ?? null;
			s.sessionToken = rawSessionToken;

			let currentOrgId: string | null = null;
			let orgId: string | null = null;
			let role: Role | null = null;

			if (rawSessionToken) {
				// Single query: session → currentOrgId + user → all memberships.
				// Replaces 3 separate queries (session lookup in callback,
				// duplicate session lookup in createTRPCContext, membership lookup).
				const dbSession = await prisma.session.findUnique({
					where: { sessionToken: rawSessionToken },
					select: {
						currentOrgId: true,
						user: {
							select: {
								memberships: {
									select: { organizationId: true, role: true },
									orderBy: { createdAt: 'asc' },
								},
							},
						},
					},
				});

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
			}

			s.currentOrgId = currentOrgId;
			s.orgId = orgId;
			s.role = role;

			return s;
		},
	},
};
