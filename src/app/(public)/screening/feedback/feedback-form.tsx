'use client';

import { CheckCircle2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
	FEEDBACK_ANSWER_MAX_LENGTH,
	type OrgFeedbackSurveyType,
	SURVEY_QUESTIONS,
} from '@/server/domain/org-feedback';
import { type FeedbackFormState, submitFeedback } from './actions';

type Props = {
	orgSlug: string;
	feedbackType: OrgFeedbackSurveyType;
};

export function FeedbackForm({ orgSlug, feedbackType }: Props) {
	const questions = SURVEY_QUESTIONS[feedbackType];

	const [state, formAction, isPending] = useActionState<
		FeedbackFormState,
		FormData
	>(async (_prev, formData) => submitFeedback(formData), {});
	// React resets a form after its action runs; refill what the user typed
	// when the action returned an error. A new key per attempt applies it.
	const [attempt, setAttempt] = useState(0);

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
		<form
			action={(formData) => {
				setAttempt((n) => n + 1);
				formAction(formData);
			}}
		>
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
							key={`${q.key}-${attempt}`}
							id={q.key}
							name={q.key}
							defaultValue={state.answers?.[q.key] ?? ''}
							rows={3}
							maxLength={FEEDBACK_ANSWER_MAX_LENGTH}
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
