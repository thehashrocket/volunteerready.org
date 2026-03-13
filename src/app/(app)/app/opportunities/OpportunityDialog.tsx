'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Local state representation of a single requirement. */
type Requirement = {
	/** 'skill' = specific skill, 'family' = any skill in a family */
	type: 'skill' | 'family';
	/** skillId or familyId depending on type */
	refId: string;
	/** Display name */
	name: string;
	/** Parent family name (for skill-type requirements) */
	familyName?: string;
	level: 'REQUIRED' | 'PREFERRED';
};

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
		skillId: string | null;
		familyId: string | null;
		level: 'REQUIRED' | 'PREFERRED';
		skill: { id: string; name: string } | null;
		family: { id: string; name: string; skills: { id: string }[] } | null;
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
	return `${dateStr}T12:00:00.000Z`;
}

function requirementFromRow(r: Opportunity['requirements'][0]): Requirement {
	if (r.skillId && r.skill) {
		return {
			type: 'skill',
			refId: r.skillId,
			name: r.skill.name,
			familyName: undefined, // unknown without catalog — filled in via catalog lookup
			level: r.level,
		};
	}
	if (r.familyId && r.family) {
		return {
			type: 'family',
			refId: r.familyId,
			name: r.family.name,
			level: r.level,
		};
	}
	return { type: 'skill', refId: '', name: '(unknown)', level: r.level };
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
// Requirement picker
// ---------------------------------------------------------------------------

interface CatalogFamily {
	id: string;
	name: string;
	skills: { id: string; name: string }[];
}

function RequirementPicker({
	requirements,
	catalog,
	onChange,
}: {
	requirements: Requirement[];
	catalog: CatalogFamily[];
	onChange: (requirements: Requirement[]) => void;
}) {
	const [open, setOpen] = useState(false);

	const selectedKeys = new Set(requirements.map((r) => `${r.type}:${r.refId}`));

	function toggleItem(key: string, item: Requirement) {
		if (selectedKeys.has(key)) {
			onChange(requirements.filter((r) => `${r.type}:${r.refId}` !== key));
		} else {
			if (requirements.length >= 20) {
				toast.error('Maximum 20 requirements.');
				return;
			}
			onChange([...requirements, item]);
		}
	}

	function toggleLevel(idx: number) {
		const next = [...requirements];
		next[idx] = {
			...next[idx],
			level: next[idx].level === 'REQUIRED' ? 'PREFERRED' : 'REQUIRED',
		};
		onChange(next);
	}

	function remove(idx: number) {
		onChange(requirements.filter((_, i) => i !== idx));
	}

	return (
		<div className="space-y-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between text-muted-foreground"
					>
						Add a skill or family requirement…
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[420px] p-0" align="start">
					<Command>
						<CommandInput placeholder="Search skills or families…" />
						<CommandList>
							<CommandEmpty>No matches found.</CommandEmpty>
							{catalog.map((family) => (
								<CommandGroup key={family.id} heading={family.name}>
									{/* Family-level requirement */}
									<CommandItem
										value={`any ${family.name}`}
										onSelect={() => {
											const key = `family:${family.id}`;
											toggleItem(key, {
												type: 'family',
												refId: family.id,
												name: family.name,
												level: 'REQUIRED',
											});
										}}
									>
										<Check
											className={cn(
												'mr-2 h-4 w-4',
												selectedKeys.has(`family:${family.id}`)
													? 'opacity-100'
													: 'opacity-0',
											)}
										/>
										<span className="font-medium">Any {family.name} skill</span>
										<span className="ml-auto text-xs text-muted-foreground">
											Family
										</span>
									</CommandItem>
									{/* Individual skills */}
									{family.skills.map((skill) => (
										<CommandItem
											key={skill.id}
											value={`${family.name} ${skill.name}`}
											onSelect={() => {
												const key = `skill:${skill.id}`;
												toggleItem(key, {
													type: 'skill',
													refId: skill.id,
													name: skill.name,
													familyName: family.name,
													level: 'REQUIRED',
												});
											}}
										>
											<Check
												className={cn(
													'mr-2 h-4 w-4',
													selectedKeys.has(`skill:${skill.id}`)
														? 'opacity-100'
														: 'opacity-0',
												)}
											/>
											{skill.name}
										</CommandItem>
									))}
								</CommandGroup>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{requirements.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{requirements.map((req, idx) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: stable order while editing
							key={idx}
							className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
						>
							{req.type === 'family' ? (
								<>
									<span className="text-muted-foreground">Any</span> {req.name}
								</>
							) : (
								<>
									{req.name}
									{req.familyName && (
										<span className="text-muted-foreground">
											· {req.familyName}
										</span>
									)}
								</>
							)}
							<button
								type="button"
								onClick={() => toggleLevel(idx)}
								className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
									req.level === 'REQUIRED'
										? 'bg-foreground text-background hover:bg-foreground/90'
										: 'bg-muted text-muted-foreground hover:bg-muted/80'
								}`}
							>
								{req.level === 'REQUIRED' ? 'Required' : 'Preferred'}
							</button>
							<button
								type="button"
								onClick={() => remove(idx)}
								className="text-muted-foreground hover:text-foreground"
							>
								<X className="h-3 w-3" />
							</button>
						</span>
					))}
				</div>
			)}
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

	const catalogQuery = trpc.matching.getSkillCatalog.useQuery();

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

				// Convert API requirements to local state
				const reqs = opportunity.requirements.map(requirementFromRow);
				// Enrich skill requirements with familyName from catalog if available
				if (catalogQuery.data) {
					const skillToFamily = new Map<string, string>();
					for (const family of catalogQuery.data) {
						for (const skill of family.skills) {
							skillToFamily.set(skill.id, family.name);
						}
					}
					for (const req of reqs) {
						if (req.type === 'skill' && !req.familyName) {
							req.familyName = skillToFamily.get(req.refId);
						}
					}
				}
				setRequirements(reqs);
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
	}, [open, opportunity, reset, catalogQuery.data]);

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
		const apiRequirements = requirements
			.filter((r) => r.refId)
			.map((r) =>
				r.type === 'skill'
					? ({
							skillId: r.refId,
							familyId: undefined,
							level: r.level as 'REQUIRED' | 'PREFERRED',
						} as const)
					: ({
							familyId: r.refId,
							skillId: undefined,
							level: r.level as 'REQUIRED' | 'PREFERRED',
						} as const),
			);

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
			requirements: apiRequirements,
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
						<RequirementPicker
							requirements={requirements}
							catalog={catalogQuery.data ?? []}
							onChange={setRequirements}
						/>
						<p className="text-xs text-muted-foreground">
							Select specific skills or entire skill families. Click the badge
							to toggle Required / Preferred.
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
