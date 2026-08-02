'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Globe, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CardList } from '@/components/app/card-list';
import {
	QueryErrorCard,
	safeErrorMessage,
} from '@/components/app/query-error-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePendingIds } from '@/lib/hooks/use-pending-ids';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
	OWNER: 'Owner',
	ADMIN: 'Admin',
	STAFF: 'Staff',
	READONLY: 'Read-only',
};

function RoleBadge({ role, className }: { role: string; className?: string }) {
	const variant =
		role === 'OWNER' ? 'default' : role === 'ADMIN' ? 'secondary' : 'outline';
	return (
		<Badge variant={variant} className={className}>
			{ROLE_LABELS[role] ?? role}
		</Badge>
	);
}

type Member = {
	id: string;
	role: string;
	user: { id: string; name: string | null; email: string | null };
};

function memberLabel(member: Member): string {
	return member.user.name ?? member.user.email ?? 'this member';
}

/**
 * The role selector and Remove, shared by the table and the card list.
 *
 * Extracted rather than written twice because the interesting part is not the
 * markup, it is WHO may be managed: never the OWNER row, never yourself, and
 * `ADMIN` is only offered by an OWNER. Two copies of that is one copy that
 * eventually disagrees, on a permissions surface.
 *
 * All three of those are AFFORDANCES, not controls — every one has a server-side
 * counterpart in `memberService.ts` (`assertMayGrantRole` for the ADMIN tier,
 * plus the OWNER-target and self checks in both `updateOrgMemberRole` and
 * `removeOrgMember`). `isOwner` in particular is derived from the session email,
 * which is the REAL admin's under impersonation, so it is the wrong person's
 * role on that path — harmless precisely because it decides nothing. Do not add
 * a fourth rule here without adding it there first.
 *
 * `compact` is the table; the card gets the repo's 44px targets, since a role
 * change and a removal are both one-tap-and-done on a phone.
 */
