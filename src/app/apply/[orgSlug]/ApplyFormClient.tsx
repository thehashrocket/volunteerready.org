'use client';

import { useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { trpc } from '@/lib/trpc/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// If you have shadcn textarea installed, prefer it:
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import {
	buildDefaultValues,
	buildZodSchema,
	buildResponsesFromAnswers,
	type PublicQuestion,
} from '@/server/domain/screener/publicForm';

import { volunteerProfileSchema } from '@/server/domain/volunteer-screening';

type Props = {
	org: { id: string; name: string; slug: string };
	questions: PublicQuestion[];
};

export default function ApplyFormClient({ org, questions }: Props) {
	const [submitted, setSubmitted] = useState(false);

	const answersSchema = useMemo(() => buildZodSchema(questions), [questions]);

	const schema = useMemo(
		() =>
			z.object({
				profile: volunteerProfileSchema,
				answers: answersSchema,
			}),
		[answersSchema],
	);

	type FormValues = z.infer<typeof schema>;

	const defaults = useMemo(
		() =>
			({
				profile: {
					name: '',
					email: '',
					phone: '',
					county: '',
					availability: '',
					experienceLevel: '',
					notes: '',
				},
				answers: buildDefaultValues(questions),
			}) as FormValues,
		[questions],
	);

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: defaults,
		mode: 'onSubmit',
	});

	const submitMutation = trpc.screener.submit.useMutation({
		onSuccess: () => {
			setSubmitted(true);
			toast.success('Application submitted. Thank you!');
		},
		onError: (err) => {
			toast.error(err.message ?? 'Submission failed');
		},
	});

	if (submitted) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Thanks — we got it.</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground">
						Your application to{' '}
						<span className="font-medium text-foreground">{org.name}</span> has
						been submitted.
					</p>
					<p className="text-muted-foreground">
						If they’re a match, they’ll follow up with next steps.
					</p>
				</CardContent>
			</Card>
		);
	}

	function onSubmit(values: FormValues) {
		const responses = buildResponsesFromAnswers(
			questions,
			values.answers as Record<string, unknown>,
		);

		submitMutation.mutate({
			orgId: org.id,
			submittedByEmail: values.profile.email, // ✅ don’t ask twice
			profile: values.profile,
			responses,
		});
	}

	const profileErrors = form.formState.errors.profile;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Volunteer application</CardTitle>
			</CardHeader>

			<CardContent>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					{/* Profile */}
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="profile.name">Name</Label>
							<Input id="profile.name" {...form.register('profile.name')} />
							{profileErrors?.name?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.name.message)}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="profile.email">Email</Label>
							<Input
								id="profile.email"
								type="email"
								autoComplete="email"
								{...form.register('profile.email')}
							/>
							{profileErrors?.email?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.email.message)}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="profile.phone">Phone</Label>
							<Input
								id="profile.phone"
								autoComplete="tel"
								{...form.register('profile.phone')}
							/>
							{profileErrors?.phone?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.phone.message)}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="profile.county">County</Label>
							<Input id="profile.county" {...form.register('profile.county')} />
							{profileErrors?.county?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.county.message)}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="profile.availability">Availability</Label>
							<Input
								id="profile.availability"
								placeholder="e.g. Weekends, Tue/Thu evenings"
								{...form.register('profile.availability')}
							/>
							{profileErrors?.availability?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.availability.message)}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="profile.experienceLevel">Experience level</Label>
							<Input
								id="profile.experienceLevel"
								placeholder="e.g. None, Some, Volunteer, Professional"
								{...form.register('profile.experienceLevel')}
							/>
							{profileErrors?.experienceLevel?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.experienceLevel.message)}
								</p>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="profile.notes">Notes (optional)</Label>
							<Textarea
								id="profile.notes"
								rows={4}
								{...form.register('profile.notes')}
							/>
							{profileErrors?.notes?.message ? (
								<p className="text-sm text-destructive">
									{String(profileErrors.notes.message)}
								</p>
							) : null}
						</div>
					</div>

					{/* Screener questions */}
					<div className="space-y-6">
						{questions.map((q) => (
							<QuestionField key={q.id} question={q} form={form} />
						))}
					</div>

					<div className="pt-2">
						<Button type="submit" disabled={submitMutation.isPending}>
							{submitMutation.isPending
								? 'Submitting...'
								: 'Submit application'}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function QuestionField({
	question,
	form,
}: {
	question: PublicQuestion;
	form: ReturnType<typeof useForm<any>>;
}) {
	const { register, formState } = form;
	const cfg = (question.configJson ?? {}) as any;

	// ✅ answers are nested
	const path = `answers.${question.key}` as const;
	const errors = (formState.errors?.answers ?? {}) as Record<
		string,
		{ message?: string }
	>;
	const error = errors[question.key]?.message;

	switch (question.type) {
		case 'YES_NO': {
			return (
				<div className="space-y-2">
					<Label>{question.prompt}</Label>
					<Controller
						control={form.control}
						name={path}
						render={({ field }) => (
							<RadioGroup
								value={
									field.value === true
										? 'yes'
										: field.value === false
											? 'no'
											: ''
								}
								onValueChange={(value) => field.onChange(value === 'yes')}
								className="flex gap-6"
							>
								<label className="flex items-center gap-2 text-sm">
									<RadioGroupItem value="yes" />
									Yes
								</label>
								<label className="flex items-center gap-2 text-sm">
									<RadioGroupItem value="no" />
									No
								</label>
							</RadioGroup>
						)}
					/>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>
			);
		}

		case 'TEXT': {
			const maxLength =
				typeof cfg.maxLength === 'number' ? cfg.maxLength : undefined;

			return (
				<div className="space-y-2">
					<Label htmlFor={question.key}>{question.prompt}</Label>
					<Input id={question.key} maxLength={maxLength} {...register(path)} />
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>
			);
		}

		case 'SINGLE_SELECT': {
			const options: string[] = Array.isArray(cfg.options) ? cfg.options : [];
			return (
				<div className="space-y-2">
					<Label htmlFor={question.key}>{question.prompt}</Label>
					<Controller
						control={form.control}
						name={path}
						render={({ field }) => (
							<Select
								value={field.value ?? ''}
								onValueChange={(value) => field.onChange(value)}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select one…" />
								</SelectTrigger>
								<SelectContent>
									{options.map((opt) => (
										<SelectItem key={opt} value={opt}>
											{opt}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>
			);
		}

		default: {
			return (
				<div className="space-y-2">
					<Label htmlFor={question.key}>{question.prompt}</Label>
					<Input id={question.key} {...register(path)} />
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
				</div>
			);
		}
	}
}
