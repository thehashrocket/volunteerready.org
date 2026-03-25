'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MOOD_UI_CONFIG } from '@/lib/feedback-config';
import { trpc } from '@/lib/trpc/client';
import type { FeedbackMood, FeedbackStatus } from '@/prisma/generated/client';
import { VOLUNTEER_STATUS_LABELS } from '@/server/domain/user-feedback';

// ---------------------------------------------------------------------------
// Status badge (volunteer-facing labels)
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<string, string> = {
	info: 'bg-info/10 text-info',
	warning: 'bg-warning/10 text-warning',
	success: 'bg-success/10 text-success',
	neutral: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
	const config = VOLUNTEER_STATUS_LABELS[status];
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${VARIANT_STYLES[config.variant]}`}
		>
			{config.label}
		</span>
	);
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(date: Date | string): string {
	const now = Date.now();
	const then = new Date(date).getTime();
	const diff = now - then;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(date).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyFeedbackPage() {
	const { data, isLoading, isError, refetch } =
		trpc.feedback.myFeedback.useQuery();

	return (
		<div className="space-y-6">
			<PageHeader
				title="My feedback"
				description="Track feedback you've shared with VolunteerReady"
			/>

			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-16 rounded-lg" />
					))}
				</div>
			) : isError ? (
				<div className="space-y-2 text-center">
					<p className="text-foreground">Failed to load</p>
					<Button variant="outline" onClick={() => refetch()}>
						Retry
					</Button>
				</div>
			) : !data?.length ? (
				<EmptyState />
			) : (
				<ul className="space-y-2">
					{data.map((item) => (
						<FeedbackRow key={item.id} item={item} />
					))}
				</ul>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
	return (
		<div className="py-12 text-center">
			<p className="text-xl font-semibold text-foreground">No feedback yet</p>
			<p className="mt-2 text-base text-muted-foreground">
				Feedback you share through the widget will appear here.
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Feedback row (expandable)
// ---------------------------------------------------------------------------

type FeedbackRowItem = {
	id: string;
	mood: FeedbackMood;
	message: string;
	pageName: string | null;
	status: FeedbackStatus;
	createdAt: Date;
	replyMessage: string | null;
	repliedAt: Date | null;
};

function FeedbackRow({ item }: { item: FeedbackRowItem }) {
	const [expanded, setExpanded] = useState(false);
	const MoodIcon = MOOD_UI_CONFIG[item.mood].icon;

	return (
		<li className="list-none rounded-lg border border-border/60">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				aria-expanded={expanded}
				className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
			>
				<MoodIcon className="h-4 w-4 shrink-0 text-primary" />
				<span className="min-w-0 flex-1 truncate text-sm text-foreground">
					{item.message}
				</span>
				<StatusBadge status={item.status} />
				<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
					{relativeTime(item.createdAt)}
				</span>
				<ChevronDown
					className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
				/>
			</button>
			{expanded && (
				<div className="border-t border-border/40 px-4 py-3 space-y-3">
					<p className="text-sm text-foreground">{item.message}</p>
					{item.pageName && (
						<p className="text-xs text-muted-foreground">
							Page: {item.pageName}
						</p>
					)}

					{item.replyMessage && (
						<div className="rounded-md border-l-2 border-primary bg-muted p-3">
							<p className="mb-1 text-xs text-muted-foreground">
								VolunteerReady team replied{' '}
								{item.repliedAt ? relativeTime(item.repliedAt) : ''}:
							</p>
							<p className="text-sm text-foreground">{item.replyMessage}</p>
						</div>
					)}
				</div>
			)}
		</li>
	);
}
