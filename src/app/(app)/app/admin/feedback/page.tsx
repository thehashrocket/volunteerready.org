'use client';

import { ArrowLeft, ChevronDown, Loader2, PanelLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { MOOD_UI_CONFIG } from '@/lib/feedback-config';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { trpc } from '@/lib/trpc/client';
import type { FeedbackMood, FeedbackStatus } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<FeedbackStatus, string> = {
	NEW: 'bg-info/10 text-info',
	IN_PROGRESS: 'bg-warning/10 text-warning',
	RESOLVED: 'bg-success/10 text-success',
	DISMISSED: 'bg-muted text-muted-foreground',
};

const STATUS_DOT_COLORS: Record<FeedbackStatus, string> = {
	NEW: 'bg-info',
	IN_PROGRESS: 'bg-warning',
	RESOLVED: 'bg-success',
	DISMISSED: 'bg-muted-foreground/40',
};

// ---------------------------------------------------------------------------
// Relative time helper
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
// Types from tRPC result
// ---------------------------------------------------------------------------

type FeedbackItem = {
	id: string;
	mood: FeedbackMood;
	status: FeedbackStatus;
	message: string;
	pageUrl: string;
	pageName: string | null;
	userAgent: string | null;
	userRole: string | null;
	replyMessage: string | null;
	repliedAt: Date | null;
	repliedBy: string | null;
	resolvedAt: Date | null;
	resolvedBy: string | null;
	createdAt: Date;
	user: { id: string; name: string | null; email: string | null } | null;
	organization: { id: string; name: string } | null;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeedbackAdminPage() {
	const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>(
		'ALL',
	);
	const [moodFilter, setMoodFilter] = useState<FeedbackMood | 'ALL'>('ALL');
	const [page, setPage] = useState(1);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const isDesktop = useMediaQuery('(min-width: 1024px)');
	const isTablet = useMediaQuery('(min-width: 768px)');
	const [listOpen, setListOpen] = useState(false);

	const { data, isLoading, isError, refetch } = trpc.feedback.list.useQuery({
		status: statusFilter === 'ALL' ? undefined : statusFilter,
		mood: moodFilter === 'ALL' ? undefined : moodFilter,
		page,
		pageSize: 20,
	});

	const stats = trpc.feedback.stats.useQuery(undefined, {
		staleTime: 60_000,
	});

	const selectedItem = data?.items?.find(
		(item: FeedbackItem) => item.id === selectedId,
	) as FeedbackItem | undefined;

	// Auto-select first item on desktop
	useEffect(() => {
		if (isDesktop && data?.items?.length && !selectedId) {
			setSelectedId((data.items[0] as FeedbackItem).id);
		}
	}, [isDesktop, data?.items, selectedId]);

	const hasMore = data ? page * data.pageSize < data.total : false;

	// Mobile: show detail view if item selected
	const showMobileDetail = !isTablet && selectedId;

	if (showMobileDetail && selectedItem) {
		return (
			<div className="space-y-4">
				<button
					type="button"
					onClick={() => setSelectedId(null)}
					className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to list
				</button>
				<DetailPanel
					item={selectedItem}
					onStatusChange={() => refetch()}
					onReplySuccess={() => refetch()}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				{/* Tablet: list toggle */}
				{isTablet && !isDesktop && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setListOpen(!listOpen)}
						aria-label="Toggle feedback list"
					>
						<PanelLeft className="h-5 w-5" />
					</Button>
				)}
				<PageHeader
					title="Feedback inbox"
					description="Review and respond to user feedback."
					actions={
						stats.data ? (
							<span className="inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">
								{stats.data.newCount} new
							</span>
						) : undefined
					}
				/>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-2">
				<Select
					value={statusFilter}
					onValueChange={(v) => {
						setStatusFilter(v as FeedbackStatus | 'ALL');
						setPage(1);
						setSelectedId(null);
					}}
				>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All statuses</SelectItem>
						<SelectItem value="NEW">New</SelectItem>
						<SelectItem value="IN_PROGRESS">In progress</SelectItem>
						<SelectItem value="RESOLVED">Resolved</SelectItem>
						<SelectItem value="DISMISSED">Dismissed</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={moodFilter}
					onValueChange={(v) => {
						setMoodFilter(v as FeedbackMood | 'ALL');
						setPage(1);
						setSelectedId(null);
					}}
				>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Mood" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="ALL">All moods</SelectItem>
						{(['HAPPY', 'NEUTRAL', 'FRUSTRATED', 'BUG', 'IDEA'] as const).map(
							(m) => (
								<SelectItem key={m} value={m}>
									{MOOD_UI_CONFIG[m].label}
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>
			</div>

			{/* Insights (collapsible) */}
			{stats.data && <InsightsSection stats={stats.data} />}

			{/* Main content */}
			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-14 rounded-lg" />
					))}
				</div>
			) : isError ? (
				<div className="space-y-2 text-center">
					<p className="text-foreground">Failed to load feedback</p>
					<Button variant="outline" onClick={() => refetch()}>
						Retry
					</Button>
				</div>
			) : !data?.items?.length ? (
				<div className="py-12 text-center">
					<p className="text-xl font-semibold text-foreground">
						No feedback yet
					</p>
					<p className="mt-2 text-base text-muted-foreground">
						Feedback from your users will appear here once someone submits
						through the widget.
					</p>
				</div>
			) : isDesktop ? (
				/* Desktop: side-by-side */
				<div className="flex gap-0 rounded-lg border border-border/60">
					<div className="w-[360px] shrink-0 border-r border-border/60">
						<ListPanel
							items={data.items as FeedbackItem[]}
							selectedId={selectedId}
							onSelect={setSelectedId}
							hasMore={hasMore}
							onLoadMore={() => setPage((p) => p + 1)}
						/>
					</div>
					<div className="flex-1 p-6">
						{selectedItem ? (
							<DetailPanel
								item={selectedItem}
								onStatusChange={() => refetch()}
								onReplySuccess={() => refetch()}
							/>
						) : (
							<p className="py-12 text-center text-muted-foreground">
								Select a feedback item
							</p>
						)}
					</div>
				</div>
			) : isTablet ? (
				/* Tablet: detail panel with overlay list */
				<div className="relative">
					{listOpen && (
						<>
							<button
								type="button"
								aria-label="Close list"
								className="fixed inset-0 z-20 bg-foreground/20"
								onClick={() => setListOpen(false)}
								style={{ top: 'var(--header-height, 56px)' }}
							/>
							<div
								className="fixed left-0 z-30 w-[360px] overflow-y-auto border-r border-border/60 bg-background"
								style={{
									top: 'var(--header-height, 56px)',
									height: 'calc(100vh - var(--header-height, 56px))',
									animation: 'slideInLeft 200ms ease-out',
								}}
							>
								<ListPanel
									items={data.items as FeedbackItem[]}
									selectedId={selectedId}
									onSelect={(id) => {
										setSelectedId(id);
										setListOpen(false);
									}}
									hasMore={hasMore}
									onLoadMore={() => setPage((p) => p + 1)}
								/>
							</div>
						</>
					)}
					{selectedItem ? (
						<DetailPanel
							item={selectedItem}
							onStatusChange={() => refetch()}
							onReplySuccess={() => refetch()}
						/>
					) : (
						<div className="py-12 text-center">
							<p className="text-muted-foreground">Select a feedback item</p>
							<Button
								variant="outline"
								size="sm"
								className="mt-2"
								onClick={() => setListOpen(true)}
							>
								Open list
							</Button>
						</div>
					)}
				</div>
			) : (
				/* Mobile: full-screen list */
				<ListPanel
					items={data.items as FeedbackItem[]}
					selectedId={selectedId}
					onSelect={setSelectedId}
					hasMore={hasMore}
					onLoadMore={() => setPage((p) => p + 1)}
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Insights section (collapsible)
// ---------------------------------------------------------------------------

function InsightsSection({
	stats,
}: {
	stats: {
		byMood: { mood: FeedbackMood; count: number }[];
		topFrictionPages: { pageName: string | null; count: number }[];
	};
}) {
	const [open, setOpen] = useState(false);
	const total = stats.byMood.reduce((s, e) => s + e.count, 0);

	if (total === 0) return null;

	return (
		<div>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
			>
				<ChevronDown
					className={`h-4 w-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
				/>
				Insights
			</button>
			{open && (
				<div className="mt-3 space-y-3 rounded-lg bg-muted/50 p-4">
					{/* Mood breakdown bar */}
					<div>
						<p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
							Mood breakdown
						</p>
						<div className="flex h-3 overflow-hidden rounded-full">
							{stats.byMood.map((entry) => {
								const pct = (entry.count / total) * 100;
								const color =
									entry.mood === 'HAPPY'
										? 'bg-success'
										: entry.mood === 'NEUTRAL'
											? 'bg-info'
											: entry.mood === 'FRUSTRATED'
												? 'bg-destructive'
												: entry.mood === 'BUG'
													? 'bg-destructive/70'
													: 'bg-warning';
								return (
									<div
										key={entry.mood}
										className={`${color} transition-all`}
										style={{ width: `${pct}%` }}
										title={`${MOOD_UI_CONFIG[entry.mood].label}: ${entry.count}`}
									/>
								);
							})}
						</div>
					</div>

					{/* Top friction pages */}
					{stats.topFrictionPages.length > 0 && (
						<div>
							<p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
								Top friction pages
							</p>
							<ul className="space-y-1">
								{stats.topFrictionPages.map((p) => (
									<li
										key={p.pageName}
										className="flex justify-between text-sm text-muted-foreground"
									>
										<span>{p.pageName ?? 'Unknown'}</span>
										<span className="tabular-nums">{p.count}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// List panel
// ---------------------------------------------------------------------------

function ListPanel({
	items,
	selectedId,
	onSelect,
	hasMore,
	onLoadMore,
}: {
	items: FeedbackItem[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	hasMore: boolean;
	onLoadMore: () => void;
}) {
	return (
		<div
			role="listbox"
			aria-label="Feedback items"
			className="divide-y divide-border/40"
		>
			{items.map((item) => {
				const isSelected = item.id === selectedId;
				return (
					<button
						key={item.id}
						type="button"
						role="option"
						aria-selected={isSelected}
						onClick={() => onSelect(item.id)}
						className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
							isSelected
								? 'border-l-2 border-primary bg-muted'
								: 'border-l-2 border-transparent'
						}`}
					>
						<div
							className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[item.status]}`}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm text-foreground">{item.message}</p>
						</div>
						<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
							{relativeTime(item.createdAt)}
						</span>
					</button>
				);
			})}
			{hasMore && (
				<div className="p-3 text-center">
					<button
						type="button"
						onClick={onLoadMore}
						className="h-11 text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
					>
						Load more
					</button>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({
	item,
	onStatusChange,
	onReplySuccess,
}: {
	item: FeedbackItem;
	onStatusChange: () => void;
	onReplySuccess: () => void;
}) {
	const [contextOpen, setContextOpen] = useState(false);
	const [replyText, setReplyText] = useState('');
	const [replyOpen, setReplyOpen] = useState(false);
	const prevItemId = useRef(item.id);
	const utils = trpc.useUtils();

	// Clear draft when switching to a different item
	useEffect(() => {
		if (prevItemId.current !== item.id) {
			setReplyText('');
			setReplyOpen(false);
			prevItemId.current = item.id;
		}
	}, [item.id]);

	const statusMutation = trpc.feedback.updateStatus.useMutation({
		onSuccess: () => {
			utils.feedback.list.invalidate();
			utils.feedback.stats.invalidate();
			onStatusChange();
		},
	});

	const replyMutation = trpc.feedback.reply.useMutation({
		onSuccess: () => {
			setReplyText('');
			setReplyOpen(false);
			utils.feedback.list.invalidate();
			onReplySuccess();
		},
	});

	const MoodIcon = MOOD_UI_CONFIG[item.mood].icon;

	const handleSendReply = () => {
		if (!replyText.trim()) return;
		replyMutation.mutate({ id: item.id, message: replyText.trim() });
	};

	return (
		<div className="space-y-5" aria-live="polite">
			{/* Header */}
			<div className="flex items-center gap-3">
				<MoodIcon className="h-6 w-6 text-primary" />
				<div>
					<span className="text-sm font-semibold">
						{MOOD_UI_CONFIG[item.mood].label}
					</span>
					<span className="ml-2 text-sm text-muted-foreground">
						{item.pageName ?? item.pageUrl}
					</span>
					<span className="ml-2 text-xs tabular-nums text-muted-foreground">
						{relativeTime(item.createdAt)}
					</span>
				</div>
			</div>

			{/* Message */}
			<div>
				<p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
					Message
				</p>
				<p className="max-w-[65ch] text-base text-foreground">{item.message}</p>
			</div>

			{/* Status */}
			<div>
				<p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
					Status
				</p>
				<Select
					value={item.status}
					onValueChange={(v) => {
						statusMutation.mutate({
							id: item.id,
							status: v as FeedbackStatus,
						});
					}}
				>
					<SelectTrigger className="w-[160px]">
						<SelectValue>
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[item.status]}`}
							>
								{item.status.replace('_', ' ')}
							</span>
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{(['NEW', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as const).map(
							(s) => (
								<SelectItem key={s} value={s}>
									<span
										className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[s]}`}
									>
										{s.replace('_', ' ')}
									</span>
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>
			</div>

			{/* Reporter */}
			<div>
				<p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
					Reporter
				</p>
				<p className="text-sm text-foreground">
					{item.user?.name ?? 'Anonymous'}
				</p>
				{item.organization && (
					<p className="text-sm text-muted-foreground">
						{item.organization.name}
					</p>
				)}
			</div>

			{/* Context (collapsible) */}
			<div>
				<button
					type="button"
					onClick={() => setContextOpen(!contextOpen)}
					className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
				>
					<ChevronDown
						className={`h-3 w-3 transition-transform ${contextOpen ? 'rotate-0' : '-rotate-90'}`}
					/>
					Context
				</button>
				{contextOpen && (
					<div className="mt-2 space-y-1 text-sm text-muted-foreground">
						{item.userAgent && <p>User agent: {item.userAgent}</p>}
						<p>URL: {item.pageUrl}</p>
						{item.userRole && <p>Role: {item.userRole}</p>}
						{item.user?.email && <p>Email: {item.user.email}</p>}
					</div>
				)}
			</div>

			{/* Existing reply */}
			{item.replyMessage && (
				<div className="rounded-md border-l-2 border-primary bg-muted p-3">
					<p className="mb-1 text-xs text-muted-foreground">
						Replied {item.repliedAt ? relativeTime(item.repliedAt) : ''}
					</p>
					<p className="text-sm text-foreground">{item.replyMessage}</p>
				</div>
			)}

			{/* Reply section */}
			<div>
				<p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
					Reply
				</p>
				{!replyOpen ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setReplyOpen(true)}
					>
						Reply to {item.user?.name ?? 'user'}
					</Button>
				) : (
					<div className="space-y-2">
						<textarea
							value={replyText}
							onChange={(e) => setReplyText(e.target.value)}
							placeholder={`Reply to ${item.user?.name ?? 'user'}...`}
							maxLength={2000}
							className="min-h-[80px] w-full resize-none rounded-sm bg-muted p-3 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
						/>
						{replyMutation.isError && (
							<p className="text-sm text-destructive">
								Reply failed — try again.
							</p>
						)}
						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setReplyText('');
									setReplyOpen(false);
								}}
							>
								Cancel
							</Button>
							<Button
								size="sm"
								disabled={!replyText.trim() || replyMutation.isPending}
								onClick={handleSendReply}
								className="rounded-full"
							>
								{replyMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									'Send'
								)}
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
