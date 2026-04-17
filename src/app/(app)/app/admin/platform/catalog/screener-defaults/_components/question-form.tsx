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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc/client';

const TYPE_OPTIONS = [
	{ value: 'BOOLEAN', label: 'Yes / No' },
	{ value: 'TEXT', label: 'Text' },
	{ value: 'NUMBER', label: 'Number' },
	{ value: 'SINGLE_CHOICE', label: 'Single choice' },
	{ value: 'MULTI_CHOICE', label: 'Multi choice' },
] as const;

type QuestionType = (typeof TYPE_OPTIONS)[number]['value'];

type QuestionFormValues = {
	id?: string;
	key: string;
	prompt: string;
	type: QuestionType;
	order: number;
	configJsonText: string;
	isActive: boolean;
};

const DEFAULT_CONFIG = JSON.stringify({ required: true }, null, 2);

export function DefaultQuestionFormDialog({
	open,
	onOpenChange,
	initial,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initial?: Omit<QuestionFormValues, 'configJsonText'> & {
		configJson: Record<string, unknown>;
	};
}) {
	const utils = trpc.useUtils();
	const [values, setValues] = useState<QuestionFormValues>({
		key: '',
		prompt: '',
		type: 'BOOLEAN',
		order: 0,
		configJsonText: DEFAULT_CONFIG,
		isActive: true,
	});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			if (initial) {
				setValues({
					id: initial.id,
					key: initial.key,
					prompt: initial.prompt,
					type: initial.type,
					order: initial.order,
					isActive: initial.isActive,
					configJsonText: JSON.stringify(initial.configJson, null, 2),
				});
			} else {
				setValues({
					key: '',
					prompt: '',
					type: 'BOOLEAN',
					order: 0,
					configJsonText: DEFAULT_CONFIG,
					isActive: true,
				});
			}
			setError(null);
		}
	}, [open, initial]);

	const createMutation = trpc.platformCatalog.createDefaultQuestion.useMutation(
		{
			onSuccess: () => {
				utils.platformCatalog.getDefaultQuestions.invalidate();
				onOpenChange(false);
			},
			onError: (err) => setError(err.message),
		},
	);
	const updateMutation = trpc.platformCatalog.updateDefaultQuestion.useMutation(
		{
			onSuccess: () => {
				utils.platformCatalog.getDefaultQuestions.invalidate();
				onOpenChange(false);
			},
			onError: (err) => setError(err.message),
		},
	);

	const editing = Boolean(initial?.id);
	const pending = createMutation.isPending || updateMutation.isPending;

	async function handleSubmit() {
		setError(null);
		let configJson: Record<string, unknown>;
		try {
			const parsed = JSON.parse(values.configJsonText);
			if (
				parsed === null ||
				typeof parsed !== 'object' ||
				Array.isArray(parsed)
			) {
				throw new Error('configJson must be a JSON object.');
			}
			configJson = parsed as Record<string, unknown>;
		} catch (err) {
			setError(
				err instanceof Error
					? `Invalid configJson: ${err.message}`
					: 'Invalid configJson.',
			);
			return;
		}

		if (editing && initial?.id) {
			await updateMutation.mutateAsync({
				id: initial.id,
				prompt: values.prompt.trim(),
				type: values.type,
				order: values.order,
				configJson,
				isActive: values.isActive,
			});
		} else {
			await createMutation.mutateAsync({
				key: values.key.trim(),
				prompt: values.prompt.trim(),
				type: values.type,
				order: values.order,
				configJson,
			});
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{editing ? 'Edit default question' : 'Add default question'}
					</DialogTitle>
					<DialogDescription>
						Default questions are copied into each new org's screener. Edits
						don't affect existing orgs.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-2">
					<div className="grid gap-1.5">
						<Label htmlFor="q-key">Key</Label>
						<Input
							id="q-key"
							value={values.key}
							onChange={(e) =>
								setValues((v) => ({ ...v, key: e.target.value }))
							}
							disabled={editing}
							placeholder="age-18-plus"
						/>
						{editing && (
							<p className="text-xs text-muted-foreground">
								Keys are immutable after creation.
							</p>
						)}
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="q-prompt">Prompt</Label>
						<Textarea
							id="q-prompt"
							value={values.prompt}
							onChange={(e) =>
								setValues((v) => ({ ...v, prompt: e.target.value }))
							}
							rows={2}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-1.5">
							<Label htmlFor="q-type">Type</Label>
							<Select
								value={values.type}
								onValueChange={(v) =>
									setValues((cur) => ({ ...cur, type: v as QuestionType }))
								}
							>
								<SelectTrigger id="q-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TYPE_OPTIONS.map((t) => (
										<SelectItem key={t.value} value={t.value}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="q-order">Order</Label>
							<Input
								id="q-order"
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
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="q-config">configJson</Label>
						<Textarea
							id="q-config"
							value={values.configJsonText}
							onChange={(e) =>
								setValues((v) => ({ ...v, configJsonText: e.target.value }))
							}
							rows={8}
							className="font-mono text-xs"
						/>
						<p className="text-xs text-muted-foreground">
							JSON object. Typical keys: <code>required</code>,{' '}
							<code>options</code>, <code>rules</code>, <code>maxLength</code>.
						</p>
					</div>
					{editing && (
						<div className="flex items-center justify-between rounded-md border p-3">
							<div>
								<Label>Active</Label>
								<p className="text-xs text-muted-foreground">
									Inactive templates are not copied into new orgs.
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
							values.prompt.trim().length === 0 ||
							(!editing && values.key.trim().length === 0)
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
