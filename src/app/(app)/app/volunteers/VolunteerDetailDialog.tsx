'use client';

import { AlertTriangle } from 'lucide-react';
import { safeErrorMessage } from '@/components/app/query-error-card';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { VolunteerStatusBadge } from '@/components/volunteers/volunteer-status-badge';
import { useFrozenDesktopShell } from '@/lib/hooks/use-frozen-desktop-shell';
import { trpc } from '@/lib/trpc/client';
import {
	ORG_VOLUNTEER_SOURCE_COPY_STAFF,
	SHIFT_HISTORY_WIRE_CAP,
} from '@/server/domain/org-volunteer';
import { RemoveVolunteerButton } from './RemoveVolunteerButton';

const TITLE_FALLBACK = 'Volunteer';
const DESCRIPTION = 'What this organization has recorded for them.';

function formatShiftDate(startTime: Date, endTime: Date) {
	return `${startTime.toLocaleDateString()}, ${startTime.toLocaleTimeString(
		[],
		{
			hour: 'numeric',
			minute: '2-digit',
		},
	)} – ${endTime.toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
	})}`;
}

function hoursLabel(hours: number) {
	return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** A labelled fact, stacked so a long email never pushes its label off-screen. */
function Fact({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		// `min-w-0` is what makes the docstring above true. A grid item defaults
		// to `min-width: auto`, and `break-words` is `overflow-wrap`, which per
		// CSS Text does NOT contribute its break opportunities to min-content
		// size — so without this a long address sizes the track to the unbroken
		// string and pushes the 375px sheet sideways.
		<div className="min-w-0">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="break-words text-sm">{children}</dd>
		</div>
	);
}

function DetailSkeleton() {
	return (
		// `space-y-6` and a third bar on the `Added` cell, matching the loaded
		// shape below. The roster page's two skeletons reason down to the line
		// box for the same reason: DrawerContent is pinned to the bottom, so a
		// body that grows when data lands pushes the whole sheet upward.
		<div className="space-y-6" data-testid="volunteer-detail-skeleton">
			<div className="grid grid-cols-2 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="space-y-1">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-5 w-32" />
						{/* The `Added` cell carries a second line (the source
						    sentence); reserving it here stops a one-line jump. */}
						{i === 2 ? <Skeleton className="h-4 w-24" /> : null}
					</div>
				))}
			</div>
			<Skeleton className="h-5 w-40" />
			<div className="space-y-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<div key={i} className="space-y-1">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-4 w-56" />
					</div>
				))}
			</div>
		</div>
	);
}

