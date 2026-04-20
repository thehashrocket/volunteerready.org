import { sendEmail } from '@/server/lib/email';
import { escapeHtml } from '@/server/lib/html';
import { prisma } from '@/server/repositories/prisma';

let _adminEmailsCache: string[] | null = null;
let _adminEmailsCacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function _resetPlatformAdminEmailsCacheForTests() {
	_adminEmailsCache = null;
	_adminEmailsCacheExpiry = 0;
}

export async function getPlatformAdminEmails(): Promise<string[]> {
	const override = process.env.PLATFORM_ADMIN_ALERT_EMAIL;
	if (override) return [override];

	const now = Date.now();
	if (_adminEmailsCache && now < _adminEmailsCacheExpiry) {
		return _adminEmailsCache;
	}

	const dbAdmins = await prisma.user.findMany({
		where: { isPlatformAdmin: true },
		select: { id: true, email: true },
	});

	const envIds = (process.env.PLATFORM_ADMIN_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);
	const dbAdminIds = new Set(dbAdmins.map((a) => a.id));
	const missingEnvIds = envIds.filter((id) => !dbAdminIds.has(id));

	let envAdmins: { email: string | null }[] = [];
	if (missingEnvIds.length > 0) {
		envAdmins = await prisma.user.findMany({
			where: { id: { in: missingEnvIds } },
			select: { email: true },
		});
	}

	_adminEmailsCache = [...dbAdmins, ...envAdmins]
		.map((a) => a.email)
		.filter((e): e is string => !!e);
	_adminEmailsCacheExpiry = now + CACHE_TTL_MS;
	return _adminEmailsCache;
}

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
		recipients = await getPlatformAdminEmails();
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
	const subject = `[Security] Impersonation started by ${input.adminEmail ?? input.adminUserId}`;
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
