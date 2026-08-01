'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
	Calendar,
	CheckCircle2,
	Clock,
	Plus,
	Trash2,
	XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { ShiftTemplatesTab } from '@/components/app/shift-templates';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { PlanGate } from '@/components/plan-gate';
import { ShiftStatusBadge } from '@/components/shifts/shift-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePendingIds } from '@/lib/hooks/use-pending-ids';
import { trpc } from '@/lib/trpc/client';
import type { ShiftStatus } from '@/server/domain/shift';
import { ShiftDetailDialog } from './ShiftDetailDialog';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createShiftSchema = z
	.object({
		title: z.string().min(1, 'Title is required').max(200),
		description: z.string().optional(),
		location: z.string().optional(),
		isRemote: z.boolean(),
		startTime: z.string().min(1, 'Start time is required'),
		endTime: z.string().min(1, 'End time is required'),
		capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
	})
	.refine((d) => new Date(d.endTime) > new Date(d.startTime), {
		message: 'End time must be after start time',
		path: ['endTime'],
	});

type CreateShiftValues = z.infer<typeof createShiftSchema>;

// ---------------------------------------------------------------------------
// Create shift dialog
// ---------------------------------------------------------------------------

function CreateShiftDialog() {
	const [open, setOpen] = useState(false);
	const qc = useQueryClient();
	const create = trpc.shifts.create.useMutation({
		onSuccess: () => {
			toast.success('Shift created');
			setOpen(false);
			form.reset();
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not create that shift.'),
	});

	const form = useForm<CreateShiftValues>({
		resolver: zodResolver(createShiftSchema) as Resolver<CreateShiftValues>,
		defaultValues: {
			title: '',
			description: '',
			location: '',
			isRemote: false,
			startTime: '',
			endTime: '',
			capacity: 10,
		},
	});

	function onSubmit(values: CreateShiftValues) {
		create.mutate({
			title: values.title,
			description: values.description || undefined,
			location: values.location || undefined,
			isRemote: values.isRemote,
			startTime: new Date(values.startTime),
			endTime: new Date(values.endTime),
			capacity: values.capacity,
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" /> New Shift
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Create Shift</DialogTitle>
					<DialogDescription>Schedule a new volunteer shift.</DialogDescription>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1">
						<Label htmlFor="title">Title</Label>
						<Input id="title" {...form.register('title')} maxLength={200} />
						{form.formState.errors.title && (
							<p className="text-sm text-destructive">
								{form.formState.errors.title.message}
							</p>
						)}
					</div>
					<div className="space-y-1">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							{...form.register('description')}
							rows={2}
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<Label htmlFor="startTime">Start</Label>
							<Input
								id="startTime"
								type="datetime-local"
								{...form.register('startTime')}
							/>
							{form.formState.errors.startTime && (
								<p className="text-sm text-destructive">
									{form.formState.errors.startTime.message}
								</p>
							)}
						</div>
						<div className="space-y-1">
							<Label htmlFor="endTime">End</Label>
							<Input
								id="endTime"
								type="datetime-local"
								{...form.register('endTime')}
							/>
							{form.formState.errors.endTime && (
								<p className="text-sm text-destructive">
									{form.formState.errors.endTime.message}
								</p>
							)}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<Label htmlFor="capacity">Capacity</Label>
							<Input
								id="capacity"
								type="number"
								min={1}
								{...form.register('capacity')}
							/>
							{form.formState.errors.capacity && (
								<p className="text-sm text-destructive">
									{form.formState.errors.capacity.message}
								</p>
							)}
						</div>
						<div className="space-y-1">
							<Label htmlFor="location">Location</Label>
							<Input id="location" {...form.register('location')} />
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox id="isRemote" {...form.register('isRemote')} />
						<Label htmlFor="isRemote">Remote shift</Label>
					</div>
					<Button type="submit" disabled={create.isPending} className="w-full">
						{create.isPending ? 'Creating…' : 'Create Shift'}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Shared row pieces
//
// Both the table and the card list render these, so the date format, the
// confirm copy and the accessible names have one definition rather than two
// that drift.
// ---------------------------------------------------------------------------

function formatShiftDate(startTime: Date | string): string {
	return new Date(startTime).toLocaleDateString();
}

function formatShiftTimeRange(
	startTime: Date | string,
	endTime: Date | string,
): string {
	const at = (d: Date | string) =>
		new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	return `${at(startTime)} – ${at(endTime)}`;
}

/**
 * Complete / Cancel / Delete.
 *
 * These stay on the card rather than moving into `ShiftDetailDialog` the way
 * the roster's `Remove` moved into its detail dialog: the dialog holds signups,
 * the assign picker and attendance, and none of the three lifecycle actions
 * exist anywhere but this list. Pushing them one tap deeper would leave a phone
 * unable to close out a shift at all, which is a capability change wearing a
 * layout change's clothes.
 *
 * Already `h-11` before this ship — the 44px target was there, the layout
 * around it was not.
 */
function ShiftRowActions({
	shift,
	isPending,
	onComplete,
	onCancel,
	onDelete,
	className,
}: {
	shift: { id: string; title: string; status: string };
	/**
	 * True only for the row whose own mutation is in flight — never the bare
	 * `isPending`, which greys out every other row on one click. These are 44px
	 * targets on a phone over a slow connection, so without this a double-tap
	 * sends the mutation twice.
	 */
	isPending: boolean;
	onComplete: (id: string) => void;
	onCancel: (id: string) => void;
	onDelete: (id: string) => void;
	className?: string;
}) {
	const isLive = shift.status === 'OPEN' || shift.status === 'FULL';
	return (
		<div className={className}>
			{isLive ? (
				<>
					<Button
						size="icon"
						variant="outline"
						className="h-11 w-11"
						aria-label={`Mark "${shift.title}" complete`}
						disabled={isPending}
						onClick={() => onComplete(shift.id)}
					>
						<CheckCircle2 className="h-3 w-3" aria-hidden="true" />
					</Button>
					<Button
						size="icon"
						variant="outline"
						className="h-11 w-11"
						aria-label={`Cancel "${shift.title}"`}
						disabled={isPending}
						onClick={() => onCancel(shift.id)}
					>
						<XCircle className="h-3 w-3" aria-hidden="true" />
					</Button>
				</>
			) : null}
			<Button
				size="icon"
				variant="ghost"
				className="h-11 w-11"
				aria-label={`Delete "${shift.title}"`}
				disabled={isPending}
				onClick={() => {
					if (!confirm(`Delete "${shift.title}"? This cannot be undone.`))
						return;
					onDelete(shift.id);
				}}
			>
				<Trash2 className="h-3 w-3" aria-hidden="true" />
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ShiftsClient({
	hasVolunteerRoster,
}: {
	/**
	 * Resolved server-side in `page.tsx` and threaded down rather than read from
	 * a client query, so the assign picker never flashes in for a non-pilot org.
	 * Only `ShiftDetailDialog` consumes it.
	 */
	hasVolunteerRoster: boolean;
}) {
	const [statusFilter, setStatusFilter] = useState<string>('ALL');
	const qc = useQueryClient();

	const pending = usePendingIds();
	const shiftsQuery = trpc.shifts.list.useQuery(
		statusFilter === 'ALL'
			? {}
			: { status: statusFilter as 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' },
	);
	const { data: shifts, isLoading } = shiftsQuery;

	const cancelMut = trpc.shifts.cancel.useMutation({
		onMutate: (vars) => pending.start(vars.id),
		onSettled: (_data, _err, vars) => pending.finish(vars.id),
		onSuccess: () => {
			toast.success('Shift cancelled');
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not cancel that shift.'),
	});

	const completeMut = trpc.shifts.complete.useMutation({
		onMutate: (vars) => pending.start(vars.id),
		onSettled: (_data, _err, vars) => pending.finish(vars.id),
		onSuccess: () => {
			toast.success('Shift marked complete');
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not complete that shift.'),
	});

	const removeMut = trpc.shifts.remove.useMutation({
		onMutate: (vars) => pending.start(vars.id),
		onSettled: (_data, _err, vars) => pending.finish(vars.id),
		onSuccess: () => {
			toast.success('Shift deleted');
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not delete that shift.'),
	});

	return (
		<div className="space-y-6">
			<PageHeader
				title="Shifts"
				description="Manage volunteer shifts and attendance."
			/>

			<Tabs defaultValue="schedule">
				<TabsList>
					<TabsTrigger value="schedule">Schedule</TabsTrigger>
					<TabsTrigger value="templates">Templates</TabsTrigger>
				</TabsList>

				<TabsContent value="schedule" className="space-y-4">
					<div className="flex items-center justify-between">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ALL">All Statuses</SelectItem>
								<SelectItem value="OPEN">Open</SelectItem>
								<SelectItem value="FULL">Full</SelectItem>
								<SelectItem value="CANCELLED">Cancelled</SelectItem>
								<SelectItem value="COMPLETED">Completed</SelectItem>
							</SelectContent>
						</Select>

						<CreateShiftDialog />
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Shift Schedule</CardTitle>
							<CardDescription>
								Click a shift to view signups and manage attendance.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{isLoading ? (
								<div className="space-y-2 pt-2">
									{Array.from({ length: 5 }).map((_, i) => (
										<Skeleton key={i} className="h-12 w-full" />
									))}
								</div>
							) : shiftsQuery.isError ? (
								// Without this branch a failed query falls through to
								// "No shifts found" — a broken page that looks correct,
								// and the worst possible answer on a schedule someone is
								// checking to see whether Saturday is covered.
								<QueryErrorCard
									title="Couldn't load your shifts"
									message={safeErrorMessage(shiftsQuery.error)}
									onRetry={() => shiftsQuery.refetch()}
									isRetrying={shiftsQuery.isFetching}
								/>
							) : !shifts?.length ? (
								<EmptyState
									icon={Calendar}
									title="No shifts found"
									description="Create a shift to start scheduling volunteers."
									action={<CreateShiftDialog />}
								/>
							) : (
								<>
									{/* Both trees render from the same array and are switched
									    by CSS, never by `useMediaQuery`: that hook initialises
									    to `false` and only resolves in an effect, so gating the
									    LIST on it paints the card shape to every desktop user
									    and swaps it after hydration. `display: none` also takes
									    the hidden tree out of the accessibility tree, so
									    exactly one set of controls per shift is ever reachable.

									    That last point is what makes the per-row
									    `ShiftDetailDialog` safe to render in both trees: the
									    two instances cannot disagree — each is keyed on
									    `shiftId` and fetches only while open — and only one is
									    ever reachable. Hoisting to a single page-owned dialog,
									    the way the roster had to, would buy nothing here; the
									    roster needed it because its dialog owns a REMOVE
									    mutation whose callback the page has to survive.

									    **Crossing `lg` with a dialog open does NOT close it.**
									    An earlier version of this comment claimed it did. The
									    switch is CSS, so React unmounts nothing, and Radix
									    portals `DialogContent` to `document.body` — outside the
									    subtree `display: none` hides — so the open dialog is
									    unaffected and only the trigger row beneath it swaps.
									    That is why this needs no `useFrozenDesktopShell`, which
									    exists for the Dialog↔Drawer case where the two really
									    are different root elements. Pinned by an e2e that opens
									    the sheet at 375px and resizes to 1200px. */}
									<div className="hidden lg:block" data-testid="shifts-table">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Shift</TableHead>
													<TableHead>Date & Time</TableHead>
													<TableHead>Location</TableHead>
													<TableHead>Signups</TableHead>
													<TableHead>Status</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{shifts.map((shift) => (
													<TableRow key={shift.id}>
														<TableCell>
															<ShiftDetailDialog
																shiftId={shift.id}
																hasVolunteerRoster={hasVolunteerRoster}
															>
																<button
																	type="button"
																	className="text-left font-medium hover:underline"
																>
																	{shift.title}
																	{shift.opportunity && (
																		<span className="ml-2 text-xs text-muted-foreground">
																			({shift.opportunity.title})
																		</span>
																	)}
																</button>
															</ShiftDetailDialog>
														</TableCell>
														<TableCell className="whitespace-nowrap">
															<div className="flex items-center gap-1 text-sm">
																<Calendar className="h-3 w-3" />
																{formatShiftDate(shift.startTime)}
															</div>
															<div className="flex items-center gap-1 text-xs text-muted-foreground">
																<Clock className="h-3 w-3" />
																{formatShiftTimeRange(
																	shift.startTime,
																	shift.endTime,
																)}
															</div>
														</TableCell>
														<TableCell>
															{shift.isRemote ? (
																<Badge variant="outline">Remote</Badge>
															) : (
																(shift.location ?? '—')
															)}
														</TableCell>
														<TableCell>
															{shift._count.signups} / {shift.capacity}
														</TableCell>
														<TableCell>
															<ShiftStatusBadge
																status={shift.status as ShiftStatus}
															/>
														</TableCell>
														<TableCell className="text-right">
															<ShiftRowActions
																shift={shift}
																isPending={pending.has(shift.id)}
																className="flex justify-end gap-1"
																onComplete={(id) => completeMut.mutate({ id })}
																onCancel={(id) => cancelMut.mutate({ id })}
																onDelete={(id) => removeMut.mutate({ id })}
															/>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>

									{/* Title, date/time and the signup count are what a
									    coordinator opens this page on a phone to answer — "is
									    Saturday covered?" — so they lead. Location folds in
									    beside the count, and the linked opportunity drops to
									    the detail dialog one tap away on the title.

									    The one of the five that does NOT use `CardList`: this
									    list already sits inside the page's "Shift Schedule"
									    `Card`, which supplies the surface, border and radius,
									    so another Card here is double chrome. A first pass
									    tried `CardList` pulled out with `-mx-6` to cancel the
									    inherited padding; that makes the list wider than the
									    wrapper measuring it and the e2e caught it as internal
									    sideways scroll — which is the exact failure mode these
									    lists exist to remove. Plain `divide-y` on the wrapper
									    is the whole requirement here. */}
									<div
										className="divide-y lg:hidden"
										data-testid="shifts-card-list"
									>
										{shifts.map((shift) => (
											<div key={shift.id} className="flex flex-col gap-2 py-3">
												<div className="flex items-start justify-between gap-2">
													<ShiftDetailDialog
														shiftId={shift.id}
														hasVolunteerRoster={hasVolunteerRoster}
													>
														{/* min-w-0 so truncate engages inside the flex
															    row: a long title otherwise widens the card
															    past the viewport, which is the sideways
															    scroll this layout exists to remove. */}
														<button
															type="button"
															className="min-w-0 truncate text-left font-medium hover:underline"
														>
															{shift.title}
														</button>
													</ShiftDetailDialog>
													<ShiftStatusBadge
														status={shift.status as ShiftStatus}
														className="shrink-0"
													/>
												</div>

												<div className="flex items-center gap-1 text-xs text-muted-foreground">
													<Calendar className="h-3 w-3 shrink-0" />
													<span className="truncate">
														{formatShiftDate(shift.startTime)} ·{' '}
														{formatShiftTimeRange(
															shift.startTime,
															shift.endTime,
														)}
													</span>
												</div>

												<div className="flex items-center justify-between gap-2">
													<span className="min-w-0 truncate text-xs text-muted-foreground">
														{shift.isRemote
															? 'Remote'
															: (shift.location ?? '—')}{' '}
														· {shift._count.signups}/{shift.capacity} signed up
													</span>
													<ShiftRowActions
														shift={shift}
														isPending={pending.has(shift.id)}
														className="flex shrink-0 gap-1"
														onComplete={(id) => completeMut.mutate({ id })}
														onCancel={(id) => cancelMut.mutate({ id })}
														onDelete={(id) => removeMut.mutate({ id })}
													/>
												</div>
											</div>
										))}
									</div>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="templates">
					<PlanGate
						requiredTier="STARTER"
						feature="Shift Templates"
						description="Create reusable shift templates and generate weeks of shifts automatically."
					>
						<ShiftTemplatesTab />
					</PlanGate>
				</TabsContent>
			</Tabs>
		</div>
	);
}
