import type { OrgFeedbackType } from '@/prisma/generated/client';
import { sendEmail } from '@/server/lib/email';
import { prisma } from '@/server/repositories/prisma';

const FEEDBACK_WINDOWS: { type: OrgFeedbackType; daysAfterCreation: number }[] =
	[
		{ type: 'DAY_7', daysAfterCreation: 7 },
		{ type: 'DAY_30', daysAfterCreation: 30 },
	];

/**
 * Sends structured feedback emails to orgs that have reached day 7 or day 30
 * since creation. Idempotent — skips orgs that already have a matching
 * OrgFeedback record.
 */
export async function sendOrgFeedbackEmails() {
	let sent = 0;
	let skipped = 0;
	let failed = 0;

	for (const window of FEEDBACK_WINDOWS) {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - window.daysAfterCreation);

		// Find orgs created exactly N+ days ago that haven't been sent this feedback
		const orgs = await prisma.organization.findMany({
			where: {
				createdAt: { lte: cutoffDate },
				feedbacks: {
					none: { type: window.type },
				},
			},
			select: {
				id: true,
				name: true,
				slug: true,
				members: {
					where: { role: 'ADMIN' },
					select: { user: { select: { email: true } } },
					take: 1,
				},
			},
			take: 50,
		});

		for (const org of orgs) {
			const adminEmail = org.members[0]?.user?.email;
			if (!adminEmail) {
				skipped++;
				continue;
			}

			try {
				// Create OrgFeedback record first (idempotency)
				await prisma.orgFeedback.create({
					data: {
						orgId: org.id,
						type: window.type,
					},
				});

				const surveyUrl = `${process.env.NEXTAUTH_URL ?? 'https://volunteerready.org'}/screening/feedback?org=${org.slug}&type=${window.type}`;
				const subject =
					window.type === 'DAY_7'
						? `${org.name} — How's your first week going?`
						: `${org.name} — 30-day check-in`;

				const html = buildFeedbackEmailContent(
					org.name,
					window.type,
					surveyUrl,
				);
				await sendEmail(adminEmail, subject, html);
				sent++;
			} catch (error) {
				// Unique constraint violation = already sent (idempotent), skip
				if (
					error instanceof Error &&
					error.message.includes('Unique constraint')
				) {
					skipped++;
				} else {
					console.error(
						`[org-feedback] Failed to send ${window.type} feedback to org ${org.id}`,
						error,
					);
					failed++;
				}
			}
		}
	}

	if (failed > 0) {
		console.error(
			`[org-feedback] ${failed} email(s) failed to send (sent: ${sent}, skipped: ${skipped})`,
		);
	}

	return { sent, skipped, failed };
}

function buildFeedbackEmailContent(
	orgName: string,
	type: OrgFeedbackType,
	surveyUrl: string,
): string {
	const greeting =
		type === 'DAY_7'
			? `It's been a week since ${orgName} started using VolunteerReady. We'd love to hear how it's going.`
			: `${orgName} has been using VolunteerReady for 30 days! We'd love your feedback on how things are going.`;

	const questions =
		type === 'DAY_7'
			? `
        <li>What's working well?</li>
        <li>What's confusing or broken?</li>
        <li>Anything you expected that's missing?</li>
      `
			: `
        <li>What's working well?</li>
        <li>What's confusing or broken?</li>
        <li>Anything you expected that's missing?</li>
        <li>Would you pay $29/mo to keep using this?</li>
        <li>Can we use your org's name and a quote on our website?</li>
      `;

	const impactReportSection =
		type === 'DAY_30'
			? `
    <div style="margin: 24px 0; padding: 16px; background-color: #F5F4F0; border-radius: 8px;">
      <p style="color: #3D3B38; font-weight: 600; margin: 0 0 8px 0;">Your Impact Report is ready</p>
      <p style="color: #5C5955; font-size: 14px; margin: 0 0 12px 0;">See how ${orgName} has used VolunteerReady over the past 30 days.</p>
      <a href="${process.env.NEXTAUTH_URL ?? 'https://volunteerready.org'}/app/impact-report" style="color: #1B3C2A; font-weight: 600; text-decoration: underline;">View Impact Report</a>
    </div>
    `
			: '';

	return `
    <p style="color: #3D3B38; line-height: 1.6;">${greeting}</p>
    ${impactReportSection}
    <p style="color: #3D3B38; line-height: 1.6;">We're asking a few quick questions:</p>
    <ul style="color: #5C5955; line-height: 1.8; padding-left: 20px;">
      ${questions}
    </ul>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${surveyUrl}" style="display: inline-block; background-color: #1B3C2A; color: white; text-decoration: none; padding: 12px 32px; border-radius: 9999px; font-weight: 600;">
        Share your feedback
      </a>
    </div>
    <p style="color: #787571; font-size: 14px;">
      This takes less than 2 minutes. Your feedback directly shapes the product.
    </p>
  `;
}
