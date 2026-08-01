'use client';

import { ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CardList } from '@/components/app/card-list';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { ApplicationStatusBadge } from '@/components/my-applications/ApplicationStatusBadge';
import { ScreeningStatusBadge } from '@/components/my-applications/ScreeningStatusBadge';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';

function flagCount(screeningReasons: unknown): number {
	return Array.isArray(screeningReasons) ? screeningReasons.length : 0;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TableSkeleton() {
	return (
		<Card data-testid="applications-skeleton-table">
			<CardContent className="pt-6">
				<Table>
					<TableHeader>
						<TableRow>
							{[
								'Submitted',
								'Email',
								'Opportunity',
								'Status',
								'Screening',
								'Flags',
								'',
							].map((h) => (
								<TableHead key={h}>{h}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 5 }).map((_, i) => (
							<TableRow key={i}>
								{[112, 160, 120, 64, 64, 48, 24].map((w, j) => (
									<TableCell key={j}>
										<Skeleton className="h-4" style={{ width: w }} />
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

/**
 * The card list needs its own skeleton shape for the same reason the table one
 * exists: it stands in for a two-line row, not for seven cells, and reusing the
 * table shape below `lg` reserves the wrong height and reflows the moment data
 * lands. Bar heights match the real row's LINE BOXES (`font-medium` 24px,
 * `text-xs` 16px), not the glyph heights.
 */
function CardListSkeleton() {
	return (
		<CardList data-testid="applications-skeleton-cards">
			{Array.from({ length: 5 }).map((_, i) => (
				<div key={i} className="flex flex-col gap-2 px-4 py-3">
					<div className="flex items-center justify-between gap-2">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-6 w-20 rounded-full" />
					</div>
					<Skeleton className="h-4 w-40" />
				</div>
			))}
		</CardList>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApplicationsPage() {
	const router = useRouter();
	const [status, setStatus] = useState<string>('ALL');

	const query = trpc.screener.list.useQuery({
		status: (status === 'ALL' ? undefined : status) as
			| 'SUBMITTED'
			| 'REVIEW'
			| 'APPROVED'
			| 'REJECTED'
			| undefined,
		page: 1,
		pageSize: 50,
	});

	const total = query.data?.total ?? 0;
	const applications = query.data?.items ?? [];

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Applications"
					description="Review and act on incoming volunteer applications."
				/>
				<div className="hidden lg:block">
					<TableSkeleton />
				</div>
				<div className="lg:hidden">
					<CardListSkeleton />
				</div>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Applications"
					description="Review and act on incoming volunteer applications."
				/>
				<QueryErrorCard
					title="We couldn't load applications"
					message={safeErrorMessage(query.error)}
					onRetry={() => query.refetch()}
					isRetrying={query.isFetching}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Applications"
				description={`${total} total application${total === 1 ? '' : 's'}`}
				actions={
					<Select value={status} onValueChange={setStatus}>
						<SelectTrigger className="w-44">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">All statuses</SelectItem>
							<SelectItem value="SUBMITTED">Submitted</SelectItem>
							<SelectItem value="REVIEW">Review</SelectItem>
							<SelectItem value="APPROVED">Approved</SelectItem>
							<SelectItem value="REJECTED">Rejected</SelectItem>
						</SelectContent>
					</Select>
				}
			/>

			{applications.length === 0 ? (
				<EmptyState
					title="No applications yet"
					description="When volunteers submit applications, they will appear here."
					icon={FileText}
				/>
			) : (
				<>
					{/* Both trees render from the same array and are switched by CSS,
					    never by `useMediaQuery`: that hook initialises to `false` and
					    only resolves in an effect, so gating the LIST on it paints the
					    card shape to every desktop user and swaps it after hydration.
					    The cost is one hidden subtree in the DOM, which `display: none`
					    also removes from the accessibility tree — so exactly one control
					    per application is ever reachable.

					    Visibility sits on a wrapper rather than on `Card`/`CardList`:
					    `hidden` and Card's own `flex` are both display utilities, so one
					    is dropped by tailwind-merge and which survives is a detail of the
					    merge rather than of this file. */}
					<div className="hidden lg:block" data-testid="applications-table">
						<Card>
							<CardContent className="pt-6">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Submitted</TableHead>
											<TableHead>Email</TableHead>
											<TableHead>Opportunity</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Screening</TableHead>
											<TableHead>Flags</TableHead>
											<TableHead />
										</TableRow>
									</TableHeader>
									<TableBody>
										{applications.map((app) => {
											const flags = flagCount(app.screeningReasons);
											return (
												<TableRow
													key={app.id}
													className="cursor-pointer"
													onClick={() =>
														router.push(`/app/applications/${app.id}`)
													}
												>
													<TableCell>
														<div>{formatDate(app.submittedAt)}</div>
														<div className="text-xs text-muted-foreground">
															{formatRelative(app.submittedAt)}
														</div>
													</TableCell>
													<TableCell className="font-medium">
														{app.submittedByEmail}
													</TableCell>
													<TableCell className="text-sm text-muted-foreground">
														{app.opportunity?.title ?? (
															<span className="text-muted-foreground">—</span>
														)}
													</TableCell>
													<TableCell>
														<ApplicationStatusBadge status={app.status} />
													</TableCell>
													<TableCell>
														<ScreeningStatusBadge
															status={app.screeningStatus}
														/>
													</TableCell>
													<TableCell>
														{flags === 0 ? (
															<span className="text-muted-foreground">—</span>
														) : (
															<Badge variant="destructive">
																{flags} flag{flags > 1 ? 's' : ''}
															</Badge>
														)}
													</TableCell>
													<TableCell>
														<ChevronRight className="h-4 w-4 text-muted-foreground" />
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					{/* `Opportunity` and the absolute date fold into a second muted
					    line, and `Screening` drops out entirely — reference detail one
					    tap away on the application itself, not what a coordinator scans
					    a queue for. `Flags` STAYS: it is the only cell that says "this
					    one needs you", and dropping it would make the phone a worse
					    triage surface rather than a narrower one.

					    A `<Link>` rather than the table's `router.push` on a `<tr>`.
					    The row is navigation, so it should be middle-clickable and
					    reachable by keyboard; the desktop row-click has no keyboard path
					    at all, which is a pre-existing gap this deliberately does not
					    copy down. */}
					<div className="lg:hidden" data-testid="applications-card-list">
						<CardList>
							{applications.map((app) => {
								const flags = flagCount(app.screeningReasons);
								return (
									<Link
										key={app.id}
										href={`/app/applications/${app.id}`}
										// The row's own text is four separate facts run together;
										// without an explicit name a rotor reads all of them as the
										// link's name and never says where it goes.
										aria-label={`View application from ${app.submittedByEmail}`}
										className="flex flex-col gap-1 px-4 py-3"
									>
										<div className="flex items-start justify-between gap-2">
											{/* min-w-0 so truncate engages inside the flex row: a
											    long address otherwise widens the card past the
											    viewport, which is the sideways scroll this layout
											    exists to remove. */}
											<div className="min-w-0 truncate font-medium">
												{app.submittedByEmail}
											</div>
											{/* `shrink-0` like every other card badge here.
											    `Badge` carries no `whitespace-nowrap` (unlike
											    `Button`, which is `shrink-0` by default), so as a
											    plain flex item it takes its proportional share of
											    the negative space and a two-word label such as
											    "In review" wraps to two lines instead of the email
											    ellipsizing. */}
											<ApplicationStatusBadge
												status={app.status}
												className="shrink-0"
											/>
										</div>
										<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
											<span className="min-w-0 truncate">
												{formatRelative(app.submittedAt)}
												{app.opportunity?.title
													? ` · ${app.opportunity.title}`
													: ''}
											</span>
											{flags > 0 ? (
												<Badge variant="destructive" className="shrink-0">
													{flags} flag{flags > 1 ? 's' : ''}
												</Badge>
											) : null}
										</div>
									</Link>
								);
							})}
						</CardList>
					</div>
				</>
			)}
		</div>
	);
}
