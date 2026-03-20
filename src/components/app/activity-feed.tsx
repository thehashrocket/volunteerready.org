'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Event text formatting — contextual text from AuditLog metadata
// ---------------------------------------------------------------------------

function formatEventText(
	action: string,
	metadata: Record<string, unknown> | null,
	actorName: string | null,
	actorEmail: string | null,
): string {
	const actor = actorName || actorEmail || 'Someone';
	const meta = metadata ?? {};

	switch (action) {
		case 'volunteer_application.submitted': {
			const email = (meta.email as string) || actor;
			const opp = meta.opportunityTitle as string;
			return opp
				? `${email} applied for ${opp}`
				: `${email} submitted an application`;
		}
		case 'shift.attendance.attended': {
			const shift = (meta.shiftTitle as string) || 'a shift';
			return `${actor} checked in at ${shift}`;
		}
		case 'CREDENTIAL_ISSUED': {
			const type = (meta.type as string) || 'A credential';
			const name =
				(meta.volunteerName as string) ||
				(meta.volunteerEmail as string) ||
				actor;
			return `${type} credential issued to ${name}`;
		}
		case 'shift.completed': {
			const shift = (meta.title as string) || 'A shift';
			return `${shift} completed`;
		}
		case 'MEMBER_INVITED': {
			const email = (meta.email as string) || 'someone';
			return `${email} invited to the team`;
		}
		default:
			return action.replace(/[._]/g, ' ');
	}
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m`;
	if (diffHr < 24) return `${diffHr}h`;
	if (diffDays < 7) return `${diffDays}d`;
	return date.toLocaleDateString();
}

function getDateLabel(date: Date): string {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const eventDay = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	const diffDays = Math.floor(
		(today.getTime() - eventDay.getTime()) / 86400000,
	);

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Yesterday';
	return date.toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
	});
}

function isToday(date: Date): boolean {
	const now = new Date();
	return (
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate()
	);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed() {
	const { data, isLoading, isError, refetch } =
		trpc.screener.getActivityFeed.useQuery();

	if (isLoading) {
		return (
			<Card className="border-border/70 bg-neutral-100">
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-semibold">
						Recent activity
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="flex items-center gap-3">
								<div className="h-2 w-2 rounded-full bg-neutral-300" />
								<Skeleton className="h-4 flex-1" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (isError) {
		return (
			<Card className="border-border/70 bg-neutral-100">
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-semibold">
						Recent activity
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						Couldn't load activity.{' '}
						<button
							type="button"
							onClick={() => refetch()}
							className="font-semibold text-primary underline-offset-4 hover:underline"
						>
							Retry
						</button>
					</p>
				</CardContent>
			</Card>
		);
	}

	if (!data || data.length === 0) {
		return (
			<Card className="border-border/70 bg-neutral-100">
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-semibold">
						Recent activity
					</CardTitle>
				</CardHeader>
				<CardContent>
					<EmptyState
						icon={FileText}
						title="No activity yet"
						description="Your org's story starts when you get your first volunteer!"
					/>
					<div className="mt-3">
						<Link
							href="/app/opportunities"
							className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
						>
							Create opportunity →
						</Link>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Group events by date
	const groups: { label: string; events: typeof data }[] = [];
	let currentLabel = '';
	for (const event of data) {
		const date = new Date(event.createdAt);
		const label = getDateLabel(date);
		if (label !== currentLabel) {
			groups.push({ label, events: [] });
			currentLabel = label;
		}
		groups[groups.length - 1].events.push(event);
	}

	return (
		<Card className="border-border/70 bg-neutral-100">
			<CardHeader className="pb-3">
				<CardTitle className="text-base font-semibold">
					Recent activity
				</CardTitle>
			</CardHeader>
			<CardContent role="feed" aria-label="Recent activity">
				<div className="space-y-4">
					{groups.map((group) => (
						<div key={group.label}>
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								{group.label}
							</p>
							<div className="space-y-2">
								{group.events.map((event) => {
									const date = new Date(event.createdAt);
									const today = isToday(date);
									return (
										<article key={event.id} className="flex items-start gap-3">
											<div
												className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${today ? 'bg-primary' : 'bg-neutral-300'}`}
											/>
											<p className="flex-1 text-sm">
												{formatEventText(
													event.action,
													event.metadata as Record<string, unknown> | null,
													event.actor?.name ?? null,
													event.actor?.email ?? null,
												)}
											</p>
											<span className="shrink-0 text-xs text-muted-foreground">
												{formatRelativeTime(date)}
											</span>
										</article>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
