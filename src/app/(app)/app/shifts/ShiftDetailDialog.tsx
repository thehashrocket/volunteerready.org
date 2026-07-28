'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Users, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SignupStatusBadge } from '@/components/shifts/shift-status-badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { VolunteerStatusBadge } from '@/components/volunteers/volunteer-status-badge';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import type { SignupStatus } from '@/server/domain/shift';
import { AssignVolunteerPicker } from './AssignVolunteerPicker';

/**
 * Shift detail: capacity, the assign picker, signups and attendance, waitlist.
 *
 * Lifted out of `shifts/page.tsx` when the assign picker landed — that file was
 * already 665 lines with three components in it, and this one grew a picker, a
 * suppression disclosure and its own tests.
 *
 * `hasVolunteerRoster` gates the two staff-created-volunteer surfaces here (the
 * picker and the reminder-suppression disclosure) per the design's gating
 * split. Hiding them is cosmetic — `shifts.assignVolunteer` and
 * `shifts.assignableVolunteers` are `rosterProcedure`, so the flag is enforced
 * server-side too.
 */
export function ShiftDetailDialog({
	shiftId,
	hasVolunteerRoster,
	children,
}: {
	shiftId: string;
	hasVolunteerRoster: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const qc = useQueryClient();
	const { data: shift } = trpc.shifts.getById.useQuery(
		{ id: shiftId },
		{ enabled: open },
	);
	const markAttendance = trpc.shifts.markAttendance.useMutation({
		onSuccess: () => {
			toast.success('Attendance updated');
			qc.invalidateQueries();
		},
		onError: (err) => toast.error(err.message),
	});

	const { data: waitlist } = trpc.shifts.getWaitlist.useQuery(
		{ shiftId },
		{ enabled: open },
	);

	// Live check-in counter — poll only when shift is within ±2h
	const isNearby =
		open &&
		shift &&
		(shift.status === 'OPEN' || shift.status === 'FULL') &&
		Math.abs(new Date(shift.startTime).getTime() - Date.now()) /
			(1000 * 60 * 60) <=
			2;
	const { data: checkinStats } = trpc.shifts.getCheckinStats.useQuery(
		{ shiftId },
		{
			enabled: !!isNearby,
			refetchInterval: isNearby ? 10_000 : false,
		},
	);

	const confirmed =
		shift?.signups.filter((s) => s.status === 'CONFIRMED') ?? [];

	// Only CONFIRMED signups are reminded, so only they can be silently missed.
	const unremindable = confirmed.filter(
		(s) => s.user.accountState === 'UNCLAIMED',
	).length;

	const overCapacity = !!shift && confirmed.length > shift.capacity;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>{shift?.title ?? 'Shift Details'}</DialogTitle>
					<DialogDescription>
						{shift
							? `${new Date(shift.startTime).toLocaleString()} — ${new Date(shift.endTime).toLocaleTimeString()}`
							: 'Loading…'}
					</DialogDescription>
				</DialogHeader>
				{shift && (
					<div className="space-y-4">
						{checkinStats && (
							<div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
								<Users className="h-4 w-4 text-muted-foreground" />
								<span className="font-medium text-sm tabular-nums">
									{checkinStats.attended}/{checkinStats.total} checked in
								</span>
								<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-primary transition-all duration-300"
										style={{ width: `${checkinStats.rate}%` }}
									/>
								</div>
								<span className="text-muted-foreground text-xs tabular-nums">
									{checkinStats.rate}%
								</span>
							</div>
						)}
						<div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
							<span className="flex items-center gap-1">
								<Users className="h-4 w-4" />
								{/* Stays visible in the warning tone once exceeded, rather
								    than normalising back to plain text — the coordinator
								    chose to go over and should keep seeing that they did. */}
								<span
									className={cn(
										'tabular-nums',
										overCapacity && 'font-medium text-warning-foreground',
									)}
								>
									{confirmed.length} / {shift.capacity}
								</span>
							</span>
							{shift.location && (
								<span className="flex items-center gap-1">
									<MapPin className="h-4 w-4" /> {shift.location}
								</span>
							)}
							{hasVolunteerRoster && (
								<span className="ml-auto">
									<AssignVolunteerPicker
										shiftId={shift.id}
										shiftTitle={shift.title}
										capacity={shift.capacity}
										confirmedCount={confirmed.length}
										onAssigned={() => qc.invalidateQueries()}
									/>
								</span>
							)}
						</div>

						{/*
						 * The disclosure that matters most. Assignment happens weeks out;
						 * this is what the coordinator sees on the Friday afternoon they
						 * are checking Saturday is covered, which is when they can still
						 * pick up the phone. shift-reminder-service.ts suppresses these
						 * sends silently, and the plan's own argument for inverting the
						 * email guard was that failures should be visible and recoverable.
						 */}
						{hasVolunteerRoster && unremindable > 0 && (
							<p className="text-muted-foreground text-sm">
								{unremindable === 1
									? '1 volunteer won’t get an automatic reminder — no account yet.'
									: `${unremindable} volunteers won’t get an automatic reminder — no account yet.`}
							</p>
						)}

						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Volunteer</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{shift.signups.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={3}
											className="text-center text-muted-foreground"
										>
											No signups yet
										</TableCell>
									</TableRow>
								)}
								{shift.signups.map((signup) => (
									<TableRow key={signup.id}>
										<TableCell>
											<span className="flex flex-wrap items-center gap-2">
												{signup.user.name ?? signup.user.email ?? 'Unknown'}
												{/*
												 * UNCLAIMED only, deliberately. A "Has account" badge
												 * on every other row is noise in an operational table
												 * — its absence already says the same thing, and the
												 * summary line above carries the count. The picker
												 * renders both states, because there the reassurance
												 * is informative at the moment of choosing.
												 */}
												{hasVolunteerRoster &&
													signup.user.accountState === 'UNCLAIMED' && (
														<VolunteerStatusBadge state="UNCLAIMED" />
													)}
											</span>
										</TableCell>
										<TableCell>
											<SignupStatusBadge
												status={signup.status as SignupStatus}
											/>
										</TableCell>
										<TableCell className="text-right">
											{signup.status === 'CONFIRMED' && (
												<div className="flex justify-end gap-1">
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															markAttendance.mutate({
																shiftId: shift.id,
																userId: signup.user.id,
																status: 'ATTENDED',
															})
														}
													>
														<CheckCircle2 className="mr-1 h-3 w-3" /> Attended
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															markAttendance.mutate({
																shiftId: shift.id,
																userId: signup.user.id,
																status: 'NO_SHOW',
															})
														}
													>
														<XCircle className="mr-1 h-3 w-3" /> No Show
													</Button>
												</div>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>

						{waitlist && waitlist.length > 0 && (
							<div className="space-y-2">
								<h4 className="font-medium text-sm">
									Waitlist ({waitlist.length})
								</h4>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>#</TableHead>
											<TableHead>Volunteer</TableHead>
											<TableHead>Joined</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{waitlist.map((entry, idx) => (
											<TableRow key={entry.id}>
												<TableCell>{idx + 1}</TableCell>
												<TableCell>
													{entry.user.name ?? entry.user.email ?? 'Unknown'}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{new Date(entry.createdAt).toLocaleString()}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
