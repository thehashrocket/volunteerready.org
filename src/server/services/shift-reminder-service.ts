import { sendEmail } from '../lib/email';
import { escapeHtml } from '../lib/html';
import { getTimezonesMatchingHour } from '../lib/timezone';
import { prisma } from '../repositories/prisma';

/**
 * Send reminder emails for shifts starting within the next 24 hours.
 *
 * Timezone-aware: only processes orgs whose local hour is 6am.
 * Only sends to CONFIRMED signups. Uses reminderSentAt for idempotency.
 * Safety cap of 500 signups per run (stragglers caught next hourly run).
 * Follows credential-expiry-service pattern: per-record try/catch.
 */
export async function sendShiftReminders(): Promise<{
	remindersSent: number;
}> {
	const now = new Date();
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);

	// Timezone-aware: only process orgs whose local hour is 6am
	const tzFilter = await getTimezoneFilter(6);

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
				organization: tzFilter,
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
					organization: { select: { name: true, timezone: true } },
				},
			},
		},
		take: 500, // Safety cap; reminderSentAt idempotency handles overflow
	});

	let remindersSent = 0;

	for (const signup of signups) {
		try {
			const email = signup.user.email;
			if (!email) continue;

			const shift = signup.shift;
			const orgTimezone = shift.organization.timezone ?? 'UTC';
			const startFormatted = shift.startTime.toLocaleString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				timeZone: orgTimezone,
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
				<p>You have an upcoming shift with <strong>${escapeHtml(shift.organization.name)}</strong>:</p>
				<table style="margin: 16px 0; border-collapse: collapse;">
					<tr>
						<td style="padding: 4px 16px 4px 0; color: #666;">Shift</td>
						<td style="padding: 4px 0;"><strong>${escapeHtml(shift.title)}</strong></td>
					</tr>
					<tr>
						<td style="padding: 4px 16px 4px 0; color: #666;">Time</td>
						<td style="padding: 4px 0;">${startFormatted}</td>
					</tr>
					<tr>
						<td style="padding: 4px 16px 4px 0; color: #666;">Location</td>
						<td style="padding: 4px 0;">${escapeHtml(location)}</td>
					</tr>
				</table>
				<p style="margin-top: 24px;">
					<a href="${process.env.NEXTAUTH_URL}/app/shifts"
					   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						View my shifts
					</a>
				</p>
				`,
				// Opts into the unclaimed guard: a staff-created volunteer who has
				// never signed in gets no automatic reminder. Disclosing that to
				// the coordinator, so they know to text them instead, is T23 in
				// docs/designs/staff-created-volunteers.md.
				{ suppressUnclaimed: true },
			);

			// Stamped without checking the result — pre-existing behaviour, kept
			// deliberately. A reminder is tied to one shift at one time, so a
			// missed one is not worth re-sending later; the other three opted-in
			// senders gate their bookkeeping on the result instead, because their
			// mail stays relevant and should go out once the volunteer claims.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Prisma WHERE clause for Organization.timezone that matches
 * orgs whose local time is currently the target hour.
 */
async function getTimezoneFilter(targetHour: number) {
	const allTimezones = await prisma.organization.findMany({
		select: { timezone: true },
		distinct: ['timezone'],
	});
	const tzValues = allTimezones.map((o) => o.timezone);
	const matching = getTimezonesMatchingHour(tzValues, targetHour);

	const hasNull = matching.includes(null);
	const nonNullTzs = matching.filter((tz): tz is string => tz !== null);

	const conditions: Record<string, unknown>[] = [];
	if (nonNullTzs.length > 0) {
		conditions.push({ timezone: { in: nonNullTzs } });
	}
	if (hasNull) {
		conditions.push({ timezone: null });
	}

	// If no timezones match, return impossible filter
	if (conditions.length === 0) {
		return { timezone: '__no_match__' };
	}

	return conditions.length === 1 ? conditions[0] : { OR: conditions };
}
