'use client';

import { BookUser, Download, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { VolunteerStatusBadge } from '@/components/volunteers/volunteer-status-badge';
import { FOUNDER_BOOKING_URL } from '@/lib/constants';
import { trpc } from '@/lib/trpc/client';
import { ROSTER_POPULATED_THRESHOLD } from '@/server/domain/org-volunteer';
import { AddVolunteerDialog } from './AddVolunteerDialog';

const COLUMNS = ['Volunteer', 'Added', 'Shifts', 'Status', ''] as const;

/**
 * `Card` is `flex flex-col gap-6 … py-6`, which fights `divide-y`: the rule
 * draws a hairline on each row's top edge while the gap holds the rows 24px
 * apart, so the line floats in open space instead of separating anything.
 * Zeroing both gives the flush divided list the spec asks for, with Card still
 * supplying the surface, border and radius.
 */
const CARD_LIST = 'gap-0 divide-y py-0';

/**
 * Table-shaped skeleton with the REAL column headers and width-matched cells,
 * so nothing reflows when data lands. The alternative idiom in this repo —
 * five grey bars — visibly jumps on a list you are about to scan.
 * Shape copied from applications/page.tsx:40-75.
 */
function TableSkeleton() {
	return (
		<Card>
			<CardContent className="pt-6">
				<Table>
					<TableHeader>
						<TableRow>
							{COLUMNS.map((h) => (
								<TableHead key={h}>{h}</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{Array.from({ length: 5 }).map((_, i) => (
							<TableRow key={i}>
								{[180, 96, 40, 110, 72].map((w, j) => (
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
 * The mobile skeleton needs its own shape for the same reason the table one
 * does: it stands in for a two-line row plus a badge row, not for five cells.
 * Reusing TableSkeleton below `lg` would reserve the wrong height and reflow
 * the moment data lands — the exact failure the table skeleton exists to avoid.
 */
function CardListSkeleton() {
	return (
		<Card className={CARD_LIST} data-testid="roster-skeleton-cards">
			{Array.from({ length: 5 }).map((_, i) => (
				<div key={i} className="flex flex-col gap-3 px-4 py-3">
					{/* Bar heights match the real row's LINE BOXES, not the glyph
					    heights: `font-medium` is 24px and `text-xs` is 16px, with no
					    gap between them. Sizing these h-4/h-3 with a gap left each
					    skeleton row ~6px short, which is a 30px jump over five rows
					    — the reflow this component exists to prevent. */}
					<div>
						<Skeleton className="h-6 w-40" />
						<Skeleton className="h-4 w-52" />
					</div>
					<div className="flex items-center justify-between">
						<Skeleton className="h-6 w-28 rounded-full" />
						<Skeleton className="h-11 w-20" />
					</div>
				</div>
			))}
		</Card>
	);
}

/**
 * The concierge offer. Shown while the roster is below the "populated"
 * threshold and hidden after.
 *
 * The threshold is deliberately the SAME number as the success metric and the
 * onboarding milestone. An org that types three names, realises it has 57 more
 * and closes the tab is exactly the org that needs this — and if the offer
 * lived only in the empty state, it is exactly the org that would never see it
 * again.
 */
function ConciergeLine() {
	return (
		<p className="text-center text-sm text-muted-foreground">
			Have a spreadsheet?{' '}
			<a
				href={FOUNDER_BOOKING_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="underline underline-offset-4 hover:text-foreground"
			>
				Send it over and we&apos;ll import it for you.
			</a>
		</p>
	);
}

/**
 * Rendered once per volunteer in EACH tree, so it is a component rather than
 * two copies that drift — the accessible name in particular, which is the whole
 * point of it and the easiest half to update in one place and forget in the
 * other.
 */
function RemoveVolunteerButton({
	displayName,
	disabled,
	onRemove,
	variant = 'outline',
}: {
	displayName: string;
	disabled: boolean;
	onRemove: () => void;
	/**
	 * `outline` on the desktop table, per the approved mockup ("a quiet outline
	 * button, never red, no trash icon"). The card list passes `ghost`: the
	 * mockup is desktop-only, and on a two-line card an outlined button is the
	 * heaviest thing in the row, which makes the destructive action outrank the
	 * person's name. Still the same 44px target and the same accessible name —
	 * and still not an icon, because the no-trash-icon rule is about not
	 * dressing removal up as something quicker than it is.
	 */
	variant?: 'outline' | 'ghost';
}) {
	return (
		<Button
			variant={variant}
			size="sm"
			// 44px, the repo's tap-target convention.
			className="h-11"
			// The visible label stays "Remove" per the approved mockup; the
			// accessible name carries the target. Without it a rotor lists N
			// identical "Remove" buttons with nothing to choose between them.
			aria-label={`Remove ${displayName} from your roster`}
			disabled={disabled}
			onClick={onRemove}
		>
			Remove
		</Button>
	);
}

function LoadMore({
	onClick,
	isFetching,
}: {
	onClick: () => void;
	isFetching: boolean;
}) {
	return (
		<div className="flex justify-center pt-4">
			{/* h-11 like Remove and the search field: on a phone this is the one
			    control a coordinator taps repeatedly while paging a long roster,
			    so it must not be the shortest target on the page. */}
			<Button
				variant="outline"
				className="h-11"
				onClick={onClick}
				disabled={isFetching}
			>
				{isFetching ? 'Loading…' : 'Load more'}
			</Button>
		</div>
	);
}

export default function VolunteersPage() {
	const [search, setSearch] = useState('');
	const [cursor, setCursor] = useState<string | null>(null);
	const [liveMessage, setLiveMessage] = useState('');

	// Keyed by volunteer id rather than holding one "last removed" value: two
	// quick removals leave two undo toasts on screen at once, and a single slot
	// would make the older one restore the newer one's name in its confirmation.
	const removedNames = useRef(new Map<string, string>());

	const roster = trpc.volunteers.list.useQuery(
		{ cursor, search: search.trim() || null },
		{
			// Keeps the previous page on screen while the next one loads, so
			// "Load more" never blanks a list mid-scroll.
			placeholderData: (prev) => prev,
		},
	);
	const count = trpc.volunteers.count.useQuery();
	// The export URL needs a concrete org id: the route is scoped by its path
	// segment and deliberately will not fall back to session state.
	//
	// NOT a guaranteed cache read, despite OrgSwitcher issuing the same query in
	// the app shell — that one is `enabled: Boolean(currentOrgId)` and
	// `staleTime: 10_000`, so it never runs for a session without a current org
	// and goes stale ten seconds after mount. Treated as a real fetch here, which
	// is why the control is gated on `org.data` below rather than assumed present.
	const org = trpc.org.getCurrentOrg.useQuery();
	const utils = trpc.useUtils();

	const volunteers = roster.data?.volunteers ?? [];
	const total = count.data ?? 0;
	const isSearching = search.trim().length > 0;
	const showConcierge = total < ROSTER_POPULATED_THRESHOLD;
	const nextCursor = roster.data?.nextCursor ?? null;

	const restoreVolunteer = trpc.volunteers.restore.useMutation({
		onSuccess: (_data, variables) => {
			const name = removedNames.current.get(variables.volunteerId);
			removedNames.current.delete(variables.volunteerId);
			const message = name
				? `${name} is back on your roster.`
				: 'Volunteer restored to your roster.';
			setLiveMessage(message);
			toast.success(message);
			utils.volunteers.invalidate();
		},
		onError: (error) => {
			// Undo can legitimately fail: the volunteer may have used the exit on
			// /app/profile in the meantime, which writes an OrgVolunteerBlock that
			// restoreVolunteer refuses with FORBIDDEN. That refusal is the point —
			// surface it rather than pretending the undo worked.
			toast.error(safeErrorMessage(error) ?? 'Could not undo that.');
		},
	});

	const removeVolunteer = trpc.volunteers.remove.useMutation({
		onSuccess: (_data, variables) => {
			const name = volunteers.find(
				(v) => v.id === variables.volunteerId,
			)?.displayName;
			if (name) removedNames.current.set(variables.volunteerId, name);

			setLiveMessage(
				name
					? `${name} removed from your roster.`
					: 'Volunteer removed from your roster.',
			);
			toast.success('Removed from your roster.', {
				description: 'Recorded hours stay in your reports.',
				// Sonner's default is ~4s. An Undo the coordinator has to notice,
				// read and reach for needs longer than a notice they only have to
				// read — and on a phone the button is a deliberate thumb movement.
				duration: 10_000,
				action: {
					label: 'Undo',
					onClick: () =>
						restoreVolunteer.mutate({ volunteerId: variables.volunteerId }),
				},
			});
			utils.volunteers.invalidate();
		},
		onError: (error) => {
			toast.error(
				safeErrorMessage(error) ?? 'Could not remove that volunteer.',
			);
		},
	});

	function refresh() {
		setCursor(null);
		utils.volunteers.invalidate();
	}

	// Only the row actually being removed goes disabled. Gating every Remove on
	// the bare `isPending` greys out the whole list on one click — worst on the
	// card list, where the button is half the row, so the page reads as broken
	// and nothing says WHICH volunteer is going.
	const pendingRemovalId = removeVolunteer.isPending
		? removeVolunteer.variables?.volunteerId
		: undefined;

	function loadMore() {
		if (nextCursor) setCursor(nextCursor);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Volunteers"
				description={
					count.data === undefined
						? undefined
						: `${total} ${total === 1 ? 'volunteer' : 'volunteers'}`
				}
				actions={<AddVolunteerDialog onAdded={refresh} />}
			/>

			{/* A row vanishing is the only durable confirmation that a removal
			    happened — the toast is transient and a screen-reader user may be
			    reading elsewhere when it fires. Same `<output aria-live>` idiom as
			    org-profile-form.tsx:270; the volunteer-side leave control at
			    profile/page.tsx:697-704 makes the same call with a plain
			    `<p aria-live>` and `<ul aria-live>` instead.

			    A discrete message rather than wrapping the list itself: the list
			    also changes on search and on Load more, and announcing the whole
			    roster on every keystroke is worse than announcing nothing. */}
			<output aria-live="polite" className="sr-only">
				{liveMessage}
			</output>

			{/* Stacks below lg: the export button is ~120px and the search field is
			    the primary control on a phone-first surface, so they must not
			    compete for one row. `lg`, matching the table/card switch below, so
			    the page has one breakpoint rather than a band where the list is
			    already cards but the controls still share a row. */}
			<div className="flex flex-col gap-2 lg:flex-row lg:items-center">
				<div className="relative w-full lg:max-w-md lg:flex-1">
					{/* An sr-only label, not placeholder-as-label: a placeholder stops
					    being a label the moment the field has content. */}
					<Label htmlFor="volunteer-search" className="sr-only">
						Search volunteers
					</Label>
					<Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						id="volunteer-search"
						placeholder="Search by name or email"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setCursor(null);
						}}
						// h-11 to match Remove and the repo's 44px convention, and to
						// stay level with the export button beside it.
						className="h-11 pl-8"
					/>
				</div>

				{/* An anchor, not a fetch-and-blob: the response streams, and letting
				    the browser own the download means a large roster never has to
				    materialize in the tab.
				    Withheld until the org id resolves (a download button that does
				    nothing on click is worse than one that appears a beat later) AND
				    while the roster is empty — the approved spec hides it at 0 rows,
				    since a header-only download beside "add your first volunteer" is
				    an offer with nothing behind it. */}
				{org.data && total > 0 ? (
					<Button variant="outline" asChild className="h-11">
						<a
							href={`/api/org/${org.data.id}/roster/csv`}
							// No `download` attribute: the route sets
							// Content-Disposition with a dated filename, and `download`
							// with no value would let the URL's last segment ("csv") win.
							data-testid="export-roster-csv"
						>
							<Download className="h-4 w-4" />
							Export CSV
						</a>
					</Button>
				) : null}
			</div>

			{roster.isLoading ? (
				<>
					<div className="hidden lg:block">
						<TableSkeleton />
					</div>
					<div className="lg:hidden">
						<CardListSkeleton />
					</div>
				</>
			) : roster.isError ? (
				<QueryErrorCard
					title="Couldn't load your volunteers"
					message={safeErrorMessage(roster.error)}
					onRetry={() => roster.refetch()}
					isRetrying={roster.isFetching}
				/>
			) : volunteers.length === 0 ? (
				// Two distinct empty states. Conflating them makes a working filter
				// look like an empty roster.
				isSearching ? (
					<EmptyState title="No volunteers match that search." icon={Search} />
				) : (
					<EmptyState
						icon={BookUser}
						title="No volunteers yet"
						description="Add the volunteers you already work with. They don't need to sign up first — you can schedule them and track their hours right away."
						action={<AddVolunteerDialog onAdded={refresh} />}
					/>
				)
			) : (
				<>
					{/* Both trees render from the same array and are switched by CSS,
					    never by useMediaQuery: that hook initialises to `false` and
					    only resolves in an effect, so gating the LIST on it paints
					    the card shape to every desktop user and swaps it after
					    hydration. The cost is one hidden subtree in the DOM, which
					    `display: none` also removes from the accessibility tree — so
					    exactly one Remove button per volunteer is ever reachable.

					    Visibility sits on a wrapper rather than on Card itself:
					    `hidden` and Card's own `flex` are both display utilities, so
					    one of them is dropped by tailwind-merge, and which survives
					    is a detail of the merge rather than of this file. */}
					<div className="hidden lg:block" data-testid="roster-table">
						<Card>
							<CardContent className="pt-6">
								<Table>
									<TableHeader>
										<TableRow>
											{COLUMNS.map((h) => (
												<TableHead key={h}>{h}</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{volunteers.map((v) => (
											<TableRow key={v.id}>
												<TableCell>
													{/* Two lines, no avatar — no table in this app has
												    avatars, and adding them here is net-new vocabulary
												    for no informational gain. */}
													<div className="font-medium">{v.displayName}</div>
													<div className="text-xs text-muted-foreground">
														{v.email}
													</div>
												</TableCell>
												<TableCell className="tabular-nums text-sm text-muted-foreground">
													{new Date(v.addedAt).toLocaleDateString()}
												</TableCell>
												<TableCell className="tabular-nums text-sm">
													{v.attendedShifts}
												</TableCell>
												<TableCell>
													<VolunteerStatusBadge state={v.accountState} />
												</TableCell>
												<TableCell className="text-right">
													<RemoveVolunteerButton
														displayName={v.displayName}
														disabled={pendingRemovalId === v.id}
														onRemove={() =>
															removeVolunteer.mutate({ volunteerId: v.id })
														}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>

								{nextCursor ? (
									<LoadMore onClick={loadMore} isFetching={roster.isFetching} />
								) : null}
							</CardContent>
						</Card>
					</div>

					{/* `Added` and `Shifts` drop out below lg, per the approved
					    responsive spec: reference data, not what the coordinator is
					    scanning for on a phone.

					    DEVIATION from that spec, deliberate: it puts `Remove` in the
					    T27 detail dialog and leaves the row itself tappable. T27 is
					    not built, so following it literally would mean a phone could
					    no longer remove a volunteer at all — a capability this
					    surface has today. The spec's stated reason for moving it is
					    that "a Remove button inside a full-width tappable row is a
					    nested interactive target", which holds only once the row is
					    tappable. It is not: this row is a plain div with exactly one
					    control in it. When T27 lands, the row becomes the tap target
					    and Remove moves into the dialog as specified. */}
					<div className="lg:hidden" data-testid="roster-card-list">
						<Card className={CARD_LIST}>
							{volunteers.map((v) => (
								// Two lines, matching the approved Responsive spec: identity and
								// status on the first, address and action on the second. An earlier
								// draft gave the badge its own line opposite Remove, which pushed the
								// row to ~120px and made the destructive control the largest thing in
								// it — roughly halving how many volunteers fit a phone screen, on a
								// surface DESIGN.md calls data-dense.
								<div key={v.id} className="flex flex-col gap-1 px-4 py-3">
									<div className="flex items-start justify-between gap-2">
										{/* min-w-0 so truncate engages inside the flex row — a long
										    name otherwise widens the card past the viewport, which is
										    the sideways scroll this layout exists to remove. */}
										<div className="min-w-0 truncate font-medium">
											{v.displayName}
										</div>
										<VolunteerStatusBadge
											state={v.accountState}
											className="shrink-0"
										/>
									</div>
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0 truncate text-xs text-muted-foreground">
											{v.email}
										</div>
										<RemoveVolunteerButton
											displayName={v.displayName}
											disabled={pendingRemovalId === v.id}
											variant="ghost"
											onRemove={() =>
												removeVolunteer.mutate({ volunteerId: v.id })
											}
										/>
									</div>
								</div>
							))}

							{nextCursor ? (
								<div className="px-4 pb-4">
									<LoadMore onClick={loadMore} isFetching={roster.isFetching} />
								</div>
							) : null}
						</Card>
					</div>
				</>
			)}

			{showConcierge && !roster.isLoading && !roster.isError ? (
				<ConciergeLine />
			) : null}
		</div>
	);
}
