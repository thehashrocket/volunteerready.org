import { sendEmail } from '../lib/email';
import { prisma } from '../repositories/prisma';

const DAYS_BEFORE_EXPIRY = 7;

/**
 * Send expiry notification emails for credential share tokens expiring
 * within 7 days. Piggybacks on the existing 03:00 UTC cron.
 *
 * Follows credential-expiry-service pattern: per-record try/catch,
 * idempotency via notifiedAt field.
 */
export async function notifyExpiringShareTokens(): Promise<{
	tokensNotified: number;
}> {
	const now = new Date();
	const expiryThreshold = new Date(now);
	expiryThreshold.setDate(expiryThreshold.getDate() + DAYS_BEFORE_EXPIRY);

	const tokens = await prisma.credentialShareToken.findMany({
		where: {
			status: 'ACTIVE',
			notifiedAt: null,
			expiresAt: {
				gt: now,
				lte: expiryThreshold,
			},
		},
		include: {
			createdBy: { select: { email: true, name: true } },
			credential: {
				select: {
					type: true,
					organization: { select: { name: true } },
				},
			},
		},
	});

	let tokensNotified = 0;

	for (const token of tokens) {
		try {
			const email = token.createdBy.email;
			if (!email) continue;

			const credType = token.credential.type.replace(/_/g, ' ').toLowerCase();
			const orgName = token.credential.organization.name;
			const daysLeft = Math.ceil(
				(token.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
			);

			await sendEmail(
				email,
				`Your share link expires in ${daysLeft} days`,
				`
				<h2>Your share link expires soon</h2>
				<p>Your <strong>${credType}</strong> share link for <strong>${orgName}</strong> expires in ${daysLeft} days.</p>
				<p>If you still need to share this credential, you can create a new share link from your credentials page.</p>
				<p style="margin-top: 24px;">
					<a href="${process.env.NEXTAUTH_URL}/app/credentials"
					   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						Manage credentials
					</a>
				</p>
				`,
			);

			await prisma.credentialShareToken.update({
				where: { id: token.id },
				data: { notifiedAt: now },
			});

			tokensNotified++;
		} catch (e) {
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(
					`[cron] Share token ${token.id} already modified — skipping`,
				);
			} else {
				console.error(
					`[cron] Failed to notify share token expiry ${token.id}`,
					e,
				);
			}
		}
	}

	return { tokensNotified };
}
