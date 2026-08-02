'use client';

import { CheckCircle2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
	safeCaughtErrorMessage,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 0 | 1 | 2 | 3 | 4; // 0-3 = steps, 4 = completion

const STEP_META = [
	{
		title: 'Set up your organization',
		description:
			'Confirm your organization name. This is how volunteers will see you.',
	},
	{
		title: 'Create a screener question',
		description: 'Add at least one question to screen volunteer applications.',
	},
	{
		title: 'Publish an opportunity',
		description: 'Create a volunteer opportunity so people can apply.',
	},
	{
		title: 'Invite your team',
		description:
			'Add a team member to help manage volunteers. You can skip this for now.',
	},
] as const;

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
	return (
		<nav
			className="flex items-center gap-2"
			aria-label={`Step ${current + 1} of ${total}`}
		>
			{Array.from({ length: total }).map((_, i) => (
				<span
					key={i}
					className={`h-2 w-2 rounded-full transition-colors ${
						i <= current ? 'bg-primary' : 'bg-neutral-200'
					}`}
					aria-current={i === current ? 'step' : undefined}
				/>
			))}
			<span className="ml-2 text-sm text-muted-foreground">
				Step {current + 1} of {total}
			</span>
		</nav>
	);
}

// ---------------------------------------------------------------------------
// Step 0: Org basics (confirm name)
// ---------------------------------------------------------------------------

function StepOrgBasics({ onNext }: { onNext: () => void }) {
	const statusQuery = trpc.onboarding.status.useQuery();
	const step = statusQuery.data?.steps.find((s) => s.key === 'org_basics');

	// If already complete, show a confirmation and let them proceed
	if (step?.complete) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-2 text-sm text-primary">
					<CheckCircle2 className="h-4 w-4" />
					Organization is set up.
				</div>
				<Button onClick={onNext} className="w-full">
					Continue
				</Button>
			</div>
		);
	}

	// Org basics are always complete after signup (name + slug),
	// but show a link to settings just in case
	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Your organization is already set up. You can edit the name and settings
				later from the Settings page.
			</p>
			<Button onClick={onNext} className="w-full">
				Continue
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 1: Create a screener question
// ---------------------------------------------------------------------------

