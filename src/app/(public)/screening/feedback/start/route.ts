/**
 * Entry point of the emailed org feedback survey link.
 *
 * Moves the link token into an httpOnly cookie scoped to the survey path and
 * redirects to the token-free survey URL, so the token never appears in the
 * page URL, its HTML, analytics or a Referer. The link is checked here
 * (`findSurveyOrg`) before any cookie is set, and again by the survey page and
 * its server action.
 */
import { NextResponse } from 'next/server';
import {
	parseOrgFeedbackType,
	SURVEY_TOKEN_COOKIE_MAX_AGE_SECONDS,
	SURVEY_TOKEN_COOKIE_PATH,
	surveyPath,
	surveyTokenCookie,
} from '@/server/domain/org-feedback';
import { findSurveyOrg } from '@/server/services/org-feedback-service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	const url = new URL(req.url);
	const org = url.searchParams.get('org') ?? '';
	const type = parseOrgFeedbackType(url.searchParams.get('type'));
	const token = url.searchParams.get('token');

	const target = new URL(
		org && type ? surveyPath(org, type) : SURVEY_TOKEN_COOKIE_PATH,
		url.origin,
	);
	const res = NextResponse.redirect(target, 303);
	res.headers.set('Referrer-Policy', 'no-referrer');
	res.headers.set('Cache-Control', 'no-store');
	// Only a link we sent gets a cookie, so a browser cannot be made to
	// collect them for made-up orgs.
	if (type && token && (await findSurveyOrg({ orgSlug: org, type, token }))) {
		res.cookies.set(surveyTokenCookie(org, type), token, {
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			path: SURVEY_TOKEN_COOKIE_PATH,
			maxAge: SURVEY_TOKEN_COOKIE_MAX_AGE_SECONDS,
		});
	}
	return res;
}
