'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Question = {
	id: string;
	prompt: string;
	type: string;
	configJson: unknown;
};

interface QuestionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	question?: Question | null;
	onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// maxLength uses valueAsNumber:true on the <input>, so RHF stores number|NaN|undefined.
// The z.nan() branch converts NaN (empty input) to undefined; the input/output types
// are both `number | undefined`, which avoids the z.preprocess `unknown` problem.
const schema = z.object({
	prompt: z.string().min(5, 'At least 5 characters').max(500).trim(),
	type: z.string().optional(),
	required: z.boolean(),
	maxLength: z
		.union([
			z.number().int().min(1, 'Must be at least 1'),
			z.nan().transform((): undefined => undefined),
		])
		.optional(),
	options: z
		.array(z.object({ value: z.string().min(1, 'Option cannot be empty') }))
		.optional(),
	disqualifyIfFalse: z.boolean().optional(),
	disqualifierReason: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseConfig(configJson: unknown): {
	required: boolean;
	maxLength?: number;
	options?: string[];
	disqualifyIfFalse?: boolean;
	disqualifierReason?: string;
} {
	if (!configJson || typeof configJson !== 'object') {
		return { required: true };
	}
	const c = configJson as Record<string, unknown>;
	const rules =
		c.rules && typeof c.rules === 'object'
			? (c.rules as Record<string, unknown>)
			: null;

	return {
		required: typeof c.required === 'boolean' ? c.required : true,
		maxLength: typeof c.maxLength === 'number' ? c.maxLength : undefined,
		options: Array.isArray(c.options) ? (c.options as string[]) : undefined,
		disqualifyIfFalse: Boolean(rules?.disqualifierRule),
		disqualifierReason:
			typeof rules?.reason === 'string' ? rules.reason : undefined,
	};
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestionDialog({
	open,
	onOpenChange,
	question,
	onSaved,
}: QuestionDialogProps) {
	const qc = useQueryClient();
	const isEdit = Boolean(question);
	const questionType = question?.type ?? '';

	const parsed = question ? parseConfig(question.configJson) : null;

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		control,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			prompt: '',
			type: 'BOOLEAN',
			required: true,
			disqualifyIfFalse: false,
			disqualifierReason: '',
			options: [{ value: '' }, { value: '' }],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: 'options',
	});

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			if (question && parsed) {
				reset({
					prompt: question.prompt,
					type: question.type,
					required: parsed.required,
					maxLength: parsed.maxLength,
					options:
						parsed.options && parsed.options.length > 0
							? parsed.options.map((v) => ({ value: v }))
							: [{ value: '' }, { value: '' }],
					disqualifyIfFalse: parsed.disqualifyIfFalse ?? false,
					disqualifierReason: parsed.disqualifierReason ?? '',
				});
			} else {
				reset({
					prompt: '',
					type: 'BOOLEAN',
					required: true,
					maxLength: undefined,
					options: [{ value: '' }, { value: '' }],
					disqualifyIfFalse: false,
					disqualifierReason: '',
				});
			}
		}
	}, [open, question]); // eslint-disable-line react-hooks/exhaustive-deps

	const selectedType = isEdit ? questionType : (watch('type') ?? 'BOOLEAN');
	const disqualifyIfFalse = watch('disqualifyIfFalse') ?? false;
	const required = watch('required') ?? true;

	const createMutation = trpc.screener.createQuestion.useMutation({
		onSuccess: async () => {
			toast.success('Question created.');
			await qc.invalidateQueries();
			onSaved();
			onOpenChange(false);
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to create question.');
		},
	});

	const updateMutation = trpc.screener.updateQuestion.useMutation({
		onSuccess: async () => {
			toast.success('Question updated.');
			await qc.invalidateQueries();
			onSaved();
			onOpenChange(false);
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to update question.');
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function onSubmit(values: FormValues) {
		const options =
			values.options?.map((o) => o.value.trim()).filter(Boolean) ?? [];

		if (isEdit && question) {
			updateMutation.mutate({
				id: question.id,
				prompt: values.prompt,
				required: values.required,
				...(selectedType === 'TEXT' && values.maxLength !== undefined
					? { maxLength: values.maxLength }
					: {}),
				...(selectedType === 'SINGLE_CHOICE' && options.length >= 2
					? { options }
					: {}),
				...(selectedType === 'BOOLEAN'
					? {
							disqualifyIfFalse: values.disqualifyIfFalse ?? false,
							disqualifierReason: values.disqualifierReason,
						}
					: {}),
			});
		} else {
			createMutation.mutate({
				prompt: values.prompt,
				type: values.type as
					| 'TEXT'
					| 'BOOLEAN'
					| 'SINGLE_CHOICE'
					| 'MULTI_CHOICE'
					| 'NUMBER',
				required: values.required,
				...(selectedType === 'TEXT' && values.maxLength !== undefined
					? { maxLength: values.maxLength }
					: {}),
				...(selectedType === 'SINGLE_CHOICE' && options.length >= 2
					? { options }
					: {}),
				...(selectedType === 'BOOLEAN'
					? {
							disqualifyIfFalse: values.disqualifyIfFalse ?? false,
							disqualifierReason: values.disqualifierReason,
						}
					: {}),
			});
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? 'Edit question' : 'Add question'}
					</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit(onSubmit)}
					className="space-y-5 pt-2"
				>
					{/* Prompt */}
					<div className="space-y-2">
						<Label htmlFor="prompt">Question text</Label>
						<Textarea
							id="prompt"
							rows={2}
							placeholder="e.g. Are you 18 years or older?"
							{...register('prompt')}
						/>
						{errors.prompt?.message && (
							<p className="text-sm text-destructive">
								{errors.prompt.message}
							</p>
						)}
					</div>

					{/* Type — create only */}
					{!isEdit && (
						<div className="space-y-2">
							<Label htmlFor="type">Question type</Label>
							<Select
								value={watch('type') ?? 'BOOLEAN'}
								onValueChange={(v) =>
									setValue('type', v, {
										shouldValidate: true,
									})
								}
							>
								<SelectTrigger id="type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="BOOLEAN">
										Yes / No
									</SelectItem>
									<SelectItem value="TEXT">
										Text answer
									</SelectItem>
									<SelectItem value="SINGLE_CHOICE">
										Single choice
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Required toggle */}
					<div className="flex items-center gap-3">
						<Switch
							id="required"
							checked={required}
							onCheckedChange={(v) =>
								setValue('required', v, { shouldValidate: true })
							}
						/>
						<Label htmlFor="required" className="cursor-pointer">
							Required
						</Label>
					</div>

					{/* TEXT — max length */}
					{selectedType === 'TEXT' && (
						<div className="space-y-2">
							<Label htmlFor="maxLength">
								Max length{' '}
								<span className="text-muted-foreground">
									(optional)
								</span>
							</Label>
							<Input
								id="maxLength"
								type="number"
								min={1}
								max={5000}
								placeholder="e.g. 400"
								{...register('maxLength', {
									valueAsNumber: true,
								})}
							/>
							{errors.maxLength?.message && (
								<p className="text-sm text-destructive">
									{errors.maxLength.message}
								</p>
							)}
						</div>
					)}

					{/* SINGLE_CHOICE — options */}
					{selectedType === 'SINGLE_CHOICE' && (
						<div className="space-y-2">
							<Label>Answer options</Label>
							<div className="space-y-2">
								{fields.map((field, idx) => (
									<div
										key={field.id}
										className="flex items-center gap-2"
									>
										<Input
											placeholder={`Option ${idx + 1}`}
											{...register(
												`options.${idx}.value`,
											)}
											className="flex-1"
										/>
										{fields.length > 2 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
												onClick={() => remove(idx)}
											>
												<X className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
								{errors.options && (
									<p className="text-sm text-destructive">
										At least 2 options required.
									</p>
								)}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => append({ value: '' })}
								>
									<Plus className="mr-2 h-3 w-3" />
									Add option
								</Button>
							</div>
						</div>
					)}

					{/* BOOLEAN — disqualifier */}
					{selectedType === 'BOOLEAN' && (
						<div className="space-y-3 rounded-lg border p-4">
							<div className="flex items-center gap-3">
								<Switch
									id="disqualifyIfFalse"
									checked={disqualifyIfFalse}
									onCheckedChange={(v) =>
										setValue('disqualifyIfFalse', v)
									}
								/>
								<Label
									htmlFor="disqualifyIfFalse"
									className="cursor-pointer"
								>
									Disqualify volunteers who answer{' '}
									<span className="font-medium">No</span>
								</Label>
							</div>
							{disqualifyIfFalse && (
								<div className="space-y-2">
									<Label htmlFor="disqualifierReason">
										Disqualification reason{' '}
										<span className="text-muted-foreground">
											(shown in screening report)
										</span>
									</Label>
									<Input
										id="disqualifierReason"
										placeholder="e.g. Must be 18 or older."
										{...register('disqualifierReason')}
									/>
								</div>
							)}
						</div>
					)}

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
									: 'Add question'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
