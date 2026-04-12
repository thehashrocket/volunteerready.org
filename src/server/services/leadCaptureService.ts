import { getLocation } from '@/lib/locations';
import type { LeadCaptureInput } from '@/server/domain/lead-capture';
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
	});

	// Fire-and-forget email notification to founder
	const notificationEmail = process.env.LEAD_NOTIFICATION_EMAIL;
	if (notificationEmail) {
		const location = getLocation(input.locationSlug);
		const locationName = location?.name ?? input.locationSlug;
		const safeOrg = escapeHtml(input.orgName);
		const safeEmail = escapeHtml(input.contactEmail);

		sendEmail(
			notificationEmail,
			`New lead from ${locationName}: ${input.orgName}`,
			`
				<h2>New Lead Captured</h2>
				<p><strong>Location:</strong> ${escapeHtml(locationName)}</p>
				<p><strong>Organization:</strong> ${safeOrg}</p>
				<p><strong>Email:</strong> ${safeEmail}</p>
				${input.volunteerCount ? `<p><strong>Volunteer Count:</strong> ${escapeHtml(input.volunteerCount)}</p>` : ''}
				${input.currentProcess ? `<p><strong>Current Process:</strong> ${escapeHtml(input.currentProcess)}</p>` : ''}
				${input.painPoints ? `<p><strong>Pain Points:</strong> ${escapeHtml(input.painPoints)}</p>` : ''}
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
