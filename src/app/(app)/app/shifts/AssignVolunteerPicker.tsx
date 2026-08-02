'use client';

import { ChevronsUpDown, Loader2, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { VolunteerStatusBadge } from '@/components/volunteers/volunteer-status-badge';
import { trpc } from '@/lib/trpc/client';

type Candidate = {
	id: string;
	displayName: string;
	email: string | null;
	accountState: 'UNCLAIMED' | 'ACTIVE';
};

/**
 * Assign a volunteer from the org roster onto this shift.
 *
 * This is the control the roster exists for — without it `/app/volunteers` is a
 * list that leads nowhere.
 *
 * **Server-side search, not client-side filtering.** The three existing
 * `Command` consumers (`settings/team`, `OpportunityDialog`, `my-skills`) all
 * filter a small static array in the browser. A roster is unbounded and lives
 * behind a query that also has to exclude everyone already on this shift, which
 * the client cannot compute: roster rows are keyed by `OrgVolunteer.id` and
 * signups by `User.id`, and the roster projection deliberately withholds
 * `User.id` from clients. So `shouldFilter={false}` and cmdk is used purely as
 * the keyboard/aria shell over a debounced server query.
 *
 * `volunteerId` is that `OrgVolunteer.id`, and it is the only person handle that
 * crosses the wire.
 */
export function AssignVolunteerPicker({
	shiftId,
	shiftTitle,
	capacity,
	confirmedCount,
	onAssigned,
}: {
	shiftId: string;
	shiftTitle: string;
	capacity: number;
	confirmedCount: number;
	onAssigned: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	// Set only when the chosen volunteer would exceed capacity, which swaps the
	// list for the confirm strip. Never pre-set: over capacity is always an
	// explicit, separate decision (design decision D11).
	const [pending, setPending] = useState<Candidate | null>(null);
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (debounceTimer.current) clearTimeout(debounceTimer.current);
		debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 250);
		return () => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, [search]);

	const candidates = trpc.shifts.assignableVolunteers.useQuery(
		{ shiftId, search: debouncedSearch.trim() || null },
		{ enabled: open },
	);

	const assign = trpc.shifts.assignVolunteer.useMutation({
		onSuccess: (result) => {
			toast.success(
				result.accountState === 'UNCLAIMED'
					? // The suppression has to be said at the moment it is caused. The
						// signups table repeats it persistently, because assignment
						// happens weeks before the coordinator can act on it.
						`${result.displayName} added to ${result.shiftTitle}. They won't get an automatic reminder — no account yet.`
					: `${result.displayName} added to ${result.shiftTitle}.`,
			);
			reset();
			onAssigned();
		},
		// The fallback is not optional: `toast.error(undefined)` still opens a
		// toast, just an empty one, so a withheld message failed SILENTLY here —
		// worse than the leak it was guarding against.
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not assign that volunteer.'),
	});

	function reset() {
		setOpen(false);
		setPending(null);
		setSearch('');
		setDebouncedSearch('');
	}

	const isFull = confirmedCount >= capacity;

	function choose(candidate: Candidate) {
		if (isFull) {
			setPending(candidate);
			return;
		}
		assign.mutate({ shiftId, volunteerId: candidate.id });
	}

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setPending(null);
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" aria-expanded={open}>
					<UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
					Assign volunteer
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 p-0"
				// While the confirm strip is up, Escape backs out of the confirm
				// rather than closing the whole popover — a coordinator who declines
				// to go over capacity usually wants to pick someone else, not start
				// over. Handled here rather than on the strip so it goes through
				// Radix's dismiss layer instead of a keydown listener on a div.
				onEscapeKeyDown={(e) => {
					if (!pending) return;
					e.preventDefault();
					setPending(null);
				}}
			>
				{pending ? (
					<OverCapacityConfirm
						candidate={pending}
						shiftTitle={shiftTitle}
						capacity={capacity}
						confirmedCount={confirmedCount}
						isPending={assign.isPending}
						onCancel={() => setPending(null)}
						onConfirm={() =>
							assign.mutate({
								shiftId,
								volunteerId: pending.id,
								allowOverCapacity: true,
							})
						}
					/>
				) : (
					<Command shouldFilter={false}>
						<CommandInput
							placeholder="Search your roster…"
							value={search}
							onValueChange={setSearch}
						/>
						<CommandList>
							{candidates.isLoading ? (
								<div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
									<Loader2
										className="h-4 w-4 animate-spin"
										aria-hidden="true"
									/>
									Loading…
								</div>
							) : candidates.isError ? (
								<div
									role="alert"
									className="px-4 py-6 text-destructive text-sm"
								>
									{safeErrorMessage(candidates.error) ??
										'Could not load your roster.'}
								</div>
							) : (
								<>
									<CommandEmpty>No volunteers match that search.</CommandEmpty>
									<CommandGroup>
										{(candidates.data ?? []).map((candidate) => (
											<CommandItem
												key={candidate.id}
												value={candidate.id}
												disabled={assign.isPending}
												onSelect={() => choose(candidate)}
												className="flex items-start justify-between gap-2"
											>
												<span className="min-w-0">
													<span className="block truncate font-medium">
														{candidate.displayName}
													</span>
													{candidate.email && (
														<span className="block truncate text-muted-foreground text-xs">
															{candidate.email}
														</span>
													)}
												</span>
												<VolunteerStatusBadge
													state={candidate.accountState}
													className="shrink-0"
												/>
											</CommandItem>
										))}
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				)}
			</PopoverContent>
		</Popover>
	);
}

/**
 * The confirm strip that replaces the list when the chosen volunteer would take
 * the shift over capacity.
 *
 * States the real numbers rather than "this shift is full", because the
 * coordinator is deciding whether one more is acceptable and "9 of 9" and
 * "40 of 9" are very different decisions.
 *
 * Escape returns to the picker rather than closing the popover; that is handled
 * by the parent's `onEscapeKeyDown`.
 */
function OverCapacityConfirm({
	candidate,
	shiftTitle,
	capacity,
	confirmedCount,
	isPending,
	onCancel,
	onConfirm,
}: {
	candidate: Candidate;
	shiftTitle: string;
	capacity: number;
	confirmedCount: number;
	isPending: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div className="space-y-3 p-4">
			<p className="text-sm">
				<span className="font-medium">{shiftTitle}</span> is full —{' '}
				<span className="tabular-nums">
					{confirmedCount} of {capacity}
				</span>{' '}
				spots taken. Add {candidate.displayName} anyway?
			</p>
			<div className="flex justify-end gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onCancel}
					disabled={isPending}
				>
					Cancel
				</Button>
				{/* Takes focus on open so the decision is one keypress away either
				    way, and so a screen reader lands on the action rather than on
				    the list that just disappeared. */}
				<Button autoFocus size="sm" onClick={onConfirm} disabled={isPending}>
					{isPending ? 'Adding…' : 'Add anyway'}
				</Button>
			</div>
		</div>
	);
}