function DetailBody({ volunteerId }: { volunteerId: string }) {
	const detail = trpc.volunteers.getById.useQuery({ volunteerId });

	// Loading → error → content, in that order. A missing error branch does not
	// fail visibly, it falls through to whatever renders next — which here would
	// be an empty history reading as "this volunteer has never worked a shift".
	if (detail.isLoading) return <DetailSkeleton />;

	if (detail.isError) {
		return (
			<div className="space-y-3 text-sm" role="alert">
				<p className="flex items-center gap-2 font-medium">
					<AlertTriangle className="h-4 w-4 text-destructive" />
					Couldn&apos;t load this volunteer
				</p>
				{/* safeErrorMessage, never `error.message` — a tRPC error can carry
				    internal detail including database text. QueryErrorCard would be
				    the page-level shape, but it is a Card, and a bordered card inside
				    an already-bordered dialog is visible double chrome. Same call
				    AddVolunteerForm's inline error makes. */}
				<p className="text-muted-foreground">
					{safeErrorMessage(detail.error) ?? 'Please try again.'}
				</p>
				<Button
					variant="outline"
					size="sm"
					className="h-11"
					onClick={() => detail.refetch()}
					disabled={detail.isFetching}
				>
					Try again
				</Button>
			</div>
		);
	}

	const data = detail.data;
	if (!data) return null;

	// The server already truncated; `shiftCount` is the real total and is what
	// has to agree with the roster row's `Shifts` cell.
	const truncated = data.shiftCount - data.shifts.length;

	return (
		<div className="space-y-6">
			<dl className="grid grid-cols-2 gap-4">
				<Fact label="Email">
					{data.email ?? <span className="text-muted-foreground">—</span>}
				</Fact>
				<Fact label="Phone">
					{data.phone ?? <span className="text-muted-foreground">—</span>}
				</Fact>
				<Fact label="Added">
					{/* tabular-nums to match the same date in the roster row this
					    dialog drills into (page.tsx), per DESIGN.md. */}
					<span className="tabular-nums">
						{new Date(data.addedAt).toLocaleDateString()}
					</span>
					{/* The STAFF-voiced Record. The volunteer-voiced one reads
					    inverted here — "they approved your application" would mean
					    the volunteer approved the coordinator's. Both are Records
					    over the enum, so a third source is still a type error. */}
					<span className="block text-muted-foreground text-xs">
						{ORG_VOLUNTEER_SOURCE_COPY_STAFF[data.source]}
					</span>
				</Fact>
				<Fact label="Account">
					<VolunteerStatusBadge state={data.accountState} />
				</Fact>
			</dl>

			<div className="space-y-3">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h3 className="font-medium text-sm">Shifts with you</h3>
					{/* "with you" and "here" throughout: these figures are this org's
					    only. The volunteer's platform-wide total is a different number
					    and deliberately not shown — it is not this org's to report. */}
					<span className="text-muted-foreground text-sm tabular-nums">
						{data.shiftCount === 0
							? 'None yet'
							: `${data.shiftCount} attended · ${hoursLabel(data.totalHours)}`}
					</span>
				</div>

				{data.shiftCount === 0 ? (
					<p className="text-muted-foreground text-sm">
						No shifts recorded here yet. Hours appear once you mark someone
						attended.
					</p>
				) : (
					<>
						{/* A divided row list, not a Table: this same markup renders
						    inside a 375px bottom sheet, which is the sideways scroll T28
						    replaced this page's tables to remove. */}
						<ul className="divide-y rounded-md border">
							{data.shifts.map((shift) => (
								<li
									key={shift.shiftId}
									className="flex items-baseline justify-between gap-3 px-3 py-2"
								>
									<div className="min-w-0">
										<div className="truncate text-sm">{shift.title}</div>
										<div className="text-muted-foreground text-xs tabular-nums">
											{formatShiftDate(
												new Date(shift.startTime),
												new Date(shift.endTime),
											)}
										</div>
									</div>
									<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
										{hoursLabel(shift.hours)}
									</span>
								</li>
							))}
						</ul>
						{truncated > 0 ? (
							// Said out loud rather than silently cut. The total above
							// still counts these, which is the reason the cap is safe.
							<p className="text-muted-foreground text-xs">
								Showing the {SHIFT_HISTORY_WIRE_CAP} most recent of{' '}
								{data.shiftCount}. The totals above include all of them.
							</p>
						) : null}
					</>
				)}
			</div>
		</div>
	);
}

/**
 * Volunteer detail, opened by clicking a roster row.
 *
 * ONE instance, mounted by `page.tsx` and driven by `volunteerId` — not one per
 * row. Both the desktop table and the mobile card list are always in the DOM
 * (the switch is pure CSS), so a per-row dialog would mount twice per volunteer,
 * and removal from inside it would need its own copy of the page's Undo
 * bookkeeping. It therefore renders no `DialogTrigger`: the triggers live in
 * two different trees, which Radix's trigger model cannot express. The cost is
 * that focus-return on close is the page's job, not Radix's.
 *
 * It fetches its own data rather than being seeded from the roster row the
 * coordinator clicked. That is what makes the open dialog immune to the list
 * underneath it — searching, `Load more` or an invalidate after an unrelated
 * removal can all change or drop that row, and none of the FACTS move. The
 * clicked row's `displayName` is used only as a first-paint fallback for the
 * title, and is superseded by the query's own copy the moment it lands.
 *
 * Owns no mutation. `onRemove` is the page's, so the Undo toast, the removal
 * announcement and the roster refresh all behave identically whether Remove was
 * pressed in a table row or in this footer — and closing mid-flight cannot
 * orphan the callback, because nothing that matters unmounts with the dialog.
 */
