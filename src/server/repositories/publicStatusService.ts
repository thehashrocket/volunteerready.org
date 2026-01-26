import crypto from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@/prisma/generated/client';
import { statusTokenRepo } from '@/server/repositories/statusTokenRepo';
import { volunteerStatusRepo } from '@/server/repositories/volunteerStatusRepo';
import { sendStatusLinkEmail } from '@/server/repositories/sendStatusLinkEmail';

function sha256(input: string) {
	return crypto.createHash('sha256').update(input).digest('hex');
}

function randomToken() {
	return crypto.randomBytes(32).toString('hex');
}

export function publicStatusService(prisma: PrismaClient) {
	const tokens = statusTokenRepo(prisma);
	const apps = volunteerStatusRepo(prisma);

	return {
		async requestLink(email: string, baseUrl: string) {
			// Always behave the same (no enumeration)
			const raw = randomToken();
			const tokenHash = sha256(raw);

			const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
			await tokens.create({ email, tokenHash, expiresAt });

			const link = `${baseUrl}/apply/status?token=${raw}`;
			await sendStatusLinkEmail({ to: email, link });

			return { ok: true };
		},

		async getByToken(rawToken: string) {
			const tokenHash = sha256(rawToken);
			const record = await tokens.findValidByHash(tokenHash);

			if (!record) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'This link is invalid or expired. Request a new one.',
				});
			}

			const results = await apps.listByEmail(record.email);

			// consume token (one-time)
			await tokens.markUsed(record.id);

			return {
				email: record.email,
				applications: results.map((a) => ({
					id: a.id,
					orgName: a.organization.name,
					orgSlug: a.organization.slug,
					submittedAt: a.submittedAt,
					status: a.status,
					screeningStatus: a.screeningStatus,
				})),
			};
		},
	};
}
