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
		onError: (err) => toast.error(err.message),
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

	const { data: shifts, isLoading } = trpc.shifts.list.useQuery(
		statusFilter === 'ALL'
			? {}
			: { status: statusFilter as 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' },
	);

	const cancelMut = trpc.shifts.cancel.useMutation({
		onSuccess: () => {
			toast.success('Shift cancelled');
			qc.invalidateQueries();
		},
		onError: (err) => toast.error(err.message),
	});

	const completeMut = trpc.shifts.complete.useMutation({
		onSuccess: () => {
			toast.success('Shift marked complete');
			qc.invalidateQueries();
		},
		onError: (err) => toast.error(err.message),
	});

	const removeMut = trpc.shifts.remove.useMutation({
		onSuccess: () => {
			toast.success('Shift deleted');
			qc.invalidateQueries();
		},
		onError: (err) => toast.error(err.message),
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
							) : !shifts?.length ? (
								<EmptyState
									icon={Calendar}
									title="No shifts found"
									description="Create a shift to start scheduling volunteers."
									action={<CreateShiftDialog />}
								/>
							) : (
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
														{new Date(shift.startTime).toLocaleDateString()}
													</div>
													<div className="flex items-center gap-1 text-xs text-muted-foreground">
														<Clock className="h-3 w-3" />
														{new Date(shift.startTime).toLocaleTimeString([], {
															hour: '2-digit',
															minute: '2-digit',
														})}{' '}
														–{' '}
														{new Date(shift.endTime).toLocaleTimeString([], {
															hour: '2-digit',
															minute: '2-digit',
														})}
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
													<div className="flex justify-end gap-1">
														{shift.status === 'OPEN' ||
														shift.status === 'FULL' ? (
															<>
																<Button
																	size="icon"
																	variant="outline"
																	className="h-11 w-11"
																	aria-label={`Mark "${shift.title}" complete`}
																	onClick={() =>
																		completeMut.mutate({ id: shift.id })
																	}
																>
																	<CheckCircle2
																		className="h-3 w-3"
																		aria-hidden="true"
																	/>
																</Button>
																<Button
																	size="icon"
																	variant="outline"
																	className="h-11 w-11"
																	aria-label={`Cancel "${shift.title}"`}
																	onClick={() =>
																		cancelMut.mutate({ id: shift.id })
																	}
																>
																	<XCircle
																		className="h-3 w-3"
																		aria-hidden="true"
																	/>
																</Button>
															</>
														) : null}
														<Button
															size="icon"
															variant="ghost"
															className="h-11 w-11"
															aria-label={`Delete "${shift.title}"`}
															onClick={() => {
																if (
																	!confirm(
																		`Delete "${shift.title}"? This cannot be undone.`,
																	)
																)
																	return;
																removeMut.mutate({ id: shift.id });
															}}
														>
															<Trash2 className="h-3 w-3" aria-hidden="true" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
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
