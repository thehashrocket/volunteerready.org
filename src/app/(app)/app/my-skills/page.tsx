'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Skill combobox
// ---------------------------------------------------------------------------

interface SkillOption {
	id: string;
	name: string;
	familyId: string;
	familyName: string;
}

function SkillCombobox({
	selectedIds,
	options,
	onToggle,
}: {
	selectedIds: Set<string>;
	options: SkillOption[];
	onToggle: (id: string) => void;
}) {
	const [open, setOpen] = useState(false);

	// Group options by family for display
	const families = new Map<string, { name: string; skills: SkillOption[] }>();
	for (const opt of options) {
		if (!families.has(opt.familyId)) {
			families.set(opt.familyId, { name: opt.familyName, skills: [] });
		}
		families.get(opt.familyId)!.skills.push(opt);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between text-muted-foreground"
				>
					Add a skill…
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="start">
				<Command>
					<CommandInput placeholder="Search skills…" />
					<CommandList>
						<CommandEmpty>No skills found.</CommandEmpty>
						{[...families.entries()].map(([familyId, family]) => (
							<CommandGroup key={familyId} heading={family.name}>
								{family.skills.map((skill) => (
									<CommandItem
										key={skill.id}
										value={`${skill.familyName} ${skill.name}`}
										onSelect={() => {
											onToggle(skill.id);
										}}
									>
										<Check
											className={cn(
												'mr-2 h-4 w-4',
												selectedIds.has(skill.id)
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
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MySkillsPage() {
	const qc = useQueryClient();

	const catalogQuery = trpc.matching.getSkillCatalog.useQuery();
	const mySkillsQuery = trpc.matching.getMySkills.useQuery();

	// Local state: null = unedited (use server data), otherwise user's working set
	const [localIds, setLocalIds] = useState<string[] | null>(null);

	const isLoading = catalogQuery.isLoading || mySkillsQuery.isLoading;
	const isError = catalogQuery.isError || mySkillsQuery.isError;

	// Flatten catalog into skill options for the combobox
	const options: SkillOption[] = (catalogQuery.data ?? []).flatMap((family) =>
		family.skills.map((s) => ({
			id: s.id,
			name: s.name,
			familyId: family.id,
			familyName: family.name,
		})),
	);
	const optionMap = new Map(options.map((o) => [o.id, o]));

	// Current selected IDs (local override or server)
	const serverIds = (mySkillsQuery.data ?? []).map((s) => s.skillId);
	const currentIds = localIds ?? serverIds;
	const selectedSet = new Set(currentIds);

	const isDirty =
		localIds !== null &&
		JSON.stringify([...localIds].sort()) !== JSON.stringify([...serverIds].sort());

	const mutation = trpc.matching.updateMySkills.useMutation({
		onSuccess: async () => {
			toast.success('Skills saved.');
			await qc.invalidateQueries();
			setLocalIds(null);
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to save skills.');
		},
	});

	function toggleSkill(skillId: string) {
		const next = new Set(currentIds);
		if (next.has(skillId)) {
			next.delete(skillId);
		} else {
			if (next.size >= 50) {
				toast.error('Maximum 50 skills.');
				return;
			}
			next.add(skillId);
		}
		setLocalIds([...next]);
	}

	function removeSkill(skillId: string) {
		setLocalIds(currentIds.filter((id) => id !== skillId));
	}

	function handleSave() {
		if (!localIds) return;
		mutation.mutate({ skillIds: localIds });
	}

	if (isLoading) {
		return (
			<div className="mx-auto max-w-xl space-y-6">
				<PageHeader
					title="My Skills"
					description="Select skills to get matched with volunteer opportunities."
				/>
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="mx-auto max-w-xl space-y-6">
				<PageHeader
					title="My Skills"
					description="Select skills to get matched with volunteer opportunities."
				/>
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<p className="text-sm text-destructive">Failed to load skills.</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								void catalogQuery.refetch();
								void mySkillsQuery.refetch();
							}}
						>
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-xl space-y-6">
			<PageHeader
				title="My Skills"
				description="Select skills to get matched with volunteer opportunities."
			/>

			<Card>
				<CardHeader>
					<CardTitle>Skills</CardTitle>
					<CardDescription>
						Search and select skills from the catalog. These are matched against
						opportunity requirements to show you the best fits.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<SkillCombobox
						selectedIds={selectedSet}
						options={options}
						onToggle={toggleSkill}
					/>

					{currentIds.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{currentIds.map((id) => {
								const opt = optionMap.get(id);
								if (!opt) return null;
								return (
									<Badge
										key={id}
										variant="secondary"
										className="flex items-center gap-1 pr-1"
									>
										<span>{opt.name}</span>
										<span className="text-muted-foreground">·</span>
										<span className="text-muted-foreground text-xs">
											{opt.familyName}
										</span>
										<button
											type="button"
											onClick={() => removeSkill(id)}
											className="ml-1 rounded-full text-muted-foreground hover:text-foreground"
										>
											<X className="h-3 w-3" />
										</button>
									</Badge>
								);
							})}
						</div>
					)}

					<p className="text-xs text-muted-foreground">
						{currentIds.length}/50 skills
					</p>

					<div className="flex items-center gap-2">
						<Button
							onClick={handleSave}
							disabled={!isDirty || mutation.isPending}
						>
							{mutation.isPending ? 'Saving…' : 'Save skills'}
						</Button>
						{isDirty && (
							<Button variant="ghost" onClick={() => setLocalIds(null)}>
								Reset
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
