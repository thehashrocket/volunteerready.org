'use server';

import { isAffirmativeConsent } from '@/server/domain/case-study';
import { prisma } from '@/server/repositories/prisma';

export async function submitFeedback(formData: FormData) {
	const orgSlug = formData.get('orgSlug') as string;
	const type = formData.get('type') as string;

	if (!orgSlug || !type || !['DAY_7', 'DAY_30'].includes(type)) {
		return { error: 'Invalid submission.' };
	}

	const org = await prisma.organization.findUnique({
		where: { slug: orgSlug },
		select: { id: true },
	});
	if (!org) {
		return { error: 'Organization not found.' };
	}

	const feedbackType = type as 'DAY_7' | 'DAY_30';

	// Build responses object from form fields
	const responses: Record<string, string> = {};
	const questionKeys = [
		'working_well',
		'confusing_or_broken',
		'expected_missing',
	];
	if (feedbackType === 'DAY_30') {
		questionKeys.push('would_pay', 'consent_to_publicize');
	}

	for (const key of questionKeys) {
		const value = formData.get(key);
		if (typeof value === 'string' && value.trim()) {
			responses[key] = value.trim();
		}
	}

	if (Object.keys(responses).length === 0) {
		return { error: 'Please answer at least one question.' };
	}

	// Upsert: update the existing OrgFeedback with responses
	await prisma.orgFeedback.upsert({
		where: {
			orgId_type: { orgId: org.id, type: feedbackType },
		},
		update: { responses },
		create: {
			orgId: org.id,
			type: feedbackType,
			responses,
		},
	});

	// Auto-set consentToPublicize when DAY_30 has affirmative consent
	if (
		feedbackType === 'DAY_30' &&
		isAffirmativeConsent(responses.consent_to_publicize)
	) {
		await prisma.organization.update({
			where: { id: org.id },
			data: { consentToPublicize: true },
		});
	}

	return { success: true };
}
