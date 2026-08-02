'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc/client';

type SkillFormValues = {
	id?: string;
	name: string;
	slug: string;
	familyId: string;
	order: number;
	isActive: boolean;
};

type FamilyOption = { id: string; name: string };

export function SkillFormDialog({
	open,
	onOpenChange,
	initial,
	families,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: SkillFormValues;
	families: FamilyOption[];
}) {
	const utils = trpc.useUtils();
	const [values, setValues] = useState<SkillFormValues>({
		name: '',
		slug: '',
		familyId: families[0]?.id ?? '',
		order: 0,
		isActive: true,
	});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setValues(
				initial ?? {
					name: '',
					slug: '',
					familyId: families[0]?.id ?? '',
					order: 0,
					isActive: true,
				},
			);
			setError(null);
		}
	}, [open, initial, families]);

	const createMutation = trpc.platformCatalog.createSkill.useMutation({
		onSuccess: () => {
			utils.platformCatalog.getCatalog.invalidate();
			onOpenChange(false);
		},
		onError: (err) =>
			setError(safeErrorMessage(err) ?? 'Could not save that skill.'),
	});
	const updateMutation = trpc.platformCatalog.updateSkill.useMutation({
		onSuccess: () => {
			utils.platformCatalog.getCatalog.invalidate();
			onOpenChange(false);
		},
		onError: (err) =>
			setError(safeErrorMessage(err) ?? 'Could not save that skill.'),
	});

	const editing = Boolean(initial?.id);
	const pending = createMutation.isPending || updateMutation.isPending;

	async function handleSubmit() {
		setError(null);
		if (editing && initial?.id) {
			await updateMutation.mutateAsync({
				id: initial.id,
				name: values.name.trim(),
				slug: values.slug.trim(),
				familyId: values.familyId,
				order: values.order,
				isActive: values.isActive,
			});
		} else {
			await createMutation.mutateAsync({
				familyId: values.familyId,
				name: values.name.trim(),
				slug: values.slug.trim(),
				order: values.order,
			});
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{editing ? 'Edit skill' : 'Add skill'}</DialogTitle>
					<DialogDescription>
						Skills belong to a family. Slug is the stable identifier and must be
						globally unique.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<div className="grid gap-1.5">
						<Label htmlFor="skill-family">Family</Label>
						<Select
							value={values.familyId}
							onValueChange={(v) =>
								setValues((cur) => ({ ...cur, familyId: v }))
							}
						>
							<SelectTrigger id="skill-family">
								<SelectValue placeholder="Select a family" />
							</SelectTrigger>
							<SelectContent>
								{families.map((f) => (
									<SelectItem key={f.id} value={f.id}>
										{f.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="skill-name">Name</Label>
						<Input
							id="skill-name"
							value={values.name}
							onChange={(e) =>
								setValues((cur) => ({ ...cur, name: e.target.value }))
							}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="skill-slug">Slug</Label>
						<Input
							id="skill-slug"
							value={values.slug}
							onChange={(e) =>
								setValues((cur) => ({ ...cur, slug: e.target.value }))
							}
							placeholder="animal-handling"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="skill-order">Order</Label>
						<Input
							id="skill-order"
							type="number"
							value={values.order}
							onChange={(e) =>
								setValues((cur) => ({
									...cur,
									order: Number(e.target.value) || 0,
								}))
							}
						/>
					</div>
					{editing && (
						<div className="flex items-center justify-between rounded-md border p-3">
							<div>
								<Label>Active</Label>
								<p className="text-xs text-muted-foreground">
									Inactive skills stay referenced by volunteers and
									opportunities but are hidden from pickers.
								</p>
							</div>
							<Switch
								checked={values.isActive}
								onCheckedChange={(checked) =>
									setValues((cur) => ({ ...cur, isActive: checked }))
								}
							/>
						</div>
					)}
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							pending ||
							!values.familyId ||
							values.name.trim().length === 0 ||
							values.slug.trim().length === 0
						}
					>
						{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{editing ? 'Save' : 'Create'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
