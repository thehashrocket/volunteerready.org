'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc/client';

type FamilyFormValues = {
	id?: string;
	name: string;
	slug: string;
	order: number;
	isActive: boolean;
};

export function SkillFamilyFormDialog({
	open,
	onOpenChange,
	initial,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: FamilyFormValues;
}) {
	const utils = trpc.useUtils();
	const [values, setValues] = useState<FamilyFormValues>({
		name: '',
		slug: '',
		order: 0,
		isActive: true,
	});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setValues(initial ?? { name: '', slug: '', order: 0, isActive: true });
			setError(null);
		}
	}, [open, initial]);

	const createMutation = trpc.platformCatalog.createFamily.useMutation({
		onSuccess: () => {
			utils.platformCatalog.getCatalog.invalidate();
			onOpenChange(false);
		},
		onError: (err) => setError(err.message),
	});
	const updateMutation = trpc.platformCatalog.updateFamily.useMutation({
		onSuccess: () => {
			utils.platformCatalog.getCatalog.invalidate();
			onOpenChange(false);
		},
		onError: (err) => setError(err.message),
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
				order: values.order,
				isActive: values.isActive,
			});
		} else {
			await createMutation.mutateAsync({
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
					<DialogTitle>
						{editing ? 'Edit skill family' : 'Add skill family'}
					</DialogTitle>
					<DialogDescription>
						Families group related skills. Slug is the stable identifier
						(kebab-case).
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<div className="grid gap-1.5">
						<Label htmlFor="family-name">Name</Label>
						<Input
							id="family-name"
							value={values.name}
							onChange={(e) =>
								setValues((v) => ({ ...v, name: e.target.value }))
							}
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="family-slug">Slug</Label>
						<Input
							id="family-slug"
							value={values.slug}
							onChange={(e) =>
								setValues((v) => ({ ...v, slug: e.target.value }))
							}
							placeholder="animal-care"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="family-order">Order</Label>
						<Input
							id="family-order"
							type="number"
							value={values.order}
							onChange={(e) =>
								setValues((v) => ({
									...v,
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
									Inactive families are hidden from skill pickers.
								</p>
							</div>
							<Switch
								checked={values.isActive}
								onCheckedChange={(checked) =>
									setValues((v) => ({ ...v, isActive: checked }))
								}
							/>
						</div>
					)}
					{error && <p className="text-sm text-destructive">{error}</p>}
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
