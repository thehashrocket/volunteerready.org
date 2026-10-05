import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { BASE_URL } from '@/lib/constants';
import {
	parseOrgFeedbackType,
	surveyTokenCookie,
} from '@/server/domain/org-feedback';
import { findSurveyOrg } from '@/server/services/org-feedback-service';
import { FeedbackForm } from './feedback-form';

type Props = {
	searchParams: Promise<{ org?: string | string[]; type?: string | string[] }>;
};

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Share Your Feedback — VolunteerReady',
		description: 'Help us improve VolunteerReady by sharing your experience.',
		openGraph: {
			images: [`${BASE_URL}/api/og/page/screening`],
		},
		// A private per-org survey link, never a page to index.
		robots: { index: false },
	};
}

export default async function FeedbackPage({ searchParams }: Props) {
	const params = await searchParams;
	// A repeated query param arrives as an array; only a single value is a link.
	const org = typeof params.org === 'string' ? params.org : undefined;
	const rawType = params.type;
	const type = parseOrgFeedbackType(rawType);
	// Set by /screening/feedback/start, the link in the survey email.
	const token =
		org && type
			? (await cookies()).get(surveyTokenCookie(org, type))?.value
			: undefined;
	const surveyOrg =
		org && type && token
			? await findSurveyOrg({ orgSlug: org, type, token })
			: null;

	if (!org || !type || !token || !surveyOrg) {
		return (
			<div className="mx-auto max-w-xl px-6 py-20 text-center">
				<h1 className="font-display text-2xl font-bold text-foreground">
					Invalid feedback link
				</h1>
				<p className="mt-2 text-muted-foreground">
					This feedback link is incomplete or no longer valid. Please use the
					link from your most recent survey email.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-xl px-6 py-16">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: 'Screening', href: '/screening' },
					{ label: 'Feedback', href: '/screening/feedback' },
				]}
			/>
			<h1 className="font-display text-2xl font-bold text-foreground">
				{type === 'DAY_7' ? "How's your first week?" : '30-day check-in'}
			</h1>
			<p className="mt-2 text-muted-foreground">
				Your feedback directly shapes what we build next. This takes less than 2
				minutes.
			</p>

			<div className="mt-8">
				<FeedbackForm orgSlug={org} feedbackType={type} />
			</div>
		</div>
	);
}
