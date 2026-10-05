/**
 * org-feedback.ts — the day-7 / day-30 org feedback survey: its questions,
 * limits and link rules. Pure, so the survey form and the service share one
 * definition.
 */

import type { OrgFeedbackType } from '@/prisma/generated/client';

/** The survey types, from the Prisma enum so the two cannot drift. */
export type OrgFeedbackSurveyType = OrgFeedbackType;

export type SurveyQuestion = { key: string; label: string };

const DAY_7_QUESTIONS: SurveyQuestion[] = [
	{ key: 'working_well', label: "What's working well?" },
	{ key: 'confusing_or_broken', label: "What's confusing or broken?" },
	{ key: 'expected_missing', label: "Anything you expected that's missing?" },
];

export const SURVEY_QUESTIONS: Record<OrgFeedbackSurveyType, SurveyQuestion[]> =
	{
		DAY_7: DAY_7_QUESTIONS,
		DAY_30: [
			...DAY_7_QUESTIONS,
			{
				key: 'would_pay',
				label: 'Would you pay $29/mo to keep using this? (Yes / Maybe / No)',
			},
			{
				key: 'consent_to_publicize',
				label:
					"Can we use your org's name and a quote on our website? (Yes / No)",
			},
		],
	};

/** Longest answer the survey keeps for any one question. */
export const FEEDBACK_ANSWER_MAX_LENGTH = 2000;

/**
 * One message for every link we did not send, so slugs are not revealed. It
 * leads with the remedy: reopening the emailed link always works.
 */
export const INVALID_SURVEY_LINK_ERROR =
	'This survey link has expired here. Open the link in your survey email again; your answers are still in the form.';

/**
 * The emailed link goes to `/screening/feedback/start`, which moves the token
 * into a cookie for that org and survey type and redirects to the token-free
 * survey URL. One cookie per survey, so opening one never replaces another.
 * The slug comes from the link, so anything outside a slug's alphabet is
 * replaced to keep the cookie name valid; the token itself is still checked
 * against the org.
 */
export function surveyTokenCookie(
	orgSlug: string,
	type: OrgFeedbackSurveyType,
) {
	const safeSlug = orgSlug
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '_')
		.slice(0, 64);
	return `org-feedback-token-${type}-${safeSlug}`;
}
export const SURVEY_TOKEN_COOKIE_PATH = '/screening/feedback';
export const SURVEY_TOKEN_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function parseOrgFeedbackType(
	value: unknown,
): OrgFeedbackSurveyType | null {
	return typeof value === 'string' && Object.hasOwn(SURVEY_QUESTIONS, value)
		? (value as OrgFeedbackSurveyType)
		: null;
}

/** Answers are compared and stored with newlines normalised to `\n`. */
export function normaliseAnswer(value: string): string {
	return value.replace(/\r\n?/g, '\n').trim();
}

/** Survey URL without the token, for the given org slug and survey type. */
export function surveyPath(orgSlug: string, type: OrgFeedbackSurveyType) {
	return `/screening/feedback?org=${encodeURIComponent(orgSlug)}&type=${type}`;
}

/** The link the survey email carries (see the /start route). */
export function surveyStartPath(
	orgSlug: string,
	type: OrgFeedbackSurveyType,
	token: string,
) {
	return `/screening/feedback/start?org=${encodeURIComponent(orgSlug)}&type=${type}&token=${token}`;
}
