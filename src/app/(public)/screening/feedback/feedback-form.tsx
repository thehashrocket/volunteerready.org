'use client';

import { CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { submitFeedback } from './actions';

type Props = {
	orgSlug: string;
	feedbackType: 'DAY_7' | 'DAY_30';
};

const DAY_7_QUESTIONS = [
	{ key: 'working_well', label: "What's working well?" },
	{ key: 'confusing_or_broken', label: "What's confusing or broken?" },
	{ key: 'expected_missing', label: "Anything you expected that's missing?" },
];

const DAY_30_QUESTIONS = [
	...DAY_7_QUESTIONS,
	{
		key: 'would_pay',
		label: 'Would you pay $29/mo to keep using this? (Yes / Maybe / No)',
	},
	{
		key: 'consent_to_publicize',
		label: "Can we use your org's name and a quote on our website? (Yes / No)",
	},
];

export function FeedbackForm({ orgSlug, feedbackType }: Props) {
	const questions =
		feedbackType === 'DAY_7' ? DAY_7_QUESTIONS : DAY_30_QUESTIONS;

	type FeedbackState = { success?: boolean; error?: string };

	const [state, formAction, isPending] = useActionState<
		FeedbackState,
		FormData
	>(async (_prev, formData) => {
		return submitFeedback(formData);
	}, {});

	if (state.success) {
		return (
			<Card className="border-border/70">
				<CardContent className="px-6 py-10 text-center">
					<CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-success" />
					<h2 className="font-display text-xl font-bold text-foreground">
						Thank you!
					</h2>
					<p className="mt-2 text-muted-foreground">
						Your feedback means a lot and will directly shape what we build
						next.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<form action={formAction}>
			<input type="hidden" name="orgSlug" value={orgSlug} />
			<input type="hidden" name="type" value={feedbackType} />

			<div className="space-y-6">
				{questions.map((q) => (
					<div key={q.key}>
						<label
							htmlFor={q.key}
							className="mb-2 block text-sm font-semibold text-foreground"
						>
							{q.label}
						</label>
						<Textarea
							id={q.key}
							name={q.key}
							rows={3}
							className="resize-none"
							placeholder="Type your answer..."
						/>
					</div>
				))}

				{state.error && (
					<p className="text-sm text-destructive">{state.error}</p>
				)}

				<Button
					type="submit"
					disabled={isPending}
					className="rounded-full px-8"
				>
					{isPending ? 'Submitting...' : 'Submit feedback'}
				</Button>
			</div>
		</form>
	);
}
