import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { Resend } from 'resend';
import { prisma } from '@/server/repositories/prisma';
import { buildMagicLinkEmail } from '@/lib/email/auth';

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom =
	process.env.EMAIL_FROM ?? 'VolunteerMatch <no-reply@volunteeermatch.local>';

export const authOptions: NextAuthOptions = {
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
			// user.id is available with database sessions
			if (session.user && user?.id) {
				(session.user as any).id = user.id;
			}
			// With database strategy, NextAuth includes session.sessionToken
			// on the server side in many cases, but it may not be present on the client.
			// We'll *also* copy it into session so tRPC context can use it.
			const rawSessionToken = (session as any).sessionToken ?? null;

			if (rawSessionToken) {
				(session as any).sessionToken = rawSessionToken;

				const dbSession = await prisma.session.findUnique({
					where: { sessionToken: rawSessionToken },
					select: { currentOrgId: true },
				});

				(session as any).currentOrgId = dbSession?.currentOrgId ?? null;
			} else {
				(session as any).currentOrgId = null;
			}
			return session;
		},
	},
};

export async function getCurrentOrgId() {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	if (!userId) return null;

	const membership = await prisma.organizationMember.findFirst({
		where: { userId },
		orderBy: { createdAt: 'asc' },
		select: { organizationId: true },
	});

	return membership?.organizationId ?? null;
}
