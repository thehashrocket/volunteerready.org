'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
	Briefcase,
	Building2,
	CalendarClock,
	CheckCircle2,
	CircleAlert,
	CircleDashed,
	Clock,
	Copy,
	ExternalLink,
	Link2,
	ShieldCheck,
	Sparkles,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getCredentialMeta } from '@/lib/credential-meta';
import { formatDateOnly } from '@/lib/format-date';
import { trpc } from '@/lib/trpc/client';
import { NOTIFICATION_TYPE_LABELS } from '@/server/domain/notification';
import { MY_ORG_RELATIONSHIP_COPY } from '@/server/domain/org-volunteer';

// ---------------------------------------------------------------------------
// Interest chip-input (same pattern as SkillInput)
// ---------------------------------------------------------------------------

function ChipInput({
	items,
	onChange,
	max,
	placeholder,
}: {
	items: string[];
	onChange: (items: string[]) => void;
	max: number;
	placeholder: string;
}) {
	const [input, setInput] = useState('');

	function addItem(value: string) {
		const trimmed = value.trim().replace(/,+$/, '');
		if (!trimmed) return;
		if (items.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
		if (items.length >= max) return;
		onChange([...items, trimmed]);
		setInput('');
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addItem(input);
		} else if (e.key === 'Backspace' && !input && items.length > 0) {
			onChange(items.slice(0, -1));
		}
	}

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-1.5">
				{items.map((item) => (
					<span
						key={item}
						className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
					>
						{item}
						<button
							type="button"
							onClick={() => onChange(items.filter((s) => s !== item))}
							className="text-primary/60 hover:text-primary"
						>
							<X className="h-3 w-3" />
						</button>
					</span>
				))}
			</div>
			<Input
				value={input}
				onChange={(e) => {
					const val = e.target.value;
					if (val.endsWith(',')) {
						addItem(val);
					} else {
						setInput(val);
					}
				}}
				onKeyDown={handleKeyDown}
				onBlur={() => addItem(input)}
				placeholder={placeholder}
			/>
			<p className="text-xs text-muted-foreground">
				{items.length}/{max} — press Enter or comma to add
			</p>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Completeness indicator
// ---------------------------------------------------------------------------

function CompletenessBar({
	score,
	level,
	missing,
}: {
	score: number;
	level: string;
	missing: string[];
}) {
	const Icon =
		level === 'COMPLETE'
			? CheckCircle2
			: level === 'STRONG'
				? CheckCircle2
				: level === 'BASIC'
					? CircleDashed
					: CircleAlert;

	const color =
		level === 'COMPLETE'
			? 'text-success-foreground'
			: level === 'STRONG'
				? 'text-success'
				: level === 'BASIC'
					? 'text-warning'
					: 'text-muted-foreground';

	return (
		<Card>
			<CardContent className="py-4">
				<div className="flex items-center gap-3">
					<Icon className={`h-5 w-5 ${color}`} />
					<div className="flex-1">
						<div className="flex items-center justify-between text-sm font-medium">
							<span>Profile completeness</span>
							<span className={color}>{score}%</span>
						</div>
						<div className="mt-1 h-2 rounded-full bg-muted">
							<div
								className="h-2 rounded-full bg-primary transition-all"
								style={{ width: `${score}%` }}
							/>
						</div>
					</div>
				</div>
				{missing.length > 0 && (
					<p className="mt-2 text-xs text-muted-foreground">
						Missing: {missing.join(', ')}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const profileFormSchema = z.object({
	bio: z.string().max(500, 'Bio must be 500 characters or fewer').optional(),
	phone: z.string().max(30).optional(),
	city: z.string().max(100).optional(),
	state: z.string().max(100).optional(),
	country: z.string().max(100).optional(),
	availability: z.enum(['FLEXIBLE', 'WEEKDAYS', 'WEEKENDS', 'EVENINGS']),
	visibility: z.enum(['PUBLIC', 'ORGS_ONLY', 'PRIVATE']),
	interests: z.array(z.string()).max(20),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
	const qc = useQueryClient();
	const query = trpc.profile.getMyProfile.useQuery();
	const statsQuery = trpc.profile.getMyStats.useQuery();

	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileFormSchema),
		defaultValues: {
			bio: '',
			phone: '',
			city: '',
			state: '',
			country: '',
			availability: 'FLEXIBLE',
			visibility: 'ORGS_ONLY',
			interests: [],
		},
	});

	// Sync server data into form once loaded
	useEffect(() => {
		if (query.data?.profile) {
			const p = query.data.profile;
			form.reset({
				bio: p.bio ?? '',
				phone: p.phone ?? '',
				city: p.city ?? '',
				state: p.state ?? '',
				country: p.country ?? '',
				availability:
					(p.availability as ProfileFormValues['availability']) ?? 'FLEXIBLE',
				visibility:
					(p.visibility as ProfileFormValues['visibility']) ?? 'ORGS_ONLY',
				interests: p.interests ?? [],
			});
		}
	}, [query.data, form]);

	const mutation = trpc.profile.updateMyProfile.useMutation({
		onSuccess: async () => {
			toast.success('Profile saved.');
			await qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to save profile.');
		},
	});

	function onSubmit(values: ProfileFormValues) {
		mutation.mutate({
			bio: values.bio || null,
			phone: values.phone || null,
			city: values.city || null,
			state: values.state || null,
			country: values.country || null,
			availability: values.availability,
			visibility: values.visibility,
			interests: values.interests,
		});
	}

	const bio = form.watch('bio');

	if (query.isLoading) {
		return (
			<div className="mx-auto max-w-2xl space-y-6">
				<PageHeader
					title="My Profile"
					description="Manage your volunteer identity across organizations."
				/>
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground">
						Loading profile…
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="mx-auto max-w-2xl space-y-6">
				<PageHeader
					title="My Profile"
					description="Manage your volunteer identity across organizations."
				/>
				<Card>
					<CardContent className="space-y-4 py-8 text-center">
						<p className="text-sm text-destructive">{query.error.message}</p>
						<Button variant="outline" onClick={() => query.refetch()}>
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const completeness = query.data?.completeness;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<PageHeader
				title="My Profile"
				description="Manage your volunteer identity across organizations."
			/>

			{completeness && (
				<CompletenessBar
					score={completeness.score}
					level={completeness.level}
					missing={completeness.missing}
				/>
			)}

			{/* Quick Stats */}
			{statsQuery.data && (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
					<Link href="/app/my-applications" className="block">
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="flex items-center gap-3 py-3">
								<Briefcase className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-lg font-semibold">
										{statsQuery.data.applicationCount}
									</p>
									<p className="text-xs text-muted-foreground">Applications</p>
								</div>
							</CardContent>
						</Card>
					</Link>
					<Card>
						<CardContent className="flex items-center gap-3 py-3">
							<Building2 className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-lg font-semibold">
									{statsQuery.data.orgCount}
								</p>
								<p className="text-xs text-muted-foreground">Organizations</p>
							</div>
						</CardContent>
					</Card>
					<Link href="/app/my-skills" className="block">
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="flex items-center gap-3 py-3">
								<Sparkles className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-lg font-semibold">
										{statsQuery.data.skillCount}
									</p>
									<p className="text-xs text-muted-foreground">Skills</p>
								</div>
							</CardContent>
						</Card>
					</Link>
					<Card>
						<CardContent className="flex items-center gap-3 py-3">
							<ShieldCheck className="h-5 w-5 text-muted-foreground" />
							<div>
								<p className="text-lg font-semibold">
									{statsQuery.data.credentialCount}
								</p>
								<p className="text-xs text-muted-foreground">Verified</p>
							</div>
						</CardContent>
					</Card>
					<Link href="/app/my-shifts" className="block">
						<Card className="transition-colors hover:bg-muted/50">
							<CardContent className="flex items-center gap-3 py-3">
								<CalendarClock className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="text-lg font-semibold">
										{statsQuery.data.upcomingShiftCount}
									</p>
									<p className="text-xs text-muted-foreground">Shifts</p>
								</div>
							</CardContent>
						</Card>
					</Link>
				</div>
			)}

			<Tabs defaultValue="profile">
				<TabsList className="w-full">
					<TabsTrigger value="profile" className="flex-1">
						Profile
					</TabsTrigger>
					<TabsTrigger value="credentials" className="flex-1">
						Credentials
					</TabsTrigger>
					<TabsTrigger value="notifications" className="flex-1">
						Notifications
					</TabsTrigger>
				</TabsList>

				<TabsContent value="profile" className="space-y-6">
					{/* Above the form, and outside it. Outside because leaving a roster is
					    its own mutation and must not ride on, or be submitted by, the
					    profile save. Above because `sendRosterAddedEmail` links a
					    possibly-surprised recipient straight to /app/profile, and a
					    primary submit button reads as the end of a page — content past
					    "Save profile" is routinely never scrolled to. The one person this
					    section exists for should not have to hunt for it. */}
					<OrgMemberships />

					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						{/* About */}
						<Card>
							<CardHeader>
								<CardTitle>About</CardTitle>
								<CardDescription>
									Tell organizations a bit about yourself and why you volunteer.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="bio">Bio</Label>
									<Textarea
										id="bio"
										{...form.register('bio')}
										placeholder="A short bio about yourself…"
										maxLength={500}
										rows={4}
									/>
									{form.formState.errors.bio && (
										<p className="text-sm text-destructive">
											{form.formState.errors.bio.message}
										</p>
									)}
									<p className="text-right text-xs text-muted-foreground">
										{(bio ?? '').length}/500
									</p>
								</div>

								<div className="space-y-2">
									<Label>Interests</Label>
									<Controller
										control={form.control}
										name="interests"
										render={({ field }) => (
											<ChipInput
												items={field.value}
												onChange={field.onChange}
												max={20}
												placeholder="Type an interest and press Enter…"
											/>
										)}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Contact & Location */}
						<Card>
							<CardHeader>
								<CardTitle>Contact &amp; Location</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="phone">Phone</Label>
									<Input
										id="phone"
										{...form.register('phone')}
										placeholder="555-0123"
										maxLength={30}
									/>
								</div>
								<div className="grid gap-4 sm:grid-cols-3">
									<div className="space-y-2">
										<Label htmlFor="city">City</Label>
										<Input
											id="city"
											{...form.register('city')}
											placeholder="Portland"
											maxLength={100}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="state">State / Province</Label>
										<Input
											id="state"
											{...form.register('state')}
											placeholder="OR"
											maxLength={100}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="country">Country</Label>
										<Input
											id="country"
											{...form.register('country')}
											placeholder="US"
											maxLength={100}
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Preferences */}
						<Card>
							<CardHeader>
								<CardTitle>Preferences</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label>Availability</Label>
									<Controller
										control={form.control}
										name="availability"
										render={({ field }) => (
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="FLEXIBLE">Flexible</SelectItem>
													<SelectItem value="WEEKDAYS">Weekdays</SelectItem>
													<SelectItem value="WEEKENDS">Weekends</SelectItem>
													<SelectItem value="EVENINGS">Evenings</SelectItem>
												</SelectContent>
											</Select>
										)}
									/>
								</div>

								<div className="space-y-2">
									<Label>Profile visibility</Label>
									<Controller
										control={form.control}
										name="visibility"
										render={({ field }) => (
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="PUBLIC">
														Public — anyone can see
													</SelectItem>
													<SelectItem value="ORGS_ONLY">
														Organizations only — visible to orgs you've applied
														to
													</SelectItem>
													<SelectItem value="PRIVATE">
														Private — only you can see
													</SelectItem>
												</SelectContent>
											</Select>
										)}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Save */}
						<div className="flex items-center gap-2 pb-8">
							<Button type="submit" disabled={mutation.isPending}>
								{mutation.isPending ? 'Saving…' : 'Save profile'}
							</Button>
						</div>
					</form>
				</TabsContent>

				<TabsContent value="credentials">
					<CredentialWallet />
				</TabsContent>

				<TabsContent value="notifications">
					<NotificationPreferences />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Organizations you volunteer with — the roster memberships you can leave (T32)
// ---------------------------------------------------------------------------

/**
 * An org can put someone on its volunteer roster by typing their email address,
 * without their consent, and `sendRosterAddedEmail` tells them so and links
 * here. This section is the other half of that promise: the place they can
 * actually leave.
 *
 * Named "Organizations you volunteer with" rather than plain "Organizations"
 * because the stat card above already says "Organizations" and counts something
 * else entirely (`OrganizationMember` — staff membership).
 */
function OrgMemberships() {
	const memberships = trpc.profile.listMyOrgMemberships.useQuery();
	const utils = trpc.useUtils();
	const [confirmingId, setConfirmingId] = useState<string | null>(null);

	const leave = trpc.profile.leaveOrgRoster.useMutation({
		onSuccess: async () => {
			setConfirmingId(null);
			// Deliberately does not claim access was removed. It usually was, but
			// not for the ORG_MEMBER-exempt case (staff at their own org), and this
			// one string is shared by every row. The confirm above is where the
			// per-row promise is made, and it branches; the toast only confirms the
			// action happened.
			toast.success('You left that organization.');
			await utils.profile.listMyOrgMemberships.invalidate();
		},
		onError: (err) => {
			setConfirmingId(null);
			// safeErrorMessage, never raw err.message: there is no errorFormatter on
			// this tRPC instance, so an unexpected throw inside the service's
			// $transaction reaches the browser carrying the raw Prisma text
			// (constraint and column names). The allowlist keeps the hand-authored
			// NOT_FOUND copy and swaps anything internal for the fallback — which
			// `err.message ?? …` could never reach, since that field is always a
			// non-empty string.
			toast.error(safeErrorMessage(err) ?? 'Could not leave that roster.');
		},
	});

	// A failed load must never look like "you are on nobody's roster". This is a
	// consent surface, and a silent empty state is the one wrong answer it can
	// give — so the error branch renders before the empty check below.
	// QueryErrorCard rather than a hand-rolled card: it carries role="alert", so
	// a screen reader is actually told the surface failed rather than being shown
	// nothing, which is the same failure this ordering exists to prevent.
	if (memberships.isError) {
		return (
			<QueryErrorCard
				title="Couldn't load your organizations"
				message={safeErrorMessage(memberships.error)}
				onRetry={() => memberships.refetch()}
				isRetrying={memberships.isFetching}
			/>
		);
	}

	// Nothing is known yet, so assert nothing. A card that renders its empty state
	// and then fills in says "you are on nobody's roster" for the half-second it
	// is on screen — the same false statement the isError branch above exists to
	// prevent. Silence is the honest intermediate state; the resolved states below
	// both render the card.
	if (memberships.isLoading) return null;

	const rows = memberships.data ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Organizations you volunteer with</CardTitle>
				{/* Names capabilities, not just the list, because Leave revokes them —
				    a permissions surface has to say what the permissions are before
				    the button is pressed.

				    Background checks ARE named here. They were omitted at first, on
				    the reasoning that "they can request a background check" reads as a
				    threat about a capability most orgs never use, with the full list
				    kept for the confirm. Review inverted that: the card is the
				    stay-or-go decision and the confirm is reachable only by people
				    already leaving, so the omission showed the most consent-material
				    fact — the path that collects SSN and date of birth — only to those
				    who had decided to go, and hid it from everyone deciding to stay.
				    The alarm concern was real but is a FRAMING problem, so it is
				    solved by framing ("Leaving removes all of it") rather than by
				    omission. The email is still deliberately non-exhaustive; it is a
				    cold notice, not a decision surface (see sendRosterAddedEmail). */}
				<CardDescription>
					These organizations can schedule you for shifts, see your volunteer
					profile, and request a background check. Leaving removes all of it.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{/* The empty state is rendered, not skipped. Returning null here would
				    mean the card a volunteer was just reading vanishes the instant they
				    leave their last roster, leaving a transient toast as the only
				    evidence anything happened — and on a consent surface "gone" is
				    indistinguishable from "failed to render". It also keeps the surface
				    findable for someone following the roster email after staff already
				    removed them, which is otherwise a link to a page with no answer. */}
				{rows.length === 0 ? (
					<p aria-live="polite" className="text-sm text-muted-foreground">
						No organizations have access to your volunteer profile.
					</p>
				) : (
					/* aria-live: a row vanishing is the only confirmation that the leave
					   worked once the toast has gone, and a screen-reader user gets no
					   other statement of the resulting list state. */
					<ul aria-live="polite" className="divide-y rounded-md border">
						{rows.map((row) => {
							const isConfirming = confirmingId === row.orgId;
							const orgName = row.organization.name;

							return (
								<li
									key={row.orgId}
									className="flex flex-wrap items-center justify-between gap-3 p-3"
								>
									<div className="min-w-0 text-sm">
										<p className="break-words font-medium">{orgName}</p>
										{/* Promoted out of muted while confirming. --muted-foreground
									    on --card is ~4.16:1, under the 4.5:1 AA floor at this size
									    — tolerable for the resting metadata line ("Added by their
									    staff · Jul 3"), not for the only statement of what a
									    destructive, security-relevant action does. Styling the most
									    consequential sentence on the page as its least important
									    text tells the reader to skip it. */}
										<p
											className={
												isConfirming
													? 'text-foreground'
													: 'text-muted-foreground'
											}
										>
											{/* Question, then what CHANGES, then what persists, then
										    how to come back. Order matters: until the
										    OrgVolunteerBlock landed, leaving revoked nothing durable,
										    so these strings could only list what stayed the same —
										    and had to end on "they can add you again", the admission
										    that the control did not work. That clause is now
										    inverted to "add you back" and moved FIRST, because it is
										    the one that distinguishes this control from the version
										    that revoked nothing, and a skimmer stops reading before
										    a fourth list item.

										    The closing sentence is not a hedge. Three ordinary
										    volunteer actions lift the block (apply, claim, sign up
										    for a shift), and the marketplace is cross-org — someone
										    could hand access back months later without registering
										    whose listing they answered. Promising an absolute and
										    letting them discover it was conditional is the failure
										    this card exists to avoid. It also reads stronger: the
										    door is theirs, and they hold the key.

										    Still honest about what leaving does NOT undo. The
										    application is the consent-material one, so it leads on
										    the rows where it applies — same reasoning that corrected
										    the claim flow's decline row in v0.34.0.0.

										    The `isStaff` branch exists because the promise is FALSE
										    for that person: `findOrgVolunteerRelationship` exempts
										    ORG_MEMBER from the block, deliberately, so a coordinator
										    does not lock themselves out of their own org by leaving
										    its volunteer roster. Telling them access was removed when
										    it was not is exactly the overclaim this surface keeps
										    getting corrected for. */}
											{isConfirming
												? row.isStaff
													? `Leave ${orgName}'s volunteer roster? You're on their staff, so this does not change your staff access — they can still see your profile and schedule you. It only removes you from their volunteer list.`
													: row.reason === 'APPLIED'
														? "Leave and remove their access? They won't be able to add you back, schedule you, see your profile, or request a background check. Your application and any hours you've already volunteered stay with them. You can rejoin later by applying or signing up for one of their shifts."
														: "Leave and remove their access? They won't be able to add you back, schedule you, see your profile, or request a background check. Hours you've already volunteered stay recorded. You can rejoin later by applying or signing up for one of their shifts."
												: `${MY_ORG_RELATIONSHIP_COPY[row.reason]} · ${formatDateOnly(row.since)}`}
										</p>
									</div>

									{/* BOTH branches render a div wrapping the buttons, even though
								    the resting state has only one. React reconciles by element
								    type at each position: swapping <Button> for <div> unmounts
								    the focused trigger and drops focus to <body>, so a keyboard
								    user who activates Leave never reaches the confirm they just
								    summoned. Keeping the wrapper lets the index-0 button be
								    reused (Leave → Cancel) and focus survives. Same reason
								    my-applications/page.tsx wraps its single-button branch. */}
									{/* Every aria-label leads with the button's VISIBLE text, then
								    adds the org as context — the `Label: context` idiom from
								    my-applications. Voice control matches what the user reads
								    (WCAG 2.5.3), and a screen reader still hears which org each
								    of N identically-labelled buttons acts on. The confirm's
								    visible text is "Yes, leave" rather than a second "Leave" so
								    the armed control is never announced identically to the one
								    that merely arms it. */}
									{isConfirming ? (
										<div className="flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												className="h-11"
												disabled={leave.isPending}
												onClick={() => setConfirmingId(null)}
												aria-label={`Cancel: stay on the roster for ${orgName}`}
											>
												Cancel
											</Button>
											<Button
												size="sm"
												variant="destructive"
												className="h-11"
												disabled={leave.isPending}
												onClick={() => leave.mutate({ orgId: row.orgId })}
												aria-label={`Yes, leave: ${orgName}`}
											>
												{leave.isPending ? 'Leaving…' : 'Yes, leave'}
											</Button>
										</div>
									) : (
										<div className="flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												className="h-11"
												disabled={leave.isPending}
												onClick={() => setConfirmingId(row.orgId)}
												aria-label={`Leave: ${orgName}`}
											>
												Leave
											</Button>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------

function NotificationPreferences() {
	const prefsQuery = trpc.notifications.getPreferences.useQuery();
	const digestQuery = trpc.notifications.getDigestPreference.useQuery();
	const utils = trpc.useUtils();

	const updatePref = trpc.notifications.updatePreference.useMutation({
		onSuccess: () => {
			utils.notifications.getPreferences.invalidate();
			toast.success('Preferences saved.');
		},
		onError: (err) => toast.error(err.message),
	});

	const updateDigest = trpc.notifications.updateDigestPreference.useMutation({
		onSuccess: () => {
			utils.notifications.getDigestPreference.invalidate();
			toast.success('Preferences saved.');
		},
		onError: (err) => toast.error(err.message),
	});

	if (prefsQuery.isLoading || digestQuery.isLoading) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground">
					Loading preferences…
				</CardContent>
			</Card>
		);
	}

	// Build a map of current preferences
	const prefMap = new Map((prefsQuery.data ?? []).map((p) => [p.type, p]));

	// Notification types to show (skip FIRST_APPLICATION — org-only, no user control)
	const types = Object.entries(NOTIFICATION_TYPE_LABELS).filter(
		([key]) => key !== 'FIRST_APPLICATION',
	);

	return (
		<div className="space-y-6">
			{/* Per-type preferences */}
			<Card>
				<CardHeader>
					<CardTitle>Notification Preferences</CardTitle>
					<CardDescription>
						Choose how you want to receive notifications. Changes save
						automatically.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-1">
						<div className="grid grid-cols-[1fr_64px_64px] items-center gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
							<span>Type</span>
							<span className="text-center">In-app</span>
							<span className="text-center">Email</span>
						</div>
						{types.map(([type, label]) => {
							const pref = prefMap.get(
								type as keyof typeof NOTIFICATION_TYPE_LABELS,
							);
							const inApp = pref?.inApp ?? true;
							const email = pref?.email ?? true;
							return (
								<div
									key={type}
									className="grid grid-cols-[1fr_64px_64px] items-center gap-2 border-b py-2 last:border-0"
								>
									<span className="text-sm">{label}</span>
									<div className="flex justify-center">
										<button
											type="button"
											role="switch"
											aria-checked={inApp}
											className={`h-5 w-9 rounded-full transition-colors ${inApp ? 'bg-primary' : 'bg-muted'}`}
											onClick={() =>
												updatePref.mutate({
													type: type as keyof typeof NOTIFICATION_TYPE_LABELS,
													inApp: !inApp,
													email,
												})
											}
										>
											<span
												className={`block h-4 w-4 rounded-full bg-white transition-transform ${inApp ? 'translate-x-4' : 'translate-x-0.5'}`}
											/>
										</button>
									</div>
									<div className="flex justify-center">
										<button
											type="button"
											role="switch"
											aria-checked={email}
											className={`h-5 w-9 rounded-full transition-colors ${email ? 'bg-primary' : 'bg-muted'}`}
											onClick={() =>
												updatePref.mutate({
													type: type as keyof typeof NOTIFICATION_TYPE_LABELS,
													inApp,
													email: !email,
												})
											}
										>
											<span
												className={`block h-4 w-4 rounded-full bg-white transition-transform ${email ? 'translate-x-4' : 'translate-x-0.5'}`}
											/>
										</button>
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Digest frequency */}
			<Card>
				<CardHeader>
					<CardTitle>Email Digest</CardTitle>
					<CardDescription>
						Receive a summary of your notifications instead of individual
						emails.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Select
						value={digestQuery.data?.digestFrequency ?? 'WEEKLY'}
						onValueChange={(val) =>
							updateDigest.mutate({
								digestFrequency: val as 'OFF' | 'DAILY' | 'WEEKLY',
							})
						}
					>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="OFF">Off</SelectItem>
							<SelectItem value="DAILY">Daily</SelectItem>
							<SelectItem value="WEEKLY">Weekly</SelectItem>
						</SelectContent>
					</Select>
				</CardContent>
			</Card>
		</div>
	);
}

const statusVariant: Record<
	string,
	'success' | 'warning' | 'neutral' | 'destructive'
> = {
	VERIFIED: 'success',
	PENDING: 'warning',
	EXPIRED: 'neutral',
	REVOKED: 'destructive',
};

// ---------------------------------------------------------------------------
// Credential Wallet — full credential management with share links
// ---------------------------------------------------------------------------

function CredentialWallet() {
	const credQuery = trpc.credentials.getMyCredentials.useQuery();
	const tokensQuery = trpc.credentialSharing.listMyTokens.useQuery();
	const userIdQuery = trpc.profile.getMyUserId.useQuery();

	const generateMutation = trpc.credentialSharing.generate.useMutation({
		onSuccess: (data) => {
			const url = `${window.location.origin}/credentials/claim/${data.rawToken}`;
			navigator.clipboard.writeText(url).then(() => {
				toast.success('Share link copied to clipboard.');
			});
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to generate share link.');
		},
	});

	const revokeMutation = trpc.credentialSharing.revoke.useMutation({
		onSuccess: async () => {
			toast.success('Share link revoked.');
			await tokensQuery.refetch();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to revoke link.');
		},
	});

	if (credQuery.isLoading) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground">
					Loading credentials…
				</CardContent>
			</Card>
		);
	}

	const credentials = credQuery.data ?? [];
	const tokens = tokensQuery.data ?? [];

	if (credentials.length === 0) {
		return (
			<EmptyState
				icon={ShieldCheck}
				title="No credentials yet"
				description="Credentials will appear here once an organization verifies your background check, training, or other qualifications."
			/>
		);
	}

	const userId = userIdQuery.data?.userId;

	return (
		<div className="space-y-4">
			{/* Share card banner */}
			{userId && (
				<Card className="border-primary/20 bg-primary/5">
					<CardContent className="flex items-center justify-between gap-4 py-4">
						<div>
							<p className="font-medium text-sm">Share your volunteer card</p>
							<p className="text-xs text-muted-foreground">
								Your verified credentials and impact stats in one shareable
								link.
							</p>
						</div>
						<Button variant="outline" size="sm" asChild>
							<a
								href={`/v/${userId}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1.5"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								View card
							</a>
						</Button>
					</CardContent>
				</Card>
			)}

			{credentials.map((cred) => {
				const meta = getCredentialMeta(cred.type);
				const Icon = meta.icon;
				const credTokens = tokens.filter(
					(t) => t.credentialId === cred.id && t.status === 'ACTIVE',
				);

				return (
					<Card key={cred.id}>
						<CardContent className="py-4">
							<div className="flex items-start justify-between gap-4">
								<div className="flex items-start gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
										<Icon className="h-5 w-5 text-primary" />
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">{meta.label}</span>
											<Badge variant={statusVariant[cred.status] ?? 'outline'}>
												{cred.status}
											</Badge>
										</div>
										<p className="mt-0.5 text-xs text-muted-foreground">
											{cred.organization.name}
										</p>
										{cred.sharedFromOrg && (
											<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
												<Link2 className="h-3 w-3" />
												Shared from {cred.sharedFromOrg.name}
											</p>
										)}
										{cred.expiresAt && (
											<p className="mt-0.5 text-xs text-muted-foreground">
												Expires {new Date(cred.expiresAt).toLocaleDateString()}
											</p>
										)}
									</div>
								</div>

								{cred.status === 'VERIFIED' && (
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											generateMutation.mutate({
												credentialId: cred.id,
											})
										}
										disabled={generateMutation.isPending}
									>
										<Copy className="mr-1 h-4 w-4" />
										Share
									</Button>
								)}
							</div>

							{/* Active share tokens for this credential */}
							{credTokens.length > 0 && (
								<div className="mt-3 space-y-2 border-t pt-3">
									<p className="text-xs font-medium text-muted-foreground">
										Active share links
									</p>
									{credTokens.map((token) => {
										const daysLeft = Math.max(
											0,
											Math.ceil(
												(new Date(token.expiresAt).getTime() - Date.now()) /
													(1000 * 60 * 60 * 24),
											),
										);
										return (
											<div
												key={token.id}
												className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs"
											>
												<span className="flex items-center gap-1.5">
													<Clock className="h-3 w-3" />
													<span
														className={
															daysLeft <= 7 ? 'font-medium text-amber-600' : ''
														}
													>
														{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
													</span>
												</span>
												<Button
													size="sm"
													variant="ghost"
													className="h-6 px-2 text-xs text-destructive hover:text-destructive"
													onClick={() =>
														revokeMutation.mutate({ tokenId: token.id })
													}
													disabled={revokeMutation.isPending}
												>
													Revoke
												</Button>
											</div>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
