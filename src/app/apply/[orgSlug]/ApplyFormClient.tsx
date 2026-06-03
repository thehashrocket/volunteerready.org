'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
	Calendar,
	CheckCircle2,
	Clock,
	Handshake,
	MapPin,
	ShieldCheck,
	Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateRange } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';

import {
	buildDefaultValues,
	buildResponsesFromAnswers,
	buildZodSchema,
	type PublicQuestion,
} from '@/server/domain/screener/publicForm';

import { volunteerProfileSchema } from '@/server/domain/volunteer-screening';

type LinkedOpportunity = {
	id: string;
	title: string;
	location: string | null;
	isRemote: boolean;
	startDate: Date | string | null;
	endDate: Date | string | null;
	commitmentHours: number | null;
};

type Props = {
	org: { id: string; name: string; slug: string };
	questions: PublicQuestion[];
	opportunity: LinkedOpportunity | null;
	source?: 'DIRECT' | 'MARKETPLACE';
};

export default function ApplyFormClient({
	org,
	questions,
	opportunity,
	source,
}: Props) {
	const [submitted, setSubmitted] = useState(false);
	const { data: session, status: authStatus } = useSession();
	const isAuthenticated = authStatus === 'authenticated' && !!session?.user;

	// Dedup check: if authenticated and applying to a specific opportunity,
	// check if they already have an active application
	const dedupQuery = trpc.screener.checkExistingApplication.useQuery(
		{ orgId: org.id, opportunityId: opportunity?.id ?? '' },
		{
			enabled: isAuthenticated && !!opportunity?.id,
		},
	);

	// Anonymous email dedup: soft-check when unauthenticated user enters email
	const [anonEmail, setAnonEmail] = useState('');
	const anonDedupQuery = trpc.screener.checkAnonymousApplication.useQuery(
		{
			orgId: org.id,
			email: anonEmail,
			opportunityId: opportunity?.id ?? '',
		},
		{
			enabled:
				!isAuthenticated &&
				!!opportunity?.id &&
				anonEmail.includes('@') &&
				anonEmail.includes('.'),
		},
	);

	const answersSchema = useMemo(() => buildZodSchema(questions), [questions]);

	const schema = useMemo(
		() =>
			z.object({
				profile: volunteerProfileSchema,
				answers: answersSchema,
				shareCredentials: z.boolean().optional(),
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
				shareCredentials: false,
			}) as FormValues,
		[questions],
	);

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: defaults,
		mode: 'onSubmit',
	});

	const submitMutation = trpc.screener.submit.useMutation({
		onSuccess: (data) => {
			if ('duplicate' in data && data.duplicate) {
				toast.error("You've already applied to this opportunity", {
					action: {
						label: 'View Application',
						onClick: () => {
							window.location.href = `/app/my-applications/${data.applicationId}`;
						},
					},
				});
				return;
			}
			setSubmitted(true);
			toast.success('Application submitted. Thank you!');
		},
		onError: (err) => {
			toast.error(err.message ?? 'Submission failed');
		},
	});

	// Show interception card if the user already has an active application
	if (dedupQuery.data && opportunity) {
		return (
			<AlreadyAppliedCard
				org={org}
				opportunity={opportunity}
				applicationId={dedupQuery.data.id}
				submittedAt={dedupQuery.data.submittedAt}
			/>
		);
	}

	if (submitted) {
		return <SuccessCard org={org} opportunity={opportunity} />;
	}

	function onSubmit(values: FormValues) {
		const responses = buildResponsesFromAnswers(
			questions,
			values.answers as Record<string, unknown>,
		);

		submitMutation.mutate({
			orgId: org.id,
			opportunityId: opportunity?.id,
			submittedByEmail: values.profile.email,
			profile: values.profile,
			responses,
			shareCredentials: values.shareCredentials,
			source,
		});
	}

	const profileErrors = form.formState.errors.profile;

	const dateRange = opportunity
		? formatDateRange(opportunity.startDate, opportunity.endDate)
		: null;

	return (
		<>
			{opportunity && (
				<div className="mb-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
					<p className="mb-1 text-xs font-semibold uppercase tracking-widest text-green-700">
						Applying for
					</p>
					<p className="font-semibold text-stone-900">{opportunity.title}</p>
					<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
						{opportunity.isRemote && (
							<span className="flex items-center gap-1">
								<Wifi className="h-3 w-3" />
								Remote
							</span>
						)}
						{opportunity.location && (
							<span className="flex items-center gap-1">
								<MapPin className="h-3 w-3" />
								{opportunity.location}
							</span>
						)}
						{dateRange && (
							<span className="flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								{dateRange}
							</span>
						)}
						{opportunity.commitmentHours != null && (
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{opportunity.commitmentHours}h/week
							</span>
						)}
					</div>
				</div>
			)}
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
									{...form.register('profile.email', {
										onBlur: (e) => {
											if (!isAuthenticated) setAnonEmail(e.target.value);
										},
									})}
								/>
								{profileErrors?.email?.message ? (
									<p className="text-sm text-destructive">
										{String(profileErrors.email.message)}
									</p>
								) : null}
								{anonDedupQuery.data?.exists && (
									<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
										An application with this email already exists for this
										opportunity.{' '}
										<Link
											href="/apply/status"
											className="font-medium underline hover:text-amber-900"
										>
											Check your application status
										</Link>{' '}
										or use a different email.
									</div>
								)}
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
								<Input
									id="profile.county"
									{...form.register('profile.county')}
								/>
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
								<Label htmlFor="profile.experienceLevel">
									Experience level
								</Label>
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

						{/* Credential sharing opt-in */}
						<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
							<Checkbox
								id="shareCredentials"
								{...form.register('shareCredentials')}
								className="mt-0.5"
							/>
							<div>
								<Label
									htmlFor="shareCredentials"
									className="cursor-pointer font-medium"
								>
									<ShieldCheck className="mr-1 inline-block h-4 w-4 text-primary" />
									Bring my credentials
								</Label>
								<p className="mt-1 text-xs text-muted-foreground">
									Share your verified credentials (background checks, training,
									etc.) from other organizations with {org.name}.
								</p>
							</div>
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
		</>
	);
}

