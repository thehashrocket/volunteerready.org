'use client';

import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';
import type { ApplicationStatus, Prisma } from '@/prisma/generated/client';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';

interface StatusTimelineProps {
	applicationId: string;
	submittedAt: Date | string;
}

interface TimelineEntry {
	id: string;
	createdAt: Date | string;
	metadata: Prisma.JsonValue;
}

function parseMetadata(
	metadata: Prisma.JsonValue,
): { from: string; to: string } | null {
	if (
		metadata &&
		typeof metadata === 'object' &&
		!Array.isArray(metadata) &&
		'from' in metadata &&
		'to' in metadata
	) {
		return {
			from: String((metadata as Record<string, unknown>).from),
			to: String((metadata as Record<string, unknown>).to),
		};
	}
	return null;
}

function formatDateTime(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
}

export function StatusTimeline({
	applicationId,
	submittedAt,
}: StatusTimelineProps) {
	const query = trpc.screener.myApplicationTimeline.useQuery(
		{ id: applicationId },
		{ enabled: Boolean(applicationId) },
	);

	const entries: TimelineEntry[] = query.data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Status timeline</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="relative border-l border-border ml-3 space-y-6">
					{/* Initial submission */}
					<li className="ml-6">
						<span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background">
							<Clock className="h-2.5 w-2.5 text-primary-foreground" />
						</span>
						<p className="text-sm font-medium">Application submitted</p>
						<time className="text-xs text-muted-foreground tabular-nums">
							{formatDateTime(submittedAt)}
						</time>
					</li>

					{/* Status changes from audit log */}
					{entries.map((entry) => {
						const meta = parseMetadata(entry.metadata);
						if (!meta) return null;

						return (
							<li key={entry.id} className="ml-6">
								<span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-muted ring-4 ring-background">
									<Clock className="h-2.5 w-2.5 text-muted-foreground" />
								</span>
								<div className="flex flex-wrap items-center gap-2">
									<ApplicationStatusBadge
										status={meta.from as ApplicationStatus}
									/>
									<span className="text-xs text-muted-foreground">&rarr;</span>
									<ApplicationStatusBadge
										status={meta.to as ApplicationStatus}
									/>
								</div>
								<time className="text-xs text-muted-foreground tabular-nums">
									{formatDateTime(entry.createdAt)}
								</time>
							</li>
						);
					})}

					{query.isLoading && (
						<li className="ml-6">
							<p className="text-xs text-muted-foreground">Loading timeline…</p>
						</li>
					)}

					{!query.isLoading && entries.length === 0 && (
						<li className="ml-6">
							<p className="text-xs text-muted-foreground">
								No status changes yet.
							</p>
						</li>
					)}
				</ol>
			</CardContent>
		</Card>
	);
}
