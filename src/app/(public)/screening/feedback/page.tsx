import type { Metadata } from 'next';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { BASE_URL } from '@/lib/constants';
import { FeedbackForm } from './feedback-form';

type Props = {
	searchParams: Promise<{ org?: string; type?: string }>;
};

export async function generateMetadata({
	searchParams,
}: Props): Promise<Metadata> {
	const { org, type } = await searchParams;
	const isValid = org && type && ['DAY_7', 'DAY_30'].includes(type);

	return {
		title: 'Share Your Feedback — VolunteerReady',
		description: 'Help us improve VolunteerReady by sharing your experience.',
		openGraph: {
			images: [`${BASE_URL}/api/og/page/screening`],
		},
		...(isValid ? {} : { robots: { index: false } }),
	};
}

export default async function FeedbackPage({ searchParams }: Props) {
	const { org, type } = await searchParams;

	if (!org || !type || !['DAY_7', 'DAY_30'].includes(type)) {
		return (
			<div className="mx-auto max-w-xl px-6 py-20 text-center">
				<h1 className="font-display text-2xl font-bold text-foreground">
					Invalid feedback link
				</h1>
				<p className="mt-2 text-muted-foreground">
					This link may have expired or been used already.
				</p>
			</div>
		);
	}

	const feedbackType = type as 'DAY_7' | 'DAY_30';

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
				{feedbackType === 'DAY_7'
					? "How's your first week?"
					: '30-day check-in'}
			</h1>
			<p className="mt-2 text-muted-foreground">
				Your feedback directly shapes what we build next. This takes less than 2
				minutes.
			</p>

			<div className="mt-8">
				<FeedbackForm orgSlug={org} feedbackType={feedbackType} />
			</div>
		</div>
	);
}
