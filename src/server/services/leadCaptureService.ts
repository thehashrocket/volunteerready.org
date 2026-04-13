import type { LeadCaptureInput } from '@/server/domain/lead-capture';
import { getLeadSourceLabel } from '@/server/domain/lead-capture';
import { sendEmail } from '@/server/lib/email';
import { listLeads, upsertLead } from '@/server/repositories/leadCaptureRepo';

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export async function submitLead(input: LeadCaptureInput) {
	// Honeypot check — silently accept but don't save
	if (input.org_phone) {
		return { success: true };
	}

	const lead = await upsertLead({
		locationSlug: input.locationSlug,
		orgName: input.orgName,
		contactEmail: input.contactEmail,
		volunteerCount: input.volunteerCount,
		currentProcess: input.currentProcess,
		painPoints: input.painPoints,
		utmSource: input.utmSource,
		utmCampaign: input.utmCampaign,
		utmContent: input.utmContent,
	});

	// Fire-and-forget email notification to founder
	const notificationEmail = process.env.LEAD_NOTIFICATION_EMAIL;
	if (notificationEmail) {
		const sourceName = getLeadSourceLabel(input.locationSlug);
		const safeOrg = escapeHtml(input.orgName);
		const safeEmail = escapeHtml(input.contactEmail);
		const isVertical = input.locationSlug.startsWith('vertical-');

		const utmInfo =
			input.utmSource || input.utmCampaign
				? `<p><strong>Attribution:</strong> ${escapeHtml([input.utmSource, input.utmCampaign, input.utmContent].filter(Boolean).join(' / '))}</p>`
				: '';

		const followUp = isVertical
			? `<hr/><p><strong>Follow-up guidance:</strong> This lead came from the ${escapeHtml(sourceName)} vertical page. Prioritize outreach within 24 hours — vertical leads have higher intent.</p>`
			: '';

		sendEmail(
			notificationEmail,
			`New lead from ${sourceName}: ${input.orgName}`,
			`
				<h2>New Lead Captured</h2>
				<p><strong>Source:</strong> ${escapeHtml(sourceName)}</p>
				<p><strong>Organization:</strong> ${safeOrg}</p>
				<p><strong>Email:</strong> ${safeEmail}</p>
				${input.volunteerCount ? `<p><strong>Volunteer Count:</strong> ${escapeHtml(input.volunteerCount)}</p>` : ''}
				${input.currentProcess ? `<p><strong>Current Process:</strong> ${escapeHtml(input.currentProcess)}</p>` : ''}
				${input.painPoints ? `<p><strong>Pain Points:</strong> ${escapeHtml(input.painPoints)}</p>` : ''}
				${utmInfo}
				${followUp}
			`,
		).catch((err) =>
			console.error('[leadCapture] Notification email failed:', err),
		);
	}

	return { success: true, id: lead.id };
}

export async function getLeads(opts?: {
	locationSlug?: string;
	limit?: number;
	offset?: number;
}) {
	return listLeads(opts);
}
