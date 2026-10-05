'use server';

import { cookies } from 'next/headers';
import {
	INVALID_SURVEY_LINK_ERROR,
	parseOrgFeedbackType,
	SURVEY_QUESTIONS,
	surveyTokenCookie,
} from '@/server/domain/org-feedback';
import { submitOrgFeedback } from '@/server/services/org-feedback-service';

export type FeedbackFormState = {
	success?: boolean;
	error?: string;
	/** What the user typed, returned with an error so the form can refill. */
	answers?: Record<string, string>;
};

export async function submitFeedback(
	formData: FormData,
): Promise<FeedbackFormState> {
	const orgSlug = formData.get('orgSlug');
	const type = parseOrgFeedbackType(formData.get('type'));

	if (typeof orgSlug !== 'string' || !orgSlug || !type) {
		return { error: 'Invalid submission.' };
	}

	const answers: Record<string, string> = {};
	for (const { key } of SURVEY_QUESTIONS[type]) {
		const value = formData.get(key);
		if (typeof value === 'string') answers[key] = value;
	}

	const token = (await cookies()).get(surveyTokenCookie(orgSlug, type))?.value;
	const result = token
		? await submitOrgFeedback({
				orgSlug,
				type,
				token,
				answers: (key) => answers[key],
			})
		: { error: INVALID_SURVEY_LINK_ERROR };

	return 'error' in result ? { error: result.error, answers } : result;
}