function StepScreener({ onNext }: { onNext: () => void }) {
	const utils = trpc.useUtils();
	const statusQuery = trpc.onboarding.status.useQuery();
	const step = statusQuery.data?.steps.find((s) => s.key === 'screener');

	const [prompt, setPrompt] = useState('');
	const [error, setError] = useState('');

	const createQuestion = trpc.screener.createQuestion.useMutation({
		onSuccess: () => {
			utils.onboarding.status.invalidate();
			onNext();
		},
		onError: (err) =>
			setError(safeErrorMessage(err) ?? 'Could not save that question.'),
	});

	if (step?.complete) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-2 text-sm text-primary">
					<CheckCircle2 className="h-4 w-4" />
					Screener questions are set up.
				</div>
				<Button onClick={onNext} className="w-full">
					Continue
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="wizard-question">Question prompt</Label>
				<Input
					id="wizard-question"
					placeholder='e.g. "Why do you want to volunteer with us?"'
					value={prompt}
					onChange={(e) => {
						setPrompt(e.target.value);
						setError('');
					}}
				/>
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
			</div>
			<p className="text-xs text-muted-foreground">
				You can add more questions and configure types later from the Screener
				page.
			</p>
			<Button
				onClick={() =>
					createQuestion.mutate({ prompt, type: 'TEXT', required: true })
				}
				disabled={prompt.length < 5 || createQuestion.isPending}
				className="w-full"
			>
				{createQuestion.isPending ? 'Creating…' : 'Create question & continue'}
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 2: Create an opportunity
// ---------------------------------------------------------------------------

function StepOpportunity({ onNext }: { onNext: () => void }) {
	const utils = trpc.useUtils();
	const statusQuery = trpc.onboarding.status.useQuery();
	const step = statusQuery.data?.steps.find((s) => s.key === 'opportunity');

	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [error, setError] = useState('');
	const [isPending, setIsPending] = useState(false);

	const createOpp = trpc.opportunities.create.useMutation();
	const publishOpp = trpc.opportunities.updateStatus.useMutation();

	async function handleCreate() {
		if (isPending) return;
		setIsPending(true);
		setError('');
		try {
			const opp = await createOpp.mutateAsync({ title, description });
			await publishOpp.mutateAsync({ id: opp.id, status: 'PUBLISHED' });
			utils.onboarding.status.invalidate();
			onNext();
		} catch (err) {
			setError(
				safeCaughtErrorMessage(err) ?? 'Could not create that opportunity.',
			);
		} finally {
			setIsPending(false);
		}
	}

	if (step?.complete) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-2 text-sm text-primary">
					<CheckCircle2 className="h-4 w-4" />
					You have a published opportunity.
				</div>
				<Button onClick={onNext} className="w-full">
					Continue
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="wizard-opp-title">Opportunity title</Label>
				<Input
					id="wizard-opp-title"
					placeholder='e.g. "Weekend Park Cleanup"'
					value={title}
					onChange={(e) => {
						setTitle(e.target.value);
						setError('');
					}}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="wizard-opp-desc">Description</Label>
				<Input
					id="wizard-opp-desc"
					placeholder="Brief description of the opportunity"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</div>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				This will be published immediately. You can edit details later from the
				Opportunities page.
			</p>
			<Button
				onClick={handleCreate}
				disabled={title.length < 2 || !description || isPending}
				className="w-full"
			>
				{isPending ? 'Creating…' : 'Publish opportunity & continue'}
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Step 3: Invite team
// ---------------------------------------------------------------------------

function StepInvite({ onNext }: { onNext: () => void }) {
	const [email, setEmail] = useState('');
	const [error, setError] = useState('');

	const invite = trpc.members.invite.useMutation({
		onSuccess: () => onNext(),
		onError: (err) =>
			setError(safeErrorMessage(err) ?? 'Could not send that invite.'),
	});

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="wizard-invite-email">Team member email</Label>
				<Input
					id="wizard-invite-email"
					type="email"
					placeholder="colleague@example.com"
					value={email}
					onChange={(e) => {
						setEmail(e.target.value);
						setError('');
					}}
				/>
				{error && (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
			</div>
			<Button
				onClick={() => invite.mutate({ email, role: 'STAFF' })}
				disabled={!email.includes('@') || invite.isPending}
				className="w-full"
			>
				{invite.isPending ? 'Sending invite…' : 'Send invite & finish'}
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Completion screen
// ---------------------------------------------------------------------------

function StepComplete({ onClose }: { onClose: () => void }) {
	return (
		<div className="flex flex-col items-center gap-4 py-4 text-center">
			<div className="flex h-16 w-16 animate-in zoom-in-50 duration-300 items-center justify-center rounded-full bg-primary/10">
				<CheckCircle2 className="h-8 w-8 text-primary" />
			</div>
			<h2 className="font-display text-2xl font-bold">Your org is live!</h2>
			<p className="text-sm text-muted-foreground">
				Volunteers can now discover and apply to your opportunities.
			</p>
			<Button onClick={onClose} className="w-full">
				Go to dashboard
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({
	open,
	onOpenChange,
}: OnboardingWizardProps) {
	const [step, setStep] = useState<WizardStep>(0);

	const goNext = useCallback(() => {
		setStep((prev) => (prev < 4 ? ((prev + 1) as WizardStep) : prev));
	}, []);

	const goBack = useCallback(() => {
		setStep((prev) => (prev > 0 ? ((prev - 1) as WizardStep) : prev));
	}, []);

	const handleClose = useCallback(() => {
		onOpenChange(false);
		// Reset step for next open
		setTimeout(() => setStep(0), 300);
	}, [onOpenChange]);

	const isCompletion = step === 4;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={!isCompletion}
				className="sm:max-w-lg"
				aria-label="Onboarding wizard"
			>
				{isCompletion ? (
					<StepComplete onClose={handleClose} />
				) : (
					<>
						<DialogHeader>
							<StepIndicator current={step} total={4} />
							<DialogTitle className="font-display text-2xl font-bold">
								{STEP_META[step].title}
							</DialogTitle>
							<DialogDescription>
								{STEP_META[step].description}
							</DialogDescription>
						</DialogHeader>

						<div className="py-2">
							{step === 0 && <StepOrgBasics onNext={goNext} />}
							{step === 1 && <StepScreener onNext={goNext} />}
							{step === 2 && <StepOpportunity onNext={goNext} />}
							{step === 3 && <StepInvite onNext={goNext} />}
						</div>

						<DialogFooter className="flex-row justify-between sm:justify-between">
							{step > 0 ? (
								<Button variant="outline" onClick={goBack}>
									Back
								</Button>
							) : (
								<div />
							)}
							<Button
								variant="ghost"
								className="text-muted-foreground"
								onClick={handleClose}
							>
								Skip setup
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
