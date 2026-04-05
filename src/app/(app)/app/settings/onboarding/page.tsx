'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';

export default function OnboardingBaselinePage() {
	const { data: baseline, isLoading } =
		trpc.screener.getOnboardingBaseline.useQuery();
	const utils = trpc.useUtils();

	const saved = baseline as {
		volunteerCount?: number;
		hoursPerWeek?: number;
		currentProcess?: string;
	} | null;

	const [volunteerCount, setVolunteerCount] = useState<number>(
		saved?.volunteerCount ?? 0,
	);
	const [hoursPerWeek, setHoursPerWeek] = useState<number>(
		saved?.hoursPerWeek ?? 0,
	);
	const [currentProcess, setCurrentProcess] = useState(
		saved?.currentProcess ?? '',
	);
	const [initialized, setInitialized] = useState(false);

	// Sync form state when data loads
	if (!initialized && baseline && !isLoading) {
		if (saved?.volunteerCount != null) setVolunteerCount(saved.volunteerCount);
		if (saved?.hoursPerWeek != null) setHoursPerWeek(saved.hoursPerWeek);
		if (saved?.currentProcess) setCurrentProcess(saved.currentProcess);
		setInitialized(true);
	}

	const save = trpc.screener.saveOnboardingBaseline.useMutation({
		onSuccess: () => utils.screener.getOnboardingBaseline.invalidate(),
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		save.mutate({ volunteerCount, hoursPerWeek, currentProcess });
	}

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-64 rounded-xl" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Onboarding baseline"
				description="Capture your current volunteer management setup so we can measure impact over time."
			/>

			<Card className="border-border/70">
				<CardContent className="pt-6">
					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<label
								htmlFor="volunteerCount"
								className="mb-2 block text-sm font-semibold text-foreground"
							>
								How many volunteers do you manage?
							</label>
							<Input
								id="volunteerCount"
								type="number"
								min={0}
								max={10000}
								value={volunteerCount}
								onChange={(e) => setVolunteerCount(Number(e.target.value))}
							/>
						</div>

						<div>
							<label
								htmlFor="hoursPerWeek"
								className="mb-2 block text-sm font-semibold text-foreground"
							>
								Hours/week spent on volunteer admin?
							</label>
							<Input
								id="hoursPerWeek"
								type="number"
								min={0}
								max={168}
								value={hoursPerWeek}
								onChange={(e) => setHoursPerWeek(Number(e.target.value))}
							/>
						</div>

						<div>
							<label
								htmlFor="currentProcess"
								className="mb-2 block text-sm font-semibold text-foreground"
							>
								How do you currently track background checks?
							</label>
							<Textarea
								id="currentProcess"
								rows={3}
								maxLength={1000}
								value={currentProcess}
								onChange={(e) => setCurrentProcess(e.target.value)}
								placeholder="Spreadsheet, email, paper forms, another tool..."
								className="resize-none"
							/>
						</div>

						<Button type="submit" disabled={save.isPending}>
							{save.isPending ? 'Saving...' : 'Save baseline'}
						</Button>

						{save.isSuccess && (
							<p className="text-sm text-success">Baseline saved.</p>
						)}
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
