'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Requirement = { skill: string; level: 'REQUIRED' | 'PREFERRED' };

type Opportunity = {
	id: string;
	title: string;
	description: string;
	status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
	location: string | null;
	isRemote: boolean;
	startDate: Date | null;
	endDate: Date | null;
	commitmentHours: number | null;
	capacity: number | null;
	tags: { id: string; name: string }[];
	requirements: {
		id: string;
		skill: string;
		level: 'REQUIRED' | 'PREFERRED';
	}[];
};

interface OpportunityDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	opportunity?: Opportunity | null;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
	title: z.string().min(1, 'Title is required').max(200),
	description: z.string().min(1, 'Description is required').max(5000),
	location: z.string().max(200).optional(),
	isRemote: z.boolean(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	commitmentHours: z
		.union([
			z.number().positive('Must be positive'),
			z.nan().transform((): undefined => undefined),
		])
		.optional(),
	capacity: z
		.union([
			z.number().int().positive('Must be a positive whole number'),
			z.nan().transform((): undefined => undefined),
		])
		.optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateInput(d: Date | null | undefined): string {
	if (!d) return '';
	const date = d instanceof Date ? d : new Date(d);
	return date.toISOString().slice(0, 10);
}

function toISOString(dateStr: string | undefined): string | null {
	if (!dateStr) return null;
	// Use noon UTC so local-timezone formatting never shifts the date by one day.
	return `${dateStr}T12:00:00.000Z`;
}

// ---------------------------------------------------------------------------
// Tag input
// ---------------------------------------------------------------------------

function TagInput({
	tags,
	onChange,
}: {
	tags: string[];
	onChange: (tags: string[]) => void;
}) {
	const [input, setInput] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	function addTag(value: string) {
		const trimmed = value.trim().replace(/,+$/, '').toLowerCase();
		if (!trimmed || tags.includes(trimmed) || tags.length >= 10) return;
		onChange([...tags, trimmed]);
		setInput('');
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag(input);
		} else if (e.key === 'Backspace' && !input && tags.length > 0) {
			onChange(tags.slice(0, -1));
		}
	}

	return (
		<label className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text">
			{tags.map((tag) => (
				<span
					key={tag}
					className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
				>
					{tag}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onChange(tags.filter((t) => t !== tag));
						}}
						className="text-muted-foreground hover:text-foreground"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			))}
			<input
				ref={inputRef}
				value={input}
				onChange={(e) => {
					const val = e.target.value;
					if (val.endsWith(',')) {
						addTag(val);
					} else {
						setInput(val);
					}
				}}
				onKeyDown={handleKeyDown}
				onBlur={() => addTag(input)}
				placeholder={tags.length === 0 ? 'Add tags…' : ''}
				className="flex-1 min-w-20 bg-transparent outline-none placeholder:text-muted-foreground"
			/>
		</label>
	);
}

// ---------------------------------------------------------------------------
// Requirement input
// ---------------------------------------------------------------------------

