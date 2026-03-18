'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CREDENTIAL_LABELS } from '@/server/domain/volunteer-profile';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VolunteerSearchResult {
	userId: string;
	displayName: string;
	city: string | null;
	state: string | null;
	availability: string | null;
	verifiedCredentialTypes: string[];
	skillIds: string[];
	updatedAt: Date | string;
}

const AVAILABILITY_OPTIONS = [
	{ value: '', label: 'Any availability' },
	{ value: 'WEEKDAYS', label: 'Weekdays' },
	{ value: 'WEEKENDS', label: 'Weekends' },
	{ value: 'EVENINGS', label: 'Evenings' },
	{ value: 'FLEXIBLE', label: 'Flexible' },
];

// ---------------------------------------------------------------------------
// Volunteer Card
// ---------------------------------------------------------------------------

function VolunteerCard({
	volunteer,
	onInvite,
}: {
	volunteer: VolunteerSearchResult;
	onInvite: (volunteerId: string) => void;
}) {
	const location = [volunteer.city, volunteer.state].filter(Boolean).join(', ');

	return (
		<Card className="flex flex-col gap-3">
			<CardHeader className="pb-2">
				<CardTitle className="text-base">{volunteer.displayName}</CardTitle>
				{location && (
					<p className="text-sm text-muted-foreground">{location}</p>
				)}
				{volunteer.availability && (
					<p className="text-xs text-muted-foreground capitalize">
						{volunteer.availability.toLowerCase()}
					</p>
				)}
			</CardHeader>
			<CardContent className="pt-0 flex flex-col gap-3">
				{volunteer.verifiedCredentialTypes.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{volunteer.verifiedCredentialTypes.map((type) => (
							<Badge key={type} variant="secondary" className="text-xs">
								{CREDENTIAL_LABELS[type as keyof typeof CREDENTIAL_LABELS] ?? type}
							</Badge>
						))}
					</div>
				)}
				<Button
					size="sm"
					onClick={() => onInvite(volunteer.userId)}
					className="w-full"
				>
					Invite to Apply
				</Button>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Invite Dialog
// ---------------------------------------------------------------------------

function InviteDialog({
	volunteerId,
	open,
	onClose,
}: {
	volunteerId: string | null;
	open: boolean;
	onClose: () => void;
}) {
	const [selectedOpportunityId, setSelectedOpportunityId] = useState('');

	const opportunitiesQuery = trpc.opportunities.list.useQuery(undefined, {
		enabled: open,
	});

	const publishedOpportunities = (opportunitiesQuery.data?.items ?? []).filter(
		(opp) => opp.status === 'PUBLISHED',
	);

	const inviteMutation = trpc.discovery.inviteToApply.useMutation({
		onSuccess: () => {
			toast.success('Invitation sent successfully.');
			setSelectedOpportunityId('');
			onClose();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to send invitation.');
		},
	});

	function handleInvite() {
		if (!volunteerId || !selectedOpportunityId) return;
		inviteMutation.mutate({
			volunteerId,
			opportunityId: selectedOpportunityId,
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) {
					setSelectedOpportunityId('');
					onClose();
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invite Volunteer to Apply</DialogTitle>
					<DialogDescription>
						Select a published opportunity to invite this volunteer to apply.
					</DialogDescription>
				</DialogHeader>

				{opportunitiesQuery.isLoading && <Skeleton className="h-10 w-full" />}

				{!opportunitiesQuery.isLoading && (
					<div className="flex flex-col gap-2">
						<Label htmlFor="opportunity-select">Opportunity</Label>
						<Select
							value={selectedOpportunityId}
							onValueChange={setSelectedOpportunityId}
						>
							<SelectTrigger id="opportunity-select">
								<SelectValue placeholder="Select an opportunity…" />
							</SelectTrigger>
							<SelectContent>
								{publishedOpportunities.length === 0 && (
									<SelectItem value="_none" disabled>
										No published opportunities
									</SelectItem>
								)}
								{publishedOpportunities.map((opp) => (
									<SelectItem key={opp.id} value={opp.id}>
										{opp.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				<DialogFooter>
					<Button
						variant="outline"
						onClick={onClose}
						disabled={inviteMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleInvite}
						disabled={
							!selectedOpportunityId ||
							inviteMutation.isPending ||
							publishedOpportunities.length === 0
						}
					>
						{inviteMutation.isPending ? 'Sending…' : 'Send Invitation'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ResultsSkeleton() {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<Card key={String(i)}>
					<CardHeader className="pb-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-24 mt-1" />
					</CardHeader>
					<CardContent className="pt-0 flex flex-col gap-3">
						<div className="flex gap-1">
							<Skeleton className="h-5 w-20" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-9 w-full" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function DiscoverClient() {
	// Filter state
	const [city, setCity] = useState('');
	const [state, setState] = useState('');
	const [availability, setAvailability] = useState('');

	// Applied filter state (only updated on search)
	const [appliedFilters, setAppliedFilters] = useState<{
		city?: string;
		state?: string;
		availability?: string;
		cursor?: string;
	}>({});

	// Pagination cursors
	const [cursors, setCursors] = useState<string[]>([]);
	const [cursor, setCursor] = useState<string | undefined>(undefined);

	// Invite dialog state
	const [inviteVolunteerId, setInviteVolunteerId] = useState<string | null>(
		null,
	);

	const searchQuery = trpc.discovery.searchVolunteers.useQuery(
		{
			...appliedFilters,
			cursor,
		},
		{
			placeholderData: (prev) => prev,
		},
	);

	const results: VolunteerSearchResult[] = searchQuery.data?.items ?? [];
	const nextCursor = searchQuery.data?.nextCursor ?? null;

	function handleSearch() {
		setCursor(undefined);
		setCursors([]);
		setAppliedFilters({
			city: city.trim() || undefined,
			state: state.trim() || undefined,
			availability: availability || undefined,
		});
	}

	function handleLoadMore() {
		if (!nextCursor) return;
		setCursors((prev) => [...prev, cursor ?? '']);
		setCursor(nextCursor);
	}

	function handlePrev() {
		const prev = cursors[cursors.length - 1];
		setCursors((c) => c.slice(0, -1));
		setCursor(prev === '' ? undefined : prev);
	}

	const hasPrev = cursors.length > 0;

	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="text-2xl font-semibold">Discover Volunteers</h1>
				<p className="text-muted-foreground text-sm mt-1">
					Search for PUBLIC volunteers and invite them to apply to your
					opportunities.
				</p>
			</div>

			{/* Filters */}
			<Card>
				<CardContent className="pt-6">
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div className="flex flex-col gap-1">
							<Label htmlFor="city">City</Label>
							<Input
								id="city"
								placeholder="e.g. Austin"
								value={city}
								onChange={(e) => setCity(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="state">State</Label>
							<Input
								id="state"
								placeholder="e.g. TX"
								value={state}
								onChange={(e) => setState(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="availability">Availability</Label>
							<Select value={availability} onValueChange={setAvailability}>
								<SelectTrigger id="availability">
									<SelectValue placeholder="Any availability" />
								</SelectTrigger>
								<SelectContent>
									{AVAILABILITY_OPTIONS.map((opt) => (
										<SelectItem key={opt.value || '_any'} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-end">
							<Button onClick={handleSearch} className="w-full">
								Search
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Results */}
			{searchQuery.isLoading && <ResultsSkeleton />}

			{!searchQuery.isLoading && results.length === 0 && (
				<div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
					<p className="text-lg font-medium">
						No volunteers match your filters.
					</p>
					<p className="text-sm mt-1">Try adjusting your search.</p>
				</div>
			)}

			{!searchQuery.isLoading && results.length > 0 && (
				<>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{results.map((volunteer) => (
							<VolunteerCard
								key={volunteer.userId}
								volunteer={volunteer}
								onInvite={(id) => setInviteVolunteerId(id)}
							/>
						))}
					</div>

					{/* Pagination */}
					<div className="flex justify-center gap-2">
						{hasPrev && (
							<Button variant="outline" onClick={handlePrev}>
								Previous
							</Button>
						)}
						{nextCursor && (
							<Button variant="outline" onClick={handleLoadMore}>
								Load More
							</Button>
						)}
					</div>
				</>
			)}

			{/* Invite dialog */}
			<InviteDialog
				volunteerId={inviteVolunteerId}
				open={inviteVolunteerId !== null}
				onClose={() => setInviteVolunteerId(null)}
			/>
		</div>
	);
}
