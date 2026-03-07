'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	Card,
	CardContent,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

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
		role === 'OWNER'
			? 'default'
			: role === 'ADMIN'
				? 'secondary'
				: 'outline';
	return (
		<Badge variant={variant}>{ROLE_LABELS[role] ?? role}</Badge>
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
	const currentMember = members.find(
		(m) => m.user.email === currentUserEmail,
	);
	const currentUserRole = currentMember?.role ?? null;
	const isOwner = currentUserRole === 'OWNER';

	if (query.isLoading) {
		return (
			<div className="space-y-6">
				<PageHeader
					title="Team members"
					description="Loading…"
				/>
				<Card>
					<CardContent className="pt-6 text-sm text-muted-foreground">
						Fetching team members…
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
						<Button
							onClick={() => query.refetch()}
							variant="outline"
						>
							<RefreshCw className="h-4 w-4" />
							Try again
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-8">
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
									<TableHead className="text-right">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{members.map((member) => {
									const isCurrentUser =
										member.user.email === currentUserEmail;
									const isOwnerRow =
										member.role === 'OWNER';
									const isPending =
										removeMutation.isPending ||
										updateRoleMutation.isPending;

									return (
										<TableRow key={member.id}>
											<TableCell>
												<p className="font-medium">
													{member.user.name ??
														member.user.email}
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
															onValueChange={(
																newRole,
															) =>
																updateRoleMutation.mutate(
																	{
																		memberId:
																			member.id,
																		role: newRole as
																			| 'ADMIN'
																			| 'STAFF'
																			| 'READONLY',
																	},
																)
															}
														>
															<SelectTrigger className="h-8 w-32 text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{isOwner && (
																	<SelectItem value="ADMIN">
																		Admin
																	</SelectItem>
																)}
																<SelectItem value="STAFF">
																	Staff
																</SelectItem>
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
																removeMutation.mutate(
																	{
																		memberId:
																			member.id,
																	},
																)
															}
														>
															Remove
														</Button>
													</div>
												) : (
													<span className="text-xs text-muted-foreground">
														{isCurrentUser
															? 'You'
															: '—'}
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
							<Label htmlFor="invite-email">
								Email address
							</Label>
							<Input
								id="invite-email"
								type="email"
								placeholder="volunteer@example.com"
								value={inviteEmail}
								onChange={(e) =>
									setInviteEmail(e.target.value)
								}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="invite-role">Role</Label>
							<Select
								value={inviteRole}
								onValueChange={setInviteRole}
							>
								<SelectTrigger
									id="invite-role"
									className="w-36"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{isOwner && (
										<SelectItem value="ADMIN">
											Admin
										</SelectItem>
									)}
									<SelectItem value="STAFF">
										Staff
									</SelectItem>
									<SelectItem value="READONLY">
										Read-only
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<Button
							type="submit"
							disabled={
								inviteMutation.isPending || !inviteEmail
							}
						>
							{inviteMutation.isPending
								? 'Sending…'
								: 'Send invite'}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