function RequirementInput({
	requirements,
	onChange,
}: {
	requirements: Requirement[];
	onChange: (requirements: Requirement[]) => void;
}) {
	const [input, setInput] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	function addRequirement(value: string) {
		const skill = value.trim().replace(/,+$/, '').toLowerCase();
		if (
			!skill ||
			requirements.some((r) => r.skill === skill) ||
			requirements.length >= 20
		)
			return;
		onChange([...requirements, { skill, level: 'REQUIRED' }]);
		setInput('');
	}

	function toggleLevel(skill: string) {
		onChange(
			requirements.map((r) =>
				r.skill === skill
					? { ...r, level: r.level === 'REQUIRED' ? 'PREFERRED' : 'REQUIRED' }
					: r,
			),
		);
	}

	function removeRequirement(skill: string) {
		onChange(requirements.filter((r) => r.skill !== skill));
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addRequirement(input);
		} else if (e.key === 'Backspace' && !input && requirements.length > 0) {
			onChange(requirements.slice(0, -1));
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: click delegates focus to inner input
		<div
			className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text"
			onClick={() => inputRef.current?.focus()}
			onKeyDown={() => inputRef.current?.focus()}
		>
			{requirements.map((req) => (
				<span
					key={req.skill}
					className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
				>
					{req.skill}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							toggleLevel(req.skill);
						}}
						className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
							req.level === 'REQUIRED'
								? 'bg-stone-800 text-white hover:bg-stone-700'
								: 'bg-stone-200 text-stone-600 hover:bg-stone-300'
						}`}
					>
						{req.level === 'REQUIRED' ? 'Required' : 'Preferred'}
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							removeRequirement(req.skill);
						}}
						className="text-muted-foreground hover:text-foreground"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			))}
			<input
				ref={inputRef}
				value={input}
				onChange={(e) => {
					const val = e.target.value;
					if (val.endsWith(',')) {
						addRequirement(val);
					} else {
						setInput(val);
					}
				}}
				onKeyDown={handleKeyDown}
				onBlur={() => addRequirement(input)}
				placeholder={requirements.length === 0 ? 'Add a skill…' : ''}
				className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground"
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OpportunityDialog({
	open,
	onOpenChange,
	opportunity,
}: OpportunityDialogProps) {
	const qc = useQueryClient();
	const isEdit = Boolean(opportunity);
	const [tags, setTags] = useState<string[]>([]);
	const [requirements, setRequirements] = useState<Requirement[]>([]);

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			title: '',
			description: '',
			location: '',
			isRemote: false,
			startDate: '',
			endDate: '',
		},
	});

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			if (opportunity) {
				reset({
					title: opportunity.title,
					description: opportunity.description,
					location: opportunity.location ?? '',
					isRemote: opportunity.isRemote,
					startDate: toDateInput(opportunity.startDate),
					endDate: toDateInput(opportunity.endDate),
					commitmentHours: opportunity.commitmentHours ?? undefined,
					capacity: opportunity.capacity ?? undefined,
				});
				setTags(opportunity.tags.map((t) => t.name));
				setRequirements(
					opportunity.requirements.map((r) => ({
						skill: r.skill,
						level: r.level,
					})),
				);
			} else {
				reset({
					title: '',
					description: '',
					location: '',
					isRemote: false,
					startDate: '',
					endDate: '',
					commitmentHours: undefined,
					capacity: undefined,
				});
				setTags([]);
				setRequirements([]);
			}
		}
	}, [open, opportunity, reset]);

	const isRemote = watch('isRemote') ?? false;

	const createMutation = trpc.opportunities.create.useMutation({
		onSuccess: async () => {
			toast.success('Opportunity created.');
			await qc.invalidateQueries();
			onOpenChange(false);
		},
		onError: (err) =>
			toast.error(err.message ?? 'Failed to create opportunity.'),
	});

	const updateMutation = trpc.opportunities.update.useMutation({
		onSuccess: async () => {
			toast.success('Opportunity updated.');
			await qc.invalidateQueries();
			onOpenChange(false);
		},
		onError: (err) =>
			toast.error(err.message ?? 'Failed to update opportunity.'),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function onSubmit(values: FormValues) {
		const payload = {
			title: values.title,
			description: values.description,
			location: values.location || null,
			isRemote: values.isRemote,
			startDate: toISOString(values.startDate) ?? undefined,
			endDate: toISOString(values.endDate) ?? undefined,
			commitmentHours: values.commitmentHours ?? null,
			capacity: values.capacity ?? null,
			tags,
			requirements,
		};

		if (isEdit && opportunity) {
			updateMutation.mutate({ id: opportunity.id, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? 'Edit opportunity' : 'New opportunity'}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
					{/* Title */}
					<div className="space-y-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							placeholder="e.g. Food Pantry Volunteer"
							{...register('title')}
						/>
						{errors.title?.message && (
							<p className="text-sm text-destructive">{errors.title.message}</p>
						)}
					</div>

					{/* Description */}
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							rows={4}
							placeholder="Describe the role, responsibilities, and what volunteers will do…"
							{...register('description')}
						/>
						{errors.description?.message && (
							<p className="text-sm text-destructive">
								{errors.description.message}
							</p>
						)}
					</div>

					{/* Location + Remote */}
					<div className="space-y-3">
						<div className="space-y-2">
							<Label htmlFor="location">
								Location{' '}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input
								id="location"
								placeholder="e.g. 123 Main St, Springfield"
								{...register('location')}
							/>
						</div>
						<div className="flex items-center gap-3">
							<Switch
								id="isRemote"
								checked={isRemote}
								onCheckedChange={(v) => setValue('isRemote', v)}
							/>
							<Label htmlFor="isRemote" className="cursor-pointer">
								Remote / virtual
							</Label>
						</div>
					</div>

					{/* Date range */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="startDate">
								Start date{' '}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input id="startDate" type="date" {...register('startDate')} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="endDate">
								End date{' '}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input id="endDate" type="date" {...register('endDate')} />
						</div>
					</div>

					{/* Commitment + Capacity */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="commitmentHours">
								Hours/week{' '}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input
								id="commitmentHours"
								type="number"
								min={0.5}
								step={0.5}
								placeholder="e.g. 4"
								{...register('commitmentHours', { valueAsNumber: true })}
							/>
							{errors.commitmentHours?.message && (
								<p className="text-sm text-destructive">
									{errors.commitmentHours.message}
								</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="capacity">
								Max volunteers{' '}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Input
								id="capacity"
								type="number"
								min={1}
								placeholder="e.g. 10"
								{...register('capacity', { valueAsNumber: true })}
							/>
							{errors.capacity?.message && (
								<p className="text-sm text-destructive">
									{errors.capacity.message}
								</p>
							)}
						</div>
					</div>

					{/* Tags */}
					<div className="space-y-2">
						<Label>
							Tags{' '}
							<span className="text-muted-foreground">
								(optional, up to 10)
							</span>
						</Label>
						<TagInput tags={tags} onChange={setTags} />
						<p className="text-xs text-muted-foreground">
							Press Enter or comma to add a tag.
						</p>
					</div>

					{/* Requirements */}
					<div className="space-y-2">
						<Label>
							Requirements{' '}
							<span className="text-muted-foreground">
								(optional, up to 20)
							</span>
						</Label>
						<RequirementInput
							requirements={requirements}
							onChange={setRequirements}
						/>
						<p className="text-xs text-muted-foreground">
							Press Enter or comma to add a skill. Click the badge to toggle
							Required / Preferred.
						</p>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? 'Saving…'
								: isEdit
									? 'Save changes'
									: 'Create opportunity'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
