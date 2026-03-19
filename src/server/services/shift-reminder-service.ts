import { sendEmail } from '../lib/email';
import { prisma } from '../repositories/prisma';

/**
 * Send reminder emails for shifts starting within the next 24 hours.
 *
 * Only sends to CONFIRMED signups. Uses reminderSentAt for idempotency.
 * Follows credential-expiry-service pattern: per-record try/catch.
 */
export async function sendShiftReminders(): Promise<{
	remindersSent: number;
}> {
	const now = new Date();
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const signups = await prisma.shiftSignup.findMany({
		where: {
			status: 'CONFIRMED',
			reminderSentAt: null,
			shift: {
				startTime: {
					gt: now,
					lte: tomorrow,
				},
				status: { in: ['OPEN', 'FULL'] },
			},
		},
		include: {
			user: { select: { email: true, name: true } },
			shift: {
				select: {
					title: true,
					startTime: true,
					endTime: true,
					location: true,
					isRemote: true,
					organization: { select: { name: true } },
				},
			},
		},
	});

	let remindersSent = 0;

	for (const signup of signups) {
		try {
			const email = signup.user.email;
			if (!email) continue;

			const shift = signup.shift;
			const startFormatted = shift.startTime.toLocaleString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				timeZoneName: 'short',
			});
			const location = shift.isRemote
				? 'Remote'
				: (shift.location ?? 'See details');

			await sendEmail(
				email,
				'Your shift is tomorrow',
				`
				<h2>Your shift is tomorrow</h2>
				<p>You have an upcoming shift with <strong>${shift.organization.name}</strong>:</p>
				<table style="margin: 16px 0; border-collapse: collapse;">
					<tr>
						<td style="padding: 4px 16px 4px 0; color: #666;">Shift</td>
						<td style="padding: 4px 0;"><strong>${shift.title}</strong></td>
					</tr>
					<tr>
						<td style="padding: 4px 16px 4px 0; color: #666;">Time</td>
						<td style="padding: 4px 0;">${startFormatted}</td>
					</tr>
					<tr>
						<td style="padding: 4px 16px 4px 0; color: #666;">Location</td>
						<td style="padding: 4px 0;">${location}</td>
					</tr>
				</table>
				<p style="margin-top: 24px;">
					<a href="${process.env.NEXTAUTH_URL}/app/shifts"
					   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						View my shifts
					</a>
				</p>
				`,
			);

			await prisma.shiftSignup.update({
				where: { id: signup.id },
				data: { reminderSentAt: now },
			});

			remindersSent++;
		} catch (e) {
			if ((e as { code?: string }).code === 'P2025') {
				console.warn(`[cron] Signup ${signup.id} already modified — skipping`);
			} else {
				console.error(
					`[cron] Failed to send shift reminder for signup ${signup.id}`,
					e,
				);
			}
		}
	}

	return { remindersSent };
}
