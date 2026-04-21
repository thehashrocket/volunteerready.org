// src/server/services/volunteerApplicationService.ts
import { TRPCError } from '@trpc/server';
import { sendEmail } from '@/server/lib/email';
import { prisma } from '@/server/repositories/prisma';
import {
	withdrawApplication as getApplicationForWithdrawal,
	setApplicationWithdrawn,
} from '@/server/repositories/volunteer-applications';
import { tryNotify } from '@/server/services/notificationService';
import { submitVolunteerApplication } from '@/server/services/volunteer-screening';

export async function submitVolunteerApplicationBySlug(
	orgSlug: string,
	args: {
		submittedByEmail: string;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic volunteer profile shape
		profile: any;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic form responses
		responses: any[];
	},
) {
	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true },
	});

	if (!org) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Organization not found.',
		});
	}

	return submitVolunteerApplication(org.id, args);
}

const WITHDRAWABLE_STATUSES = new Set(['SUBMITTED', 'REVIEW']);

export async function withdrawVolunteerApplication(
	userId: string,
	applicationId: string,
) {
	const application = await getApplicationForWithdrawal(userId, applicationId);

	if (!application) {
		throw new TRPCError({
			code: 'NOT_FOUND',
			message: 'Application not found.',
		});
	}

	if (!WITHDRAWABLE_STATUSES.has(application.status)) {
		throw new TRPCError({
			code: 'FORBIDDEN',
			message: 'This application cannot be withdrawn.',
		});
	}

	const updated = await setApplicationWithdrawn(applicationId);

	await prisma.auditLog.create({
		data: {
			orgId: application.orgId,
			actorId: userId,
			action: 'STATUS_CHANGED',
			entityType: 'APPLICATION',
			entityId: applicationId,
			metadata: { from: application.status, to: 'WITHDRAWN' },
		},
	});

	void notifyWithdrawal(application);

	return updated;
}

async function notifyWithdrawal(application: {
	id: string;
	orgId: string;
	submittedByEmail: string;
	opportunityId: string | null;
	opportunity: { title: string } | null;
}) {
	const oppTitle = application.opportunity?.title ?? 'this opportunity';

	// Email to the volunteer confirming withdrawal
	const volunteerContent = `
		<h2 style="font-size: 20px; margin-bottom: 12px;">Application withdrawn</h2>
		<p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
			Your application for <strong>${escapeHtml(oppTitle)}</strong> has been withdrawn.
			If this was a mistake, you're welcome to apply again.
		</p>
		<a href="${process.env.NEXTAUTH_URL}/app/my-applications"
			style="display: inline-block; padding: 12px 24px; background-color: #1B3C2A; color: #FAFAF8; text-decoration: none; border-radius: 6px; font-weight: 600;">
			View My Applications
		</a>
	`;

	await sendEmail(
		application.submittedByEmail,
		`Application withdrawn — ${escapeHtml(oppTitle)}`,
		volunteerContent,
	).catch((err) =>
		console.error(
			'[volunteerApplicationService] withdrawal email failed:',
			err,
		),
	);

	// In-app notification to org admins/owners
	try {
		const org = await prisma.organization.findUnique({
			where: { id: application.orgId },
			select: {
				name: true,
				members: {
					where: { role: { in: ['ADMIN', 'OWNER'] } },
					select: { userId: true },
				},
			},
		});

		if (!org) return;

		for (const member of org.members) {
			void tryNotify({
				userId: member.userId,
				orgId: application.orgId,
				type: 'APPLICATION_STATUS',
				title: 'Volunteer withdrew their application',
				body: `A volunteer has withdrawn their application for ${escapeHtml(oppTitle)}.`,
				href: '/app/applications',
			});
		}
	} catch (err) {
		console.error(
			'[volunteerApplicationService] org withdrawal notification failed:',
			err,
		);
	}
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
