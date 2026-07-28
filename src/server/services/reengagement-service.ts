import { sendEmail } from '../lib/email';
import { escapeHtml } from '../lib/html';
import { prisma } from '../repositories/prisma';
import {
	findInactiveMembers,
	markReengagementSent,
} from '../repositories/reengagement-repo';

type Segment = '30d' | '60d' | '90d';

interface SegmentConfig {
	segment: Segment;
	daysInactive: number;
	subject: (orgName: string) => string;
	buildHtml: (opts: {
		userName: string;
		orgName: string;
		opportunities: { title: string }[];
	}) => string;
}

const SEGMENTS: SegmentConfig[] = [
	{
		segment: '90d',
		daysInactive: 90,
		subject: (org) => `We miss you at ${org}`,
		buildHtml: ({ userName, orgName }) => `
			<h2>We miss you, ${escapeHtml(userName)}!</h2>
			<p>It's been a while since you volunteered with <strong>${escapeHtml(orgName)}</strong>.</p>
			<p>Your community still needs you. Even a few hours can make a real difference.</p>
			<p style="margin-top: 24px;">
				<a href="${process.env.NEXTAUTH_URL}/app"
				   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
					Come back and volunteer
				</a>
			</p>
		`,
	},
	{
		segment: '60d',
		daysInactive: 60,
		subject: (org) => `New opportunities at ${org}`,
		buildHtml: ({ userName, orgName, opportunities }) => {
			let oppHtml = '';
			if (opportunities.length > 0) {
				oppHtml =
					'<h3 style="margin: 16px 0 8px; font-size: 14px;">Current opportunities:</h3><ul style="margin: 0; padding-left: 20px;">';
				for (const opp of opportunities) {
					oppHtml += `<li style="margin-bottom: 4px;">${escapeHtml(opp.title)}</li>`;
				}
				oppHtml += '</ul>';
			}
			return `
				<h2>Hey ${escapeHtml(userName)}, check out what's new!</h2>
				<p>There are new ways to get involved with <strong>${escapeHtml(orgName)}</strong>.</p>
				${oppHtml}
				<p style="margin-top: 24px;">
					<a href="${process.env.NEXTAUTH_URL}/app"
					   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
						View opportunities
					</a>
				</p>
			`;
		},
	},
	{
		segment: '30d',
		daysInactive: 30,
		subject: (org) => `We'd love to see you at ${org}`,
		buildHtml: ({ userName, orgName }) => `
			<h2>Hi ${escapeHtml(userName)}!</h2>
			<p>It's been a little while since you last volunteered with <strong>${escapeHtml(orgName)}</strong>.</p>
			<p>Check out the latest shifts and opportunities — we'd love to have you back!</p>
			<p style="margin-top: 24px;">
				<a href="${process.env.NEXTAUTH_URL}/app"
				   style="background-color: #1B3C2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
					See what's available
				</a>
			</p>
		`,
	},
];

/**
 * Send re-engagement emails to inactive volunteers.
 *
 * Processes 3 segments (30d, 60d, 90d) in descending order so that
 * 90-day members get their email before 30-day members if both qualify.
 * Each segment fires once per member-org pair. Activity resets the cycle.
 *
 * Uses cursor-based pagination. Returns nextCursor for CronJobRun recording.
 */
export async function sendReengagementEmails(): Promise<{
	emailsSent: number;
	membersProcessed: number;
	nextCursor: string | null;
}> {
	const now = new Date();
	const resumeCursor = await getLastCursor('volunteer-reengagement');

	let emailsSent = 0;
	let membersProcessed = 0;
	let lastId: string | null = null;

	// Process segments from longest inactive first (90d → 60d → 30d)
	for (const config of SEGMENTS) {
		const inactiveBefore = new Date(
			now.getTime() - config.daysInactive * 24 * 60 * 60 * 1000,
		);

		const members = await findInactiveMembers({
			inactiveBefore,
			segment: config.segment,
			cursor: resumeCursor,
			limit: 100,
		});

		for (const member of members) {
			membersProcessed++;
			lastId = member.id;

			try {
				const email = member.user.email;
				if (!email) continue;

				const userName = member.user.name ?? 'Volunteer';
				const orgName = member.organization.name;

				// For 60d segment, fetch recent opportunities scoped to the org
				let opportunities: { title: string }[] = [];
				if (config.segment === '60d') {
					opportunities = await prisma.volunteerOpportunity.findMany({
						where: {
							orgId: member.organizationId,
							status: 'PUBLISHED',
						},
						select: { title: true },
						orderBy: { createdAt: 'desc' },
						take: 3,
					});
				}

				const subject = config.subject(orgName);
				const html = config.buildHtml({
					userName,
					orgName,
					opportunities,
				});

				// Unrequested bulk mail — opts into the unclaimed guard. Nudging
				// someone to come back who has never been here would be absurd.
				const sent = await sendEmail(email, subject, html, {
					suppressUnclaimed: true,
				});

				if (sent) {
					await markReengagementSent(member.id, config.segment);
					emailsSent++;
				}
			} catch (e) {
				if ((e as { code?: string }).code === 'P2025') {
					console.warn(
						`[cron] Member ${member.id} already modified — skipping`,
					);
				} else {
					console.error(
						`[cron] Failed to send re-engagement for member ${member.id}`,
						e,
					);
				}
			}
		}
	}

	// Cursor: null if we processed fewer than 100 total (done with batch)
	const nextCursor = membersProcessed >= 100 ? lastId : null;

	return { emailsSent, membersProcessed, nextCursor };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLastCursor(jobName: string): Promise<string | null> {
	const lastRun = await prisma.cronJobRun.findFirst({
		where: { jobName, status: 'SUCCESS' },
		orderBy: { startedAt: 'desc' },
		select: { resultSummary: true },
	});
	const summary = lastRun?.resultSummary as
		| { nextCursor?: string | null }
		| null
		| undefined;
	return summary?.nextCursor ?? null;
}
