import type { Metadata } from 'next';
import { FeedbackForm } from './feedback-form';

export const metadata: Metadata = {
	title: 'Share Your Feedback — VolunteerReady',
	description: 'Help us improve VolunteerReady by sharing your experience.',
};

export default async function FeedbackPage({
	searchParams,
}: {
	searchParams: Promise<{ org?: string; type?: string }>;
}) {
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
