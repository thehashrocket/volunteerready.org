'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Copy, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
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
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';
import { DAY_OF_WEEK_LABELS } from '@/server/domain/shift';

// ---------------------------------------------------------------------------
// Create template schema (client-side with string inputs)
// ---------------------------------------------------------------------------

const createTemplateSchema = z.object({
	title: z.string().min(1, 'Title is required').max(200),
	description: z.string().optional(),
	location: z.string().optional(),
	isRemote: z.boolean(),
	dayOfWeek: z.coerce.number().int().min(0).max(6),
	startTime: z.string().min(1, 'Start time is required'),
	endTime: z.string().min(1, 'End time is required'),
	capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
});

type CreateTemplateValues = z.infer<typeof createTemplateSchema>;

function parseTimeString(t: string): { hour: number; minute: number } {
	const [h, m] = t.split(':').map(Number);
	return { hour: h, minute: m };
}

function formatTime(h: number, m: number): string {
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Create template dialog
// ---------------------------------------------------------------------------

function CreateTemplateDialog() {
	const [open, setOpen] = useState(false);
	const qc = useQueryClient();
	const create = trpc.shiftTemplates.create.useMutation({
		onSuccess: () => {
			toast.success('Template created');
			setOpen(false);
			form.reset();
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not create that template.'),
	});

	const form = useForm<CreateTemplateValues>({
		resolver: zodResolver(
			createTemplateSchema,
		) as Resolver<CreateTemplateValues>,
		defaultValues: {
			title: '',
			description: '',
			location: '',
			isRemote: false,
			dayOfWeek: 1,
			startTime: '09:00',
			endTime: '12:00',
			capacity: 10,
		},
	});

	function onSubmit(values: CreateTemplateValues) {
		const start = parseTimeString(values.startTime);
		const end = parseTimeString(values.endTime);
		create.mutate({
			title: values.title,
			description: values.description || undefined,
			location: values.location || undefined,
			isRemote: values.isRemote,
			dayOfWeek: values.dayOfWeek,
			startHour: start.hour,
			startMinute: start.minute,
			endHour: end.hour,
			endMinute: end.minute,
			capacity: values.capacity,
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" /> New Template
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Create Shift Template</DialogTitle>
					<DialogDescription>
						Define a recurring shift pattern. Generate concrete shifts from it.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1">
						<Label htmlFor="tmpl-title">Title</Label>
						<Input
							id="tmpl-title"
							{...form.register('title')}
							maxLength={200}
						/>
						{form.formState.errors.title && (
							<p className="text-sm text-destructive">
								{form.formState.errors.title.message}
							</p>
						)}
					</div>
					<div className="space-y-1">
						<Label htmlFor="tmpl-desc">Description</Label>
						<Textarea
							id="tmpl-desc"
							{...form.register('description')}
							rows={2}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="tmpl-day">Day of Week</Label>
						<Select
							value={String(form.watch('dayOfWeek'))}
							onValueChange={(v) => form.setValue('dayOfWeek', Number(v))}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DAY_OF_WEEK_LABELS.map((label, i) => (
									<SelectItem key={i} value={String(i)}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<Label htmlFor="tmpl-start">Start Time</Label>
							<Input
								id="tmpl-start"
								type="time"
								{...form.register('startTime')}
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="tmpl-end">End Time</Label>
							<Input id="tmpl-end" type="time" {...form.register('endTime')} />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<Label htmlFor="tmpl-capacity">Capacity</Label>
							<Input
								id="tmpl-capacity"
								type="number"
								min={1}
								{...form.register('capacity')}
							/>
						</div>
						<div className="space-y-1">
							<Label htmlFor="tmpl-location">Location</Label>
							<Input id="tmpl-location" {...form.register('location')} />
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox id="tmpl-remote" {...form.register('isRemote')} />
						<Label htmlFor="tmpl-remote">Remote shift</Label>
					</div>
					<Button type="submit" disabled={create.isPending} className="w-full">
						{create.isPending ? 'Creating…' : 'Create Template'}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Generate shifts dialog
// ---------------------------------------------------------------------------

function GenerateShiftsDialog({ templateId }: { templateId: string }) {
	const [open, setOpen] = useState(false);
	const [weeks, setWeeks] = useState(4);
	const [startDate, setStartDate] = useState(
		new Date().toISOString().split('T')[0],
	);
	const qc = useQueryClient();

	const generate = trpc.shiftTemplates.generate.useMutation({
		onSuccess: (data) => {
			toast.success(`${data.count} shifts created`);
			setOpen(false);
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not generate shifts.'),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline">
					<Copy className="mr-1 h-3 w-3" /> Generate
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Generate Shifts</DialogTitle>
					<DialogDescription>
						Create concrete shifts from this template.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1">
						<Label htmlFor="gen-start">Start Date</Label>
						<Input
							id="gen-start"
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="gen-weeks">Number of Weeks</Label>
						<Input
							id="gen-weeks"
							type="number"
							min={1}
							max={52}
							value={weeks}
							onChange={(e) => setWeeks(Number(e.target.value))}
						/>
					</div>
					<Button
						className="w-full"
						disabled={generate.isPending}
						onClick={() =>
							generate.mutate({
								templateId,
								weeks,
								startDate: new Date(startDate),
							})
						}
					>
						{generate.isPending
							? 'Generating…'
							: `Generate ${weeks} Shift${weeks !== 1 ? 's' : ''}`}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------
// Templates list
// ---------------------------------------------------------------------------

export function ShiftTemplatesTab() {
	const qc = useQueryClient();
	const { data: templates, isLoading } = trpc.shiftTemplates.list.useQuery();

	const removeMut = trpc.shiftTemplates.remove.useMutation({
		onSuccess: () => {
			toast.success('Template deleted');
			qc.invalidateQueries();
		},
		onError: (err) =>
			toast.error(safeErrorMessage(err) ?? 'Could not delete that template.'),
	});

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<CreateTemplateDialog />
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Shift Templates</CardTitle>
					<CardDescription>
						Define recurring shift patterns and generate weeks of shifts at
						once.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-2 pt-2">
							{Array.from({ length: 3 }).map((_, i) => (
								<Skeleton key={i} className="h-12 w-full" />
							))}
						</div>
					) : !templates?.length ? (
						<EmptyState
							icon={Calendar}
							title="No templates yet"
							description="Create a template to define recurring shift patterns."
						/>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Template</TableHead>
									<TableHead>Day</TableHead>
									<TableHead>Time</TableHead>
									<TableHead>Capacity</TableHead>
									<TableHead>Shifts</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{templates.map((tmpl) => (
									<TableRow key={tmpl.id}>
										<TableCell className="font-medium">
											{tmpl.title}
											{tmpl.isRemote && (
												<Badge variant="outline" className="ml-2">
													Remote
												</Badge>
											)}
										</TableCell>
										<TableCell>{DAY_OF_WEEK_LABELS[tmpl.dayOfWeek]}</TableCell>
										<TableCell className="whitespace-nowrap">
											{formatTime(tmpl.startHour, tmpl.startMinute)} –{' '}
											{formatTime(tmpl.endHour, tmpl.endMinute)}
										</TableCell>
										<TableCell>{tmpl.capacity}</TableCell>
										<TableCell>{tmpl._count.shifts}</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1">
												<GenerateShiftsDialog templateId={tmpl.id} />
												<Button
													size="icon"
													variant="ghost"
													className="h-11 w-11"
													aria-label={`Delete template "${tmpl.title}"`}
													onClick={() => {
														if (
															!confirm(
																`Delete "${tmpl.title}"? This cannot be undone.`,
															)
														)
															return;
														removeMut.mutate({ id: tmpl.id });
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
		</div>
	);
}
