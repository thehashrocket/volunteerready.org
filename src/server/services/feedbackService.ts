import type { FeedbackStatus } from '@/prisma/generated/client';
import type { FeedbackSubmitInput } from '@/server/domain/user-feedback';
import { resolvePageName } from '@/server/domain/user-feedback';
import { sendEmail } from '@/server/lib/email';
import { escapeHtml } from '@/server/lib/html';
import { getAdminEmails } from '@/server/lib/admin-recipients';
import { writeAuditLogTx } from '@/server/repositories/auditRepo';
import {
	createFeedback,
	findFeedbackById,
	getFeedbackStats as repoGetFeedbackStats,
	listByUser as repoListByUser,
	listFeedback as repoListFeedback,
	updateFeedbackStatus as repoUpdateFeedbackStatus,
	updateFeedbackReply,
} from '@/server/repositories/feedbackRepo';
import { prisma } from '@/server/repositories/prisma';

// ---------------------------------------------------------------------------
// Org-scoped route prefixes (feedback from non-org pages gets orgId=null)
// ---------------------------------------------------------------------------

const NO_ORG_EXEMPT_PREFIXES = [
	'/app/welcome',
	'/app/onboarding',
	'/app/browse',
	'/app/my-applications',
	'/app/my-shifts',
	'/app/my-skills',
	'/app/my-feedback',
	'/app/profile',
	'/app/admin',
];

function isOrgScopedPage(pageUrl: string): boolean {
	try {
		const pathname = pageUrl.startsWith('http')
			? new URL(pageUrl).pathname
			: pageUrl.split('?')[0];

		if (!pathname.startsWith('/app/')) return false;
		if (pathname === '/app') return true; // dashboard can be org-scoped

		return !NO_ORG_EXEMPT_PREFIXES.some((prefix) =>
			pathname.startsWith(prefix),
		);
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

export async function submitFeedback(
	userId: string,
	orgId: string | null,
	role: string | null,
	input: FeedbackSubmitInput,
) {
	const pageName = resolvePageName(input.pageUrl);

	// Only tag org if on an org-scoped page
	const effectiveOrgId = orgId && isOrgScopedPage(input.pageUrl) ? orgId : null;

	// Resolve role for users without explicit role
	const userRole = role ?? 'VOLUNTEER';

	const feedback = await prisma.$transaction(async (tx) => {
		const record = await createFeedback(tx, {
			userId,
			orgId: effectiveOrgId,
			mood: input.mood,
			message: input.message,
			pageUrl: input.pageUrl,
			pageName,
			userAgent: input.userAgent ?? null,
			userRole,
		});

		await writeAuditLogTx(tx, {
			actorId: userId,
			orgId: effectiveOrgId,
			action: 'feedback.submit',
			entityType: 'UserFeedback',
			entityId: record.id,
			metadata: { mood: input.mood, pageName },
		});

		return record;
	});

	// Send notification email to platform admins (fire-and-forget)
	getAdminEmails()
		.then(async (emails) => {
			if (emails.length === 0) {
				console.warn('[feedbackService] No platform admin emails found');
				return;
			}
			const subject = `New feedback: ${input.mood} on ${pageName}`;
			const html = `
				<p>New feedback submitted:</p>
				<p><strong>Mood:</strong> ${escapeHtml(input.mood)}</p>
				<p><strong>Page:</strong> ${escapeHtml(pageName)}</p>
				<p><strong>Message:</strong></p>
				<div style="background-color: #F5F4F0; padding: 12px 16px; border-radius: 4px; margin: 8px 0;">
					${escapeHtml(input.message.slice(0, 200))}${input.message.length > 200 ? '...' : ''}
				</div>
				${process.env.NEXTAUTH_URL ? `<p><a href="${process.env.NEXTAUTH_URL}/app/admin/feedback" style="color: #1B3C2A;">View in admin panel &rarr;</a></p>` : ''}
			`;
			await Promise.all(emails.map((email) => sendEmail(email, subject, html)));
		})
		.catch((err) => {
			console.error('[feedbackService] Failed to send notification:', err);
		});

	return feedback;
}

export async function listFeedback(
	filters: Parameters<typeof repoListFeedback>[0],
) {
	return repoListFeedback(filters);
}

export async function updateFeedbackStatus(
	id: string,
	status: FeedbackStatus,
	actorId: string,
) {
	return prisma.$transaction(async (tx) => {
		const record = await repoUpdateFeedbackStatus(tx, id, status, actorId);

		await writeAuditLogTx(tx, {
			actorId,
			action: 'feedback.updateStatus',
			entityType: 'UserFeedback',
			entityId: id,
			metadata: { status },
		});

		return record;
	});
}

export async function replyToFeedback(
	id: string,
	message: string,
	actorId: string,
) {
	const feedback = await prisma.$transaction(async (tx) => {
		const record = await updateFeedbackReply(tx, id, message, actorId);

		await writeAuditLogTx(tx, {
			actorId,
			action: 'feedback.reply',
			entityType: 'UserFeedback',
			entityId: id,
			metadata: { messageLength: message.length },
		});

		return record;
	});

	// Send reply email to user (fire-and-forget)
	const full = await findFeedbackById(id);
	if (full?.user?.email) {
		const pageName = full.pageName ?? 'your feedback';
		const subject = `Re: Your feedback on ${pageName}`;
		const html = `
			<p>Hi${full.user.name ? ` ${escapeHtml(full.user.name)}` : ''},</p>
			<p>You shared feedback with us:</p>
			<div style="background-color: #E8E6E1; padding: 12px 16px; border-radius: 4px; margin: 8px 0; color: #5C5955;">
				${escapeHtml(full.message)}
			</div>
			<p>Here's our reply:</p>
			<p>${escapeHtml(message)}</p>
			<p style="color: #787571; font-size: 14px; margin-top: 24px;">This is a reply from the VolunteerReady team.</p>
		`;
		sendEmail(full.user.email, subject, html).catch((err) => {
			console.error('[feedbackService] Failed to send reply email:', err);
		});
	}

	return feedback;
}

export async function getMyFeedback(userId: string) {
	return repoListByUser(userId);
}

export async function getFeedbackStats(since?: Date) {
	return repoGetFeedbackStats(since);
}
