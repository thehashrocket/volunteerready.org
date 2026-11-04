'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CardList } from '@/components/app/card-list';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingIds } from '@/lib/hooks/use-pending-ids';
import { trpc } from '@/lib/trpc/client';

function formatDay(d: Date | string) {
	return new Date(d).toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
	});
}

function formatTime(d: Date | string) {
	return new Date(d).toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
	});
}

function seatsLabel(seatsLeft: number) {
	return seatsLeft === 1 ? '1 spot left' : `${seatsLeft} spots left`;
}

/**
 * Open shifts at every organization that has approved this volunteer, with a
 * button to take one. Lives on My Shifts, under the volunteer's own signups.
 *
 * The list comes from `shifts.claimable`, which only returns orgs that have the
 * volunteer on their roster, so a stranger never sees an org's schedule here.
 * A full shift offers the waitlist instead of a signup.
 */
export function OpenShifts() {
	const qc = useQueryClient();
	const pending = usePendingIds();
	const shifts = trpc.shifts.claimable.useQuery();

	const refresh = () => qc.invalidateQueries();

	const signup = trpc.shifts.signup.useMutation({
		onMutate: (vars) => pending.start(vars.shiftId),
		onSettled: (_d, _e, vars) => pending.finish(vars.shiftId),
		onSuccess: () => {
			toast.success("You're signed up. It's in your shifts above.");
			refresh();
		},
		onError: (err) => {
			toast.error(
				safeErrorMessage(err) ?? "We couldn't sign you up. Try again.",
			);
			// The shift may have filled or closed since the list loaded.
			refresh();
		},
	});

	const waitlist = trpc.shifts.joinWaitlist.useMutation({
		onMutate: (vars) => pending.start(vars.shiftId),
		onSettled: (_d, _e, vars) => pending.finish(vars.shiftId),
		onSuccess: () => {
			toast.success(
				"You're on the waitlist. We'll move you up if a spot opens.",
			);
			refresh();
		},
		onError: (err) => {
			toast.error(
				safeErrorMessage(err) ?? "We couldn't add you to the waitlist.",
			);
			refresh();
		},
	});

	return (
		<section aria-labelledby="open-shifts-heading" className="space-y-3">
			<div>
				<h2 id="open-shifts-heading" className="text-lg font-semibold">
					Open shifts
				</h2>
				<p className="text-sm text-muted-foreground">
					From organizations that have approved you. Pick one and it’s yours.
				</p>
			</div>

			{shifts.isLoading ? (
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</CardContent>
				</Card>
			) : shifts.isError ? (
				<QueryErrorCard
					title="Couldn't load open shifts"
					message={safeErrorMessage(shifts.error)}
					onRetry={() => shifts.refetch()}
					isRetrying={shifts.isFetching}
				/>
			) : !shifts.data?.length ? (
				<Card>
					<CardContent className="pt-6 text-sm text-muted-foreground">
						No open shifts right now. Once an organization approves your
						application, its upcoming shifts show up here.
					</CardContent>
				</Card>
			) : (
				<CardList>
					{shifts.data.map((shift) => {
						const busy = pending.has(shift.id);
						return (
							<div
								key={shift.id}
								className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
								data-testid="open-shift"
							>
								<div className="min-w-0 space-y-1">
									<p className="font-medium leading-snug">{shift.title}</p>
									<p className="text-sm text-muted-foreground">
										{shift.orgName}
										{shift.opportunityTitle
											? ` · ${shift.opportunityTitle}`
											: ''}
									</p>
									<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
										<span className="flex items-center gap-1.5">
											<Calendar className="h-4 w-4" aria-hidden="true" />
											{formatDay(shift.startTime)}
										</span>
										<span className="flex items-center gap-1.5">
											<Clock className="h-4 w-4" aria-hidden="true" />
											{formatTime(shift.startTime)} –{' '}
											{formatTime(shift.endTime)}
										</span>
										{shift.isRemote ? (
											<Badge variant="outline">Remote</Badge>
										) : shift.location ? (
											<span className="flex items-center gap-1.5">
												<MapPin className="h-4 w-4" aria-hidden="true" />
												{shift.location}
											</span>
										) : null}
										<span className="flex items-center gap-1.5">
											<Users className="h-4 w-4" aria-hidden="true" />
											{shift.isFull ? 'Full' : seatsLabel(shift.seatsLeft)}
										</span>
									</div>
								</div>
								<div className="shrink-0">
									{shift.myStatus === 'CONFIRMED' ? (
										<Badge variant="success">You’re signed up</Badge>
									) : shift.myStatus === 'WAITLISTED' ? (
										<Badge variant="warning">On the waitlist</Badge>
									) : shift.myStatus === 'ATTENDED' ||
										shift.myStatus === 'NO_SHOW' ? (
										<Badge variant="outline">Already recorded</Badge>
									) : shift.isFull ? (
										<Button
											variant="outline"
											size="sm"
											className="w-full sm:w-auto"
											disabled={busy}
											onClick={() => waitlist.mutate({ shiftId: shift.id })}
										>
											Join waitlist
										</Button>
									) : (
										<Button
											size="sm"
											className="w-full sm:w-auto"
											disabled={busy}
											onClick={() => signup.mutate({ shiftId: shift.id })}
										>
											Sign up
										</Button>
									)}
								</div>
							</div>
						);
					})}
				</CardList>
			)}
		</section>
	);
}
