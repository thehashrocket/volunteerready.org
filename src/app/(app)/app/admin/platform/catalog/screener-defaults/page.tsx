'use client';

import { Loader2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import { DefaultQuestionFormDialog } from './_components/question-form';

type QuestionType =
	| 'TEXT'
	| 'SINGLE_CHOICE'
	| 'MULTI_CHOICE'
	| 'BOOLEAN'
	| 'NUMBER';

type QuestionRow = {
	id: string;
	key: string;
	prompt: string;
	type: QuestionType;
	order: number;
	isActive: boolean;
	configJson: Record<string, unknown>;
};

export default function PlatformScreenerDefaultsPage() {
	const { data, isLoading, isError } =
		trpc.platformCatalog.getDefaultQuestions.useQuery();

	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<QuestionRow | undefined>();

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<PageHeader
					title="Default screener questions"
					description="Templates copied into every new org's screener. Existing orgs aren't affected."
				/>
				<Button
					onClick={() => {
						setEditing(undefined);
						setOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Question
				</Button>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : isError || !data ? (
				<Card className="p-6 text-sm text-destructive">
					Failed to load defaults.
				</Card>
			) : data.questions.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">
					No default questions yet.
				</Card>
			) : (
				<Card className="divide-y">
					{data.questions.map((q) => (
						<div
							key={q.id}
							className="flex items-start justify-between gap-3 px-4 py-3"
						>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium">{q.prompt}</span>
									{!q.isActive && (
										<Badge variant="secondary" className="text-xs">
											inactive
										</Badge>
									)}
								</div>
								<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
									<Badge variant="outline" className="text-xs">
										{q.key}
									</Badge>
									<span>{q.type}</span>
									<span>·</span>
									<span>order {q.order}</span>
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setEditing({
										id: q.id,
										key: q.key,
										prompt: q.prompt,
										type: q.type as QuestionType,
										order: q.order,
										isActive: q.isActive,
										configJson: (q.configJson as Record<string, unknown>) ?? {},
									});
									setOpen(true);
								}}
							>
								<Pencil className="mr-2 h-3.5 w-3.5" />
								Edit
							</Button>
						</div>
					))}
				</Card>
			)}

			<DefaultQuestionFormDialog
				open={open}
				onOpenChange={setOpen}
				initial={editing}
			/>
		</div>
	);
}
