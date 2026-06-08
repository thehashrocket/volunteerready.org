import { sendEmail } from '@/server/lib/email';
import { escapeHtml } from '@/server/lib/html';
import {
	_resetAdminEmailsCacheForTests,
	getAdminEmails,
} from './admin-recipients';

export { _resetAdminEmailsCacheForTests };

// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------

async function sendAdminAlert(subject: string, html: string): Promise<void> {
	let recipients: string[];
	try {
		recipients = await getAdminEmails();
	} catch (err) {
		console.error('[adminAlerts] Failed to resolve admin recipients:', err);
		return;
	}

	if (recipients.length === 0) {
		console.warn('[adminAlerts] No recipients configured — alert not sent.');
		return;
	}

	await Promise.all(recipients.map((email) => sendEmail(email, subject, html)));
}

// ---------------------------------------------------------------------------
// Signup alerts
// ---------------------------------------------------------------------------

function sanitizeSubject(value: string): string {
	return value.replace(/[\r\n]+/g, ' ');
}

export async function sendNewUserAlert(user: {
	id: string;
	email: string | null;
	name: string | null;
}): Promise<void> {
	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `New user signed up: ${sanitizeSubject(user.email ?? user.id)}`;
	const html = `
		<p>A new user just signed up on VolunteerReady.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Name:</strong></td><td style="padding: 4px 8px;">${escapeHtml(user.name ?? '—')}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Email:</strong></td><td style="padding: 4px 8px;">${escapeHtml(user.email ?? '—')}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>User ID:</strong></td><td style="padding: 4px 8px;">${escapeHtml(user.id)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform/users/${escapeHtml(user.id)}" style="color: #1B3C2A;">View user &rarr;</a></p>` : ''}
	`;
	await sendAdminAlert(subject, html);
}

export async function sendNewOrgAlert(org: {
	id: string;
	name: string;
	slug: string;
}): Promise<void> {
	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `New nonprofit registered: ${sanitizeSubject(org.name)}`;
	const html = `
		<p>A new nonprofit organization was created on VolunteerReady.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Name:</strong></td><td style="padding: 4px 8px;">${escapeHtml(org.name)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Slug:</strong></td><td style="padding: 4px 8px;">${escapeHtml(org.slug)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Org ID:</strong></td><td style="padding: 4px 8px;">${escapeHtml(org.id)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform/orgs/${escapeHtml(org.id)}" style="color: #1B3C2A;">View organization &rarr;</a></p>` : ''}
	`;
	await sendAdminAlert(subject, html);
}

export async function sendNewCompanyAlert(company: {
	id: string;
	name: string;
	slug: string;
}): Promise<void> {
	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `New company registered: ${sanitizeSubject(company.name)}`;
	const html = `
		<p>A new corporate partner account was created on VolunteerReady.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Name:</strong></td><td style="padding: 4px 8px;">${escapeHtml(company.name)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Slug:</strong></td><td style="padding: 4px 8px;">${escapeHtml(company.slug)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Company ID:</strong></td><td style="padding: 4px 8px;">${escapeHtml(company.id)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform" style="color: #1B3C2A;">View platform admin &rarr;</a></p>` : ''}
	`;
	await sendAdminAlert(subject, html);
}

// ---------------------------------------------------------------------------
// Security alerts
// ---------------------------------------------------------------------------

export type ImpersonationAlertInput = {
	adminEmail: string | null;
	adminUserId: string;
	targetEmail: string | null;
	targetUserId: string;
	reason: string;
	expiresAt: Date;
	sessionId: string;
};

export async function sendImpersonationStartAlert(
	input: ImpersonationAlertInput,
): Promise<void> {
	let recipients: string[];
	try {
		recipients = await getAdminEmails();
	} catch (err) {
		console.error('[adminAlerts] Failed to resolve admin recipients:', err);
		return;
	}

	const filtered = input.adminEmail
		? recipients.filter(
				(r) => r.toLowerCase() !== input.adminEmail?.toLowerCase(),
			)
		: recipients;

	if (filtered.length === 0) {
		console.warn(
			'[adminAlerts] No recipients for impersonation alert (admin acting on themselves or no other admins).',
		);
		return;
	}

	const appUrl = process.env.NEXTAUTH_URL ?? '';
	const subject = `[Security] Impersonation started by ${sanitizeSubject(input.adminEmail ?? input.adminUserId)}`;
	const html = `
		<p>A platform admin started an impersonation session.</p>
		<table style="border-collapse: collapse; margin: 16px 0;">
			<tr><td style="padding: 4px 8px;"><strong>Admin:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.adminEmail ?? input.adminUserId)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Target:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.targetEmail ?? input.targetUserId)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Reason:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.reason)}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Expires:</strong></td><td style="padding: 4px 8px;">${input.expiresAt.toISOString()}</td></tr>
			<tr><td style="padding: 4px 8px;"><strong>Session:</strong></td><td style="padding: 4px 8px;">${escapeHtml(input.sessionId)}</td></tr>
		</table>
		${appUrl ? `<p><a href="${appUrl}/app/admin/platform/audit?impersonatedOnly=true" style="color: #1B3C2A;">Review impersonation activity &rarr;</a></p>` : ''}
		<p style="color: #666; font-size: 12px; margin-top: 16px;">If this was not authorized, revoke the admin's sessions immediately at <code>/app/admin/platform/users/${escapeHtml(input.adminUserId)}</code>.</p>
	`;

	await Promise.all(
		filtered.map((email) =>
			sendEmail(email, subject, html, { isCritical: true }),
		),
	);
}
