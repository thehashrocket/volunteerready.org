'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, RefreshCw, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
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

function RoleBadge({ role }: { role: string }) {
	const variant =
		role === 'OWNER' ? 'default' : role === 'ADMIN' ? 'secondary' : 'outline';
	return <Badge variant={variant}>{ROLE_LABELS[role] ?? role}</Badge>;
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
			toast.error(err.message ?? 'Failed to send invitation.');
		},
	});

	const removeMutation = trpc.members.removeMember.useMutation({
		onSuccess: () => {
			toast.success('Member removed.');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to remove member.');
		},
	});

	const updateRoleMutation = trpc.members.updateRole.useMutation({
		onSuccess: () => {
			toast.success('Role updated.');
			void qc.invalidateQueries();
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to update role.');
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
				<Card>
					<CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
						<p>{query.error.message}</p>
						<Button onClick={() => query.refetch()} variant="outline" size="sm">
							<RefreshCw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
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
								{members.map((member) => {
									const isCurrentUser = member.user.email === currentUserEmail;
									const isOwnerRow = member.role === 'OWNER';
									const isPending =
										removeMutation.isPending || updateRoleMutation.isPending;

									return (
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
												{!isOwnerRow && !isCurrentUser ? (
													<div className="flex items-center justify-end gap-2">
														{/* Role selector */}
														<Select
															value={member.role}
															disabled={isPending}
															onValueChange={(newRole) =>
																updateRoleMutation.mutate({
																	memberId: member.id,
																	role: newRole as
																		| 'ADMIN'
																		| 'STAFF'
																		| 'READONLY',
																})
															}
														>
															<SelectTrigger className="h-8 w-32 text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{isOwner && (
																	<SelectItem value="ADMIN">Admin</SelectItem>
																)}
																<SelectItem value="STAFF">Staff</SelectItem>
																<SelectItem value="READONLY">
																	Read-only
																</SelectItem>
															</SelectContent>
														</Select>

														{/* Remove button */}
														<Button
															variant="outline"
															size="sm"
															disabled={isPending}
															onClick={() =>
																removeMutation.mutate({
																	memberId: member.id,
																})
															}
														>
															Remove
														</Button>
													</div>
												) : (
													<span className="text-xs text-muted-foreground">
														{isCurrentUser ? 'You' : '—'}
													</span>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
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
			toast.error(err.message ?? 'Failed to update timezone.');
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