function MemberRowActions({
	member,
	isOwner,
	isCurrentUser,
	isPending,
	compact,
	onRoleChange,
	onRemove,
	className,
}: {
	member: Member;
	isOwner: boolean;
	isCurrentUser: boolean;
	isPending: boolean;
	compact?: boolean;
	onRoleChange: (role: 'ADMIN' | 'STAFF' | 'READONLY') => void;
	onRemove: () => void;
	className?: string;
}) {
	if (member.role === 'OWNER' || isCurrentUser) {
		return (
			<span className="text-xs text-muted-foreground">
				{isCurrentUser ? 'You' : '—'}
			</span>
		);
	}

	const label = memberLabel(member);
	return (
		<div className={className}>
			<Select
				value={member.role}
				disabled={isPending}
				onValueChange={(newRole) =>
					onRoleChange(newRole as 'ADMIN' | 'STAFF' | 'READONLY')
				}
			>
				{/* Both controls are duplicated across the two trees, so a bare
				    "Remove" or an unnamed combobox would list N identical entries in
				    a rotor. Only the accessible names carry the target; the visible
				    text stays as the mockups have it. */}
				<SelectTrigger
					aria-label={`Role for ${label}`}
					className={compact ? 'h-8 w-32 text-xs' : 'h-11 flex-1 text-xs'}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{isOwner && <SelectItem value="ADMIN">Admin</SelectItem>}
					<SelectItem value="STAFF">Staff</SelectItem>
					<SelectItem value="READONLY">Read-only</SelectItem>
				</SelectContent>
			</Select>

			<Button
				variant="outline"
				size={compact ? 'sm' : 'default'}
				aria-label={`Remove ${label} from this organization`}
				className={compact ? undefined : 'h-11'}
				disabled={isPending}
				onClick={onRemove}
			>
				Remove
			</Button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeamPage() {
	const { data: session } = useSession();
	const qc = useQueryClient();
	const currentUserEmail = session?.user?.email ?? '';

	const [inviteEmail, setInviteEmail] = useState('');
	const [inviteRole, setInviteRole] = useState<string>('STAFF');

	const query = trpc.members.list.useQuery();

	const inviteMutation = trpc.members.invite.useMutation({
		onSuccess: () => {
			toast.success('Invitation sent.');
			setInviteEmail('');
			setInviteRole('STAFF');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to send invitation.');
		},
	});

	const pending = usePendingIds();
	const removeMutation = trpc.members.removeMember.useMutation({
		onMutate: (vars) => pending.start(vars.memberId),
		onSettled: (_data, _err, vars) => pending.finish(vars.memberId),
		onSuccess: () => {
			toast.success('Member removed.');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to remove member.');
		},
	});

	const updateRoleMutation = trpc.members.updateRole.useMutation({
		onMutate: (vars) => pending.start(vars.memberId),
		onSettled: (_data, _err, vars) => pending.finish(vars.memberId),
		onSuccess: () => {
			toast.success('Role updated.');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to update role.');
		},
	});

	// Determine current user's role from the members list
	const members = query.data ?? [];
	const currentMember = members.find((m) => m.user.email === currentUserEmail);
	const currentUserRole = currentMember?.role ?? null;
	const isOwner = currentUserRole === 'OWNER';

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader title="Team members" description="Loading…" />
				<Card>
					<CardContent className="space-y-2 pt-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	if (query.isError) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Team members"
					description="Could not load members."
				/>
				<QueryErrorCard
					title="Could not load members"
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
				title="Team members"
				description={`${members.length} member${members.length === 1 ? '' : 's'}`}
			/>

			{/* Members table */}
			{members.length === 0 ? (
				<EmptyState
					title="No members yet"
					description="Invite someone below to get started."
					icon={Users}
				/>
			) : (
				<>
					{/* Both trees render from the same array and are switched by CSS,
					    never by `useMediaQuery`: that hook initialises to `false` and
					    only resolves in an effect, so gating the LIST on it paints the
					    card shape to every desktop user and swaps it after hydration.
					    `display: none` also removes the hidden tree from the
					    accessibility tree, so exactly one role selector and one Remove
					    per member is ever reachable.

					    Visibility goes on a wrapper, never on `Card`/`CardList` —
					    `hidden` and Card's own `flex` are both display utilities, so
					    tailwind-merge keeps one and drops the other. */}
					<div className="hidden lg:block" data-testid="team-table">
						<Card>
							<CardHeader>
								<CardTitle>Members</CardTitle>
							</CardHeader>
							<CardContent>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Member</TableHead>
											<TableHead>Role</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{members.map((member) => (
											<TableRow key={member.id}>
												<TableCell>
													<p className="font-medium">
														{member.user.name ?? member.user.email}
													</p>
													{member.user.name && (
														<p className="text-xs text-muted-foreground">
															{member.user.email}
														</p>
													)}
												</TableCell>
												<TableCell>
													<RoleBadge role={member.role} />
												</TableCell>
												<TableCell className="text-right">
													<MemberRowActions
														member={member}
														isOwner={isOwner}
														isCurrentUser={
															member.user.email === currentUserEmail
														}
														isPending={pending.has(member.id)}
														compact
														className="flex items-center justify-end gap-2"
														onRoleChange={(role) =>
															updateRoleMutation.mutate({
																memberId: member.id,
																role,
															})
														}
														onRemove={() =>
															removeMutation.mutate({ memberId: member.id })
														}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>

					{/* The narrowest of the five tables — name, role, two controls — so
					    nothing has to drop. The controls move to their own row beneath
					    the name rather than sharing it: a 32px select and a Remove
					    button side by side with a name leaves all three too narrow to
					    read or hit. */}
					<div className="lg:hidden" data-testid="team-card-list">
						<CardList>
							<div className="px-4 py-3 font-semibold">Members</div>
							{members.map((member) => (
								<div key={member.id} className="flex flex-col gap-3 px-4 py-3">
									<div className="flex items-start justify-between gap-2">
										{/* min-w-0 so truncate engages inside the flex row: a long
										    name or address otherwise widens the card past the
										    viewport, which is the sideways scroll this layout
										    exists to remove. */}
										<div className="min-w-0">
											<p className="truncate font-medium">
												{member.user.name ?? member.user.email}
											</p>
											{member.user.name && (
												<p className="truncate text-xs text-muted-foreground">
													{member.user.email}
												</p>
											)}
										</div>
										<RoleBadge role={member.role} className="shrink-0" />
									</div>

									<MemberRowActions
										member={member}
										isOwner={isOwner}
										isCurrentUser={member.user.email === currentUserEmail}
										isPending={pending.has(member.id)}
										className="flex items-center gap-2"
										onRoleChange={(role) =>
											updateRoleMutation.mutate({ memberId: member.id, role })
										}
										onRemove={() =>
											removeMutation.mutate({ memberId: member.id })
										}
									/>
								</div>
							))}
						</CardList>
					</div>
				</>
			)}

			{/* Invite form */}
			<Card>
				<CardHeader>
					<CardTitle>Invite a new member</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className="flex flex-col gap-4 sm:flex-row sm:items-end"
						onSubmit={(e) => {
							e.preventDefault();
							if (!inviteEmail) return;
							inviteMutation.mutate({
								email: inviteEmail,
								role: inviteRole as 'ADMIN' | 'STAFF' | 'READONLY',
							});
						}}
					>
						<div className="flex-1 space-y-1.5">
							<Label htmlFor="invite-email">Email address</Label>
							<Input
								id="invite-email"
								type="email"
								placeholder="volunteer@example.com"
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="invite-role">Role</Label>
							<Select value={inviteRole} onValueChange={setInviteRole}>
								<SelectTrigger id="invite-role" className="w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{isOwner && <SelectItem value="ADMIN">Admin</SelectItem>}
									<SelectItem value="STAFF">Staff</SelectItem>
									<SelectItem value="READONLY">Read-only</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<Button
							type="submit"
							disabled={inviteMutation.isPending || !inviteEmail}
						>
							{inviteMutation.isPending ? 'Sending…' : 'Send invite'}
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Timezone settings */}
			<TimezoneCard />

			{/* Marketplace settings */}
			<MarketplaceCard />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Timezone Card
// ---------------------------------------------------------------------------

const COMMON_TIMEZONES = [
	'UTC',
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'America/Anchorage',
	'Pacific/Honolulu',
	'Europe/London',
	'Europe/Paris',
	'Europe/Berlin',
	'Asia/Tokyo',
	'Asia/Shanghai',
	'Asia/Kolkata',
	'Australia/Sydney',
];

// ---------------------------------------------------------------------------
// Marketplace Card
// ---------------------------------------------------------------------------

function MarketplaceCard() {
	const orgQuery = trpc.org.getCurrentOrg.useQuery();
	const qc = useQueryClient();

	const updateMutation = trpc.org.updateMarketplaceSettings.useMutation({
		onSuccess: () => {
			toast.success('Marketplace settings saved.');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(
				safeErrorMessage(err) ?? 'Failed to save marketplace settings.',
			);
		},
	});

	const org = orgQuery.data;
	const isLoading = orgQuery.isLoading || updateMutation.isPending;

	if (orgQuery.isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Globe className="h-4 w-4" />
						Marketplace
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Skeleton className="h-8 w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Globe className="h-4 w-4" />
					Marketplace
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Visibility toggle */}
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<Label
							htmlFor="marketplace-visible"
							className="text-sm font-medium"
						>
							List on public marketplace
						</Label>
						<p className="text-xs text-muted-foreground">
							When enabled, your published opportunities appear on{' '}
							<a href="/opportunities" className="underline">
								volunteerready.org/opportunities
							</a>{' '}
							for anyone to find.
						</p>
					</div>
					<Switch
						id="marketplace-visible"
						checked={org?.marketplaceVisible ?? false}
						disabled={isLoading}
						onCheckedChange={(checked) =>
							updateMutation.mutate({ marketplaceVisible: checked })
						}
					/>
				</div>

				{org?.marketplaceVisible && (
					<>
						{/* Description */}
						<div className="space-y-1.5">
							<Label htmlFor="org-description">Organization description</Label>
							<Textarea
								id="org-description"
								rows={3}
								maxLength={500}
								placeholder="A short description of your organization and the work you do…"
								defaultValue={org?.description ?? ''}
								disabled={isLoading}
								onBlur={(e) => {
									const val = e.target.value.trim() || null;
									if (val !== (org?.description ?? null)) {
										updateMutation.mutate({ description: val });
									}
								}}
							/>
							<p className="text-xs text-muted-foreground">
								Shown on the organizations discovery page. Max 500 characters.
							</p>
						</div>

						{/* Location */}
						<div className="space-y-1.5">
							<Label htmlFor="org-location">Location</Label>
							<Input
								id="org-location"
								placeholder="e.g. Fresno, CA"
								maxLength={100}
								defaultValue={org?.location ?? ''}
								disabled={isLoading}
								onBlur={(e) => {
									const val = e.target.value.trim() || null;
									if (val !== (org?.location ?? null)) {
										updateMutation.mutate({ location: val });
									}
								}}
							/>
						</div>

						{/* Cause area tags */}
						<div className="space-y-1.5">
							<Label htmlFor="org-cause-tags">Cause areas</Label>
							<Input
								id="org-cause-tags"
								placeholder="e.g. Environment, Education, Animals"
								maxLength={200}
								defaultValue={(org?.causeAreaTags ?? []).join(', ')}
								disabled={isLoading}
								onBlur={(e) => {
									const tags = e.target.value
										.split(',')
										.map((t) => t.trim())
										.filter(Boolean)
										.slice(0, 10);
									updateMutation.mutate({ causeAreaTags: tags });
								}}
							/>
							<p className="text-xs text-muted-foreground">
								Comma-separated. Up to 10 tags.
							</p>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

function getTimezoneOptions(): string[] {
	try {
		return Intl.supportedValuesOf('timeZone');
	} catch {
		return COMMON_TIMEZONES;
	}
}

function TimezoneCard() {
	const orgQuery = trpc.org.getCurrentOrg.useQuery();
	const qc = useQueryClient();
	const timezones = useMemo(() => getTimezoneOptions(), []);
	const [open, setOpen] = useState(false);

	const updateTz = trpc.org.updateTimezone.useMutation({
		onSuccess: () => {
			toast.success('Timezone updated.');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(safeErrorMessage(err) ?? 'Failed to update timezone.');
		},
	});

	const currentTz = orgQuery.data?.timezone ?? null;
	const displayLabel = currentTz
		? currentTz.replace(/_/g, ' ')
		: 'UTC (default)';
	const isDisabled = updateTz.isPending || orgQuery.isLoading;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Organization timezone</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="mb-3 text-sm text-muted-foreground">
					Controls when digest emails and shift reminders are sent.
					Notifications arrive at local morning time for your organization.
				</p>
				<div className="space-y-1.5">
					<Label>Timezone</Label>
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								aria-expanded={open}
								disabled={isDisabled}
								className="w-full justify-between sm:w-72"
							>
								{displayLabel}
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 sm:w-72">
							<Command>
								<CommandInput placeholder="Search timezones…" />
								<CommandList>
									<CommandEmpty>No timezone found.</CommandEmpty>
									<CommandGroup>
										<CommandItem
											value="UTC (default)"
											onSelect={() => {
												updateTz.mutate({ timezone: null });
												setOpen(false);
											}}
										>
											<Check
												className={`mr-2 h-4 w-4 ${currentTz === null ? 'opacity-100' : 'opacity-0'}`}
											/>
											UTC (default)
										</CommandItem>
										{timezones.map((tz) => (
											<CommandItem
												key={tz}
												value={tz.replace(/_/g, ' ')}
												onSelect={() => {
													updateTz.mutate({ timezone: tz });
													setOpen(false);
												}}
											>
												<Check
													className={`mr-2 h-4 w-4 ${currentTz === tz ? 'opacity-100' : 'opacity-0'}`}
												/>
												{tz.replace(/_/g, ' ')}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				</div>
			</CardContent>
		</Card>
	);
}