export function VolunteerDetailDialog({
	volunteerId,
	displayName,
	onOpenChange,
	onRemove,
	removePending,
	onCloseAutoFocus,
}: {
	volunteerId: string | null;
	/**
	 * The clicked row's name, used for the title and the Remove button's
	 * accessible name so neither is blank while the query is in flight. It is
	 * the ONLY thing taken from the list — everything rendered as fact comes
	 * from the query.
	 */
	displayName: string | null;
	onOpenChange: (open: boolean) => void;
	onRemove: (volunteerId: string) => void;
	removePending: boolean;
	/**
	 * Forwarded to Radix's close-auto-focus event, which is the ONLY point at
	 * which focus can be placed on close: Radix restores focus itself as the
	 * focus scope unmounts, and with no `DialogTrigger` registered it restores
	 * to `<body>` — after, and therefore over the top of, anything an
	 * `onOpenChange` handler did. The page prevents the default there and hands
	 * focus back to the row instead.
	 */
	onCloseAutoFocus: (event: Event) => void;
}) {
	const open = volunteerId !== null;
	const isDesktop = useFrozenDesktopShell(open);

	// The query's own name once it lands, the clicked row's until then. The prop
	// alone was wrong in a way the docstring below denied: it is read on EVERY
	// render, not just in flight, so a refetch that dropped the row (a search, a
	// Load more) flipped the title to "Volunteer" and Remove's accessible name to
	// "Remove Volunteer from your roster" under an open dialog. This also gives
	// `VolunteerDetail.displayName` its only consumer.
	const detail = trpc.volunteers.getById.useQuery(
		{ volunteerId: volunteerId ?? '' },
		{ enabled: volunteerId !== null },
	);
	const title = detail.data?.displayName ?? displayName ?? TITLE_FALLBACK;
	const body = volunteerId ? <DetailBody volunteerId={volunteerId} /> : null;

	const removeButton = volunteerId ? (
		<RemoveVolunteerButton
			displayName={title}
			disabled={removePending}
			onRemove={() => onRemove(volunteerId)}
		/>
	) : null;

	if (isDesktop) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className="max-h-[85vh]"
					onCloseAutoFocus={onCloseAutoFocus}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{DESCRIPTION}</DialogDescription>
					</DialogHeader>
					{/* The BODY scrolls, not DialogContent. DialogContent's own dismiss
					    X is `absolute top-4 right-4` INSIDE that box, so scrolling the
					    box takes the only desktop dismiss control off-screen — and this
					    footer deliberately has no Close to fall back on. A 50-row
					    history scrolls routinely. `min-h-0` for the usual reason: a
					    flex/grid child will not shrink below its content without it. */}
					<div className="min-h-0 overflow-y-auto">{body}</div>
					{/* No Close button here: DialogContent renders its own dismiss X,
					    and a second control with the same accessible name is a rotor
					    reading "Close, Close". The Drawer below DOES need one — vaul
					    has no built-in dismiss, only a swipe and the overlay.
					    `justify-start` so the single remaining button does not sit in
					    the bottom-right slot the eye reads as "confirm". */}
					<DialogFooter className="sm:justify-start">
						{removeButton}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent onCloseAutoFocus={onCloseAutoFocus}>
				<DrawerHeader>
					<DrawerTitle>{title}</DrawerTitle>
					<DrawerDescription>{DESCRIPTION}</DrawerDescription>
				</DrawerHeader>
				{/* `min-h-0 overflow-y-auto` because DrawerContent is
				    `max-h-[85vh] flex flex-col` and drawer.tsx declares no overflow
				    utility anywhere — past the cap its children are compressed below
				    their content size and spill outside the painted sheet instead of
				    scrolling. `min-h-0` is not optional: a flex child will not shrink
				    below its content without it, so `overflow-y-auto` alone does
				    nothing. A long shift history is exactly what overflows here.
				    DrawerContent supplies no body padding either; only the header and
				    footer carry `p-4`. */}
				<div className="min-h-0 overflow-y-auto px-4 pb-4">{body}</div>
				{/* Document order [Remove, Close] in a plain column, so Remove sits
				    ABOVE Close and the destructive control is the one further from
				    the thumb. AddVolunteerDialog reverses its drawer footer;
				    deliberately not copied — that reversal exists to lift a SUBMIT
				    action to the bottom of the stack, and applying it here would put
				    "Remove from your roster" directly under the thumb. */}
				<DrawerFooter>
					{removeButton}
					{/* `outline`, matching AddVolunteerDialog's secondary button on the
					    same page — vaul supplies no dismiss X, so this IS the whole
					    affordance, and a ghost Close under an outline Remove makes the
					    destructive control the strongest thing on the sheet. */}
					<Button
						variant="outline"
						className="h-11"
						onClick={() => onOpenChange(false)}
					>
						Close
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
