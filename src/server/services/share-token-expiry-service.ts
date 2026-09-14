import { sendEmail } from '../lib/email';
import { prisma } from '../repositories/prisma';

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

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

			// `sendEmail` returns FALSE rather than throwing — for a Resend error and
			// for a bounce-suppressed address — so a bare `await` here can't tell a
			// lost send from a delivered one, and the `notifiedAt` stamp below would
			// have marked it "sent" either way. Read the boolean and skip the stamp
			// on failure: `notifiedAt` stays null, so the token is picked up again
			// by the `notifiedAt: null` filter on the next cron run instead of being
			// silently and permanently marked notified.
			const sent = await sendEmail(
				email,
				`Your share link expires in ${daysLeft} days`,
				`
				<h2>Your share link expires soon</h2>
				<p>Your <strong>${escapeHtml(credType)}</strong> share link for <strong>${escapeHtml(orgName)}</strong> expires in ${daysLeft} days.</p>
				<p>If you still need to share this credential, you can create a new share link from your credentials page.</p>
				<p style="margin-top: 24px;">
					<a href="${process.env.NEXTAUTH_URL}/app/settings/background-checks"
					   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						Manage credentials
					</a>
				</p>
				`,
			);

			if (!sent) {
				console.error(
					`[cron] Share token expiry notice NOT SENT for token ${token.id}: send failed or address suppressed`,
				);
				continue;
			}

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
