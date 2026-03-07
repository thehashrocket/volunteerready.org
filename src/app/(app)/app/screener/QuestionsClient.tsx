'use client';

import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc/client';
import { QuestionDialog } from './QuestionDialog';

type Question = {
	id: string;
	prompt: string;
	type: string;
	isActive: boolean;
	order: number;
	configJson: unknown;
};

const TYPE_LABELS: Record<string, string> = {
	BOOLEAN: 'Yes/No',
	TEXT: 'Text',
	SINGLE_CHOICE: 'Single choice',
	MULTI_CHOICE: 'Multi choice',
	NUMBER: 'Number',
};

const TYPE_CLASSES: Record<string, string> = {
	BOOLEAN: 'border-blue-200 text-blue-700 bg-blue-50',
	TEXT: 'border-zinc-200 text-zinc-600 bg-zinc-50',
	SINGLE_CHOICE: 'border-purple-200 text-purple-700 bg-purple-50',
	MULTI_CHOICE: 'border-orange-200 text-orange-700 bg-orange-50',
	NUMBER: 'border-green-200 text-green-700 bg-green-50',
};

export function QuestionsClient() {
	const questionsQ = trpc.screener.listQuestions.useQuery();
	const questions: Question[] = questionsQ.data ?? [];

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

	const activeMutation = trpc.screener.setQuestionActive.useMutation({
		onSuccess: () => {
			void questionsQ.refetch();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to update question.');
		},
	});

	const moveMutation = trpc.screener.moveQuestion.useMutation({
		onSuccess: () => {
			void questionsQ.refetch();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to reorder question.');
		},
	});

	const deleteMutation = trpc.screener.deleteQuestion.useMutation({
		onSuccess: () => {
			toast.success('Question deleted.');
			void questionsQ.refetch();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to delete question.');
		},
	});

	function openCreate() {
		setEditingQuestion(null);
		setDialogOpen(true);
	}

	function openEdit(q: Question) {
		setEditingQuestion(q);
		setDialogOpen(true);
	}

	function handleDelete(q: Question) {
		if (!confirm(`Delete "${q.prompt}"? This cannot be undone.`)) return;
		deleteMutation.mutate({ id: q.id });
	}

	const isPending =
		activeMutation.isPending ||
		moveMutation.isPending ||
		deleteMutation.isPending;

	if (questionsQ.isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
				))}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{questions.length === 0
						? 'No questions yet. Add your first question below.'
						: `${questions.length} question${questions.length !== 1 ? 's' : ''}`}
				</p>
				<Button size="sm" onClick={openCreate}>
					<Plus className="mr-2 h-4 w-4" />
					Add question
				</Button>
			</div>

			{questions.length > 0 && (
				<div className="space-y-2">
					{questions.map((q, index) => (
						<Card key={q.id} className={q.isActive ? '' : 'opacity-60'}>
							<CardContent className="flex items-center gap-3 py-3 px-4">
								{/* Order number */}
								<span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
									{index + 1}
								</span>

								{/* Type badge */}
								<Badge
									variant="outline"
									className={`shrink-0 text-xs font-normal ${TYPE_CLASSES[q.type] ?? ''}`}
								>
									{TYPE_LABELS[q.type] ?? q.type}
								</Badge>

								{/* Prompt */}
								<p className="min-w-0 flex-1 truncate text-sm">{q.prompt}</p>

								{/* Active toggle */}
								<Switch
									checked={q.isActive}
									disabled={isPending}
									onCheckedChange={(checked) =>
										activeMutation.mutate({
											id: q.id,
											isActive: checked,
										})
									}
									aria-label={
										q.isActive ? 'Deactivate question' : 'Activate question'
									}
								/>

								{/* Reorder */}
								<div className="flex flex-col">
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5"
										disabled={index === 0 || isPending}
										onClick={() =>
											moveMutation.mutate({
												id: q.id,
												direction: 'up',
											})
										}
										aria-label="Move up"
									>
										<ChevronUp className="h-3 w-3" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5"
										disabled={index === questions.length - 1 || isPending}
										onClick={() =>
											moveMutation.mutate({
												id: q.id,
												direction: 'down',
											})
										}
										aria-label="Move down"
									>
										<ChevronDown className="h-3 w-3" />
									</Button>
								</div>

								{/* Edit */}
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0"
									disabled={isPending}
									onClick={() => openEdit(q)}
									aria-label="Edit question"
								>
									<Pencil className="h-4 w-4" />
								</Button>

								{/* Delete */}
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
									disabled={isPending}
									onClick={() => handleDelete(q)}
									aria-label="Delete question"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<QuestionDialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) setEditingQuestion(null);
				}}
				question={editingQuestion}
				onSaved={() => {
					void questionsQ.refetch();
				}}
			/>
		</div>
	);
}
