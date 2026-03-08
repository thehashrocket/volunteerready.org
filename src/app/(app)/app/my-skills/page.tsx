'use client';

import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Skill chip-input (reuses the pattern from OpportunityDialog TagInput)
// ---------------------------------------------------------------------------

function SkillInput({
	skills,
	onChange,
}: {
	skills: string[];
	onChange: (skills: string[]) => void;
}) {
	const [input, setInput] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	function addSkill(value: string) {
		const trimmed = value.trim().replace(/,+$/, '');
		if (!trimmed) return;
		// Deduplicate case-insensitively
		if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
		if (skills.length >= 50) return;
		onChange([...skills, trimmed]);
		setInput('');
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addSkill(input);
		} else if (e.key === 'Backspace' && !input && skills.length > 0) {
			onChange(skills.slice(0, -1));
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus wrapper for chip input
		<div
			className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text"
			onClick={() => inputRef.current?.focus()}
			onKeyDown={() => inputRef.current?.focus()}
		>
			{skills.map((skill) => (
				<span
					key={skill}
					className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
				>
					{skill}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onChange(skills.filter((s) => s !== skill));
						}}
						className="text-primary/60 hover:text-primary"
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
						addSkill(val);
					} else {
						setInput(val);
					}
				}}
				onKeyDown={handleKeyDown}
				onBlur={() => addSkill(input)}
				placeholder={skills.length === 0 ? 'Type a skill and press Enter…' : ''}
				className="flex-1 min-w-[8rem] bg-transparent outline-none placeholder:text-muted-foreground"
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MySkillsPage() {
	const qc = useQueryClient();

	const query = trpc.matching.getMySkills.useQuery();
	const [localSkills, setLocalSkills] = useState<string[] | null>(null);

	// Sync server data into local state once loaded
	const skills = localSkills ?? query.data ?? [];
	const isDirty =
		localSkills !== null &&
		JSON.stringify(localSkills) !== JSON.stringify(query.data ?? []);

	const mutation = trpc.matching.updateMySkills.useMutation({
		onSuccess: async () => {
			toast.success('Skills saved.');
			await qc.invalidateQueries();
			setLocalSkills(null);
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to save skills.');
		},
	});

	function handleSave() {
		if (!localSkills) return;
		mutation.mutate({ skills: localSkills });
	}

	function handleReset() {
		setLocalSkills(null);
	}

	if (query.isLoading) {
		return (
			<div className="mx-auto max-w-xl space-y-8">
				<PageHeader
					title="My Skills"
					description="Add skills to get matched with volunteer opportunities."
				/>
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground">
						Loading your skills…
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="mx-auto max-w-xl space-y-8">
				<PageHeader
					title="My Skills"
					description="Add skills to get matched with volunteer opportunities."
				/>
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<p className="text-sm text-destructive">{query.error.message}</p>
						<Button variant="outline" onClick={() => query.refetch()}>
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-xl space-y-8">
			<PageHeader
				title="My Skills"
				description="Add skills to get matched with volunteer opportunities."
			/>

			<Card>
				<CardHeader>
					<CardTitle>Skills</CardTitle>
					<CardDescription>
						Type a skill and press Enter or comma to add it. These are matched
						against opportunity requirements to show you the best fits.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<SkillInput
						skills={skills}
						onChange={(next) => setLocalSkills(next)}
					/>

					<p className="text-xs text-muted-foreground">
						{skills.length}/50 skills
					</p>

					<div className="flex items-center gap-2">
						<Button
							onClick={handleSave}
							disabled={!isDirty || mutation.isPending}
						>
							{mutation.isPending ? 'Saving…' : 'Save skills'}
						</Button>
						{isDirty && (
							<Button variant="ghost" onClick={handleReset}>
								Reset
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