function SuccessCard({
	org,
	opportunity,
}: {
	org: { name: string; slug: string };
	opportunity: LinkedOpportunity | null;
}) {
	const { data: session, status } = useSession();
	const isAuthenticated = status === 'authenticated' && !!session?.user;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-3">
					<Handshake className="h-6 w-6 text-primary/60" />
					<CardTitle>Thanks — we got it.</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-muted-foreground">
					Your application to{' '}
					<span className="font-medium text-foreground">{org.name}</span>
					{opportunity && (
						<>
							{' '}
							for{' '}
							<span className="font-medium text-foreground">
								{opportunity.title}
							</span>
						</>
					)}{' '}
					has been submitted.
				</p>

				{isAuthenticated ? (
					<>
						<p className="text-muted-foreground">
							You can track your application status anytime from your dashboard.
						</p>
						<div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
							<Button asChild>
								<Link href="/app/my-applications">View My Applications</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href={`/opportunities/${org.slug}`}>
									Browse More Opportunities
								</Link>
							</Button>
						</div>
						<Link
							href="/app/profile"
							className="inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							Edit Profile
						</Link>
					</>
				) : (
					<>
						<p className="text-muted-foreground">
							If they're a match, they'll follow up with next steps.
						</p>
						<div className="pt-2">
							<Button variant="outline" asChild>
								<Link href="/apply/status">Check Application Status</Link>
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

function AlreadyAppliedCard({
	org,
	opportunity,
	applicationId,
	submittedAt,
}: {
	org: { name: string; slug: string };
	opportunity: LinkedOpportunity;
	applicationId: string;
	submittedAt: Date | string;
}) {
	const formattedDate = new Date(submittedAt).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	return (
		<div
			className="mx-auto max-w-[480px] rounded-md bg-muted p-6"
			role="status"
			aria-live="polite"
		>
			<div className="mb-4 flex items-center gap-3">
				<CheckCircle2 className="h-6 w-6 text-success" />
				<h2
					className="text-2xl font-bold text-foreground"
					style={{
						fontFamily: 'var(--font-fraunces, var(--font-playfair, serif))',
					}}
				>
					You're already on the list!
				</h2>
			</div>
			<p className="mb-6 text-base leading-relaxed text-muted-foreground">
				You applied for{' '}
				<span className="font-medium text-foreground">{opportunity.title}</span>{' '}
				on {formattedDate}.
			</p>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Button asChild>
					<Link href={`/app/my-applications/${applicationId}`}>
						View My Application
					</Link>
				</Button>
				<Button variant="outline" asChild>
					<Link href={`/opportunities/${org.slug}`}>
						Browse Other Opportunities
					</Link>
				</Button>
			</div>
		</div>
	);
}

function QuestionField({
	question,
	form,
}: {
	question: PublicQuestion;
	// biome-ignore lint/suspicious/noExplicitAny: form shape varies by dynamic question config
	form: ReturnType<typeof useForm<any>>;
}) {
	const { register, formState } = form;
	// biome-ignore lint/suspicious/noExplicitAny: configJson is schemaless JSON
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
			const labelId = `label-${question.key}`;
			return (
				<div className="space-y-2">
					<Label id={labelId}>{question.prompt}</Label>
					<Controller
						control={form.control}
						name={path}
						render={({ field }) => (
							<RadioGroup
								aria-labelledby={labelId}
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
								<div className="flex items-center gap-2 text-sm">
									<RadioGroupItem value="yes" id={`${question.key}-yes`} />
									<Label
										htmlFor={`${question.key}-yes`}
										className="cursor-pointer font-normal"
									>
										Yes
									</Label>
								</div>
								<div className="flex items-center gap-2 text-sm">
									<RadioGroupItem value="no" id={`${question.key}-no`} />
									<Label
										htmlFor={`${question.key}-no`}
										className="cursor-pointer font-normal"
									>
										No
									</Label>
								</div>
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
