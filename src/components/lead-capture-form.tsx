'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trackEvent } from '@/lib/analytics';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { trpc } from '@/lib/trpc/client';

type LeadCaptureFormProps = {
	locationSlug: string;
};

type FieldErrors = {
	orgName?: string;
	contactEmail?: string;
};

export function LeadCaptureForm({ locationSlug }: LeadCaptureFormProps) {
	const [submitted, setSubmitted] = useState(false);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [serverError, setServerError] = useState(false);
	const [hasTrackedView, setHasTrackedView] = useState(false);
	const [hasTrackedStart, setHasTrackedStart] = useState(false);
	const sectionRef = useRef<HTMLDivElement>(null);
	const orgNameRef = useRef<HTMLInputElement>(null);
	const emailRef = useRef<HTMLInputElement>(null);

	const mutation = trpc.leads.submit.useMutation({
		onSuccess: () => {
			setSubmitted(true);
			trackEvent('lead_form_success', { location_slug: locationSlug });
		},
		onError: () => {
			setServerError(true);
			trackEvent('lead_form_error', {
				location_slug: locationSlug,
				error_type: 'server',
			});
		},
	});

	// Track form view via IntersectionObserver
	useEffect(() => {
		const el = sectionRef.current;
		if (!el || hasTrackedView) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					trackEvent('lead_form_view', { location_slug: locationSlug });
					setHasTrackedView(true);
					observer.disconnect();
				}
			},
			{ threshold: 0.3 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [locationSlug, hasTrackedView]);

	function handleFirstFocus() {
		if (!hasTrackedStart) {
			trackEvent('lead_form_start', { location_slug: locationSlug });
			setHasTrackedStart(true);
		}
	}

	function validate(orgName: string, email: string): FieldErrors {
		const errs: FieldErrors = {};
		if (!orgName.trim()) errs.orgName = 'Organization name is required';
		if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			errs.contactEmail = 'Please enter a valid email';
		return errs;
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setServerError(false);
		const form = e.currentTarget;
		const data = new FormData(form);

		const orgName = (data.get('orgName') as string) ?? '';
		const contactEmail = (data.get('contactEmail') as string) ?? '';
		const volunteerCount = (data.get('volunteerCount') as string) || undefined;
		const currentProcess = (data.get('currentProcess') as string) || undefined;
		const painPoints = (data.get('painPoints') as string) || undefined;
		const org_phone = (data.get('org_phone') as string) || undefined;

		const fieldErrors = validate(orgName, contactEmail);
		setErrors(fieldErrors);

		if (Object.keys(fieldErrors).length > 0) {
			// Focus first invalid field
			if (fieldErrors.orgName) orgNameRef.current?.focus();
			else if (fieldErrors.contactEmail) emailRef.current?.focus();
			return;
		}

		trackEvent('lead_form_submit', { location_slug: locationSlug });

		mutation.mutate({
			locationSlug,
			orgName,
			contactEmail,
			volunteerCount,
			currentProcess: currentProcess as
				| 'Spreadsheets'
				| 'Email'
				| 'No system'
				| 'Other'
				| undefined,
			painPoints,
			org_phone,
		});
	}

	if (submitted) {
		return (
			<section id="lead-form" className="bg-muted/50 px-4 py-16">
				<Card
					className="mx-auto max-w-xl p-8 text-center"
					role="status"
					aria-live="polite"
				>
					<Check className="mx-auto mb-4 h-8 w-8 text-success" />
					<h2 className="font-display mb-2 text-2xl font-bold text-foreground">
						We'll be in touch.
					</h2>
					<p className="mb-6 text-base text-muted-foreground">
						Our founder will email you within 24 hours.
					</p>
					<Button
						variant="outline"
						className="rounded-full px-8"
						asChild
						onClick={() =>
							trackEvent('lead_booking_click', {
								location_slug: locationSlug,
							})
						}
					>
						<a
							href={FOUNDER_BOOKING_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							Skip the wait — book a call now
						</a>
					</Button>
				</Card>
			</section>
		);
	}

	return (
		<section id="lead-form" className="bg-muted/50 px-4 py-16" ref={sectionRef}>
			<Card className="mx-auto max-w-xl p-8">
				<h2 className="font-display mb-6 text-center text-[32px] font-bold text-foreground">
					Ready to simplify your volunteer program?
				</h2>

				<form
					onSubmit={handleSubmit}
					onFocus={handleFirstFocus}
					className={mutation.isPending ? 'opacity-60' : ''}
					noValidate
				>
					{/* Honeypot — hidden from real users */}
					<div className="sr-only" aria-hidden="true">
						<label htmlFor="org_phone">Phone</label>
						<input
							type="text"
							id="org_phone"
							name="org_phone"
							tabIndex={-1}
							autoComplete="off"
						/>
					</div>

					<div className="space-y-4">
						<div>
							<Label htmlFor="orgName">
								Organization name <span className="text-destructive">*</span>
							</Label>
							<Input
								ref={orgNameRef}
								id="orgName"
								name="orgName"
								aria-required="true"
								aria-describedby={errors.orgName ? 'orgName-error' : undefined}
								disabled={mutation.isPending}
								className="mt-1"
							/>
							{errors.orgName && (
								<p id="orgName-error" className="mt-1 text-sm text-destructive">
									{errors.orgName}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor="contactEmail">
								Email <span className="text-destructive">*</span>
							</Label>
							<Input
								ref={emailRef}
								id="contactEmail"
								name="contactEmail"
								type="email"
								aria-required="true"
								aria-describedby={
									errors.contactEmail ? 'email-error' : undefined
								}
								disabled={mutation.isPending}
								className="mt-1"
							/>
							{errors.contactEmail && (
								<p id="email-error" className="mt-1 text-sm text-destructive">
									{errors.contactEmail}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor="volunteerCount">
								How many volunteers do you manage?
							</Label>
							<Input
								id="volunteerCount"
								name="volunteerCount"
								placeholder="e.g. 25, 50-100"
								disabled={mutation.isPending}
								className="mt-1"
							/>
						</div>

						<div>
							<Label htmlFor="currentProcess">
								How do you currently manage volunteers?
							</Label>
							<Select name="currentProcess" disabled={mutation.isPending}>
								<SelectTrigger id="currentProcess" className="mt-1">
									<SelectValue placeholder="Select…" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Spreadsheets">Spreadsheets</SelectItem>
									<SelectItem value="Email">Email</SelectItem>
									<SelectItem value="No system">No system</SelectItem>
									<SelectItem value="Other">Other</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="painPoints">
								What's the biggest challenge with your current process?
							</Label>
							<Textarea
								id="painPoints"
								name="painPoints"
								rows={3}
								maxLength={2000}
								disabled={mutation.isPending}
								className="mt-1"
							/>
						</div>
					</div>

					{serverError && (
						<p className="mt-4 text-sm text-destructive">
							Something went wrong — please try again, or email us at{' '}
							<a href="mailto:hello@volunteerready.org" className="underline">
								hello@volunteerready.org
							</a>
							.
						</p>
					)}

					<Button
						type="submit"
						size="lg"
						disabled={mutation.isPending}
						className="mt-6 w-full rounded-full"
					>
						{mutation.isPending ? 'Sending…' : 'Get in Touch'}
					</Button>

					<p className="mt-3 text-center text-xs text-muted-foreground">
						We'll never share your info. Read our{' '}
						<a href="/privacy" className="underline">
							privacy policy
						</a>
						.
					</p>
				</form>
			</Card>
		</section>
	);
}
