'use client';

import { ChevronLeft, Loader2, ShieldCheck, UserCog } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc/client';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-xs uppercase tracking-wide text-muted-foreground">
				{label}
			</dt>
			<dd className="text-sm">{value}</dd>
		</div>
	);
}

export default function PlatformUserDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [tab, setTab] = useState('overview');
	const { data: session } = useSession();
	const currentUserId = session?.user?.id;

	const utils = trpc.useUtils();
	const { data, isLoading, isError } = trpc.platformAdmin.users.get.useQuery({
		id,
	});

	const setAdminMutation =
		trpc.platformAdmin.users.setPlatformAdmin.useMutation({
			onSuccess: () => utils.platformAdmin.users.get.invalidate({ id }),
		});
	const revokeSessionsMutation =
		trpc.platformAdmin.users.revokeAllSessions.useMutation({
			onSuccess: () => utils.platformAdmin.users.get.invalidate({ id }),
		});

	const [adminModalOpen, setAdminModalOpen] = useState(false);
	const [adminReason, setAdminReason] = useState('');
	const [revokeModalOpen, setRevokeModalOpen] = useState(false);
	const [revokeReason, setRevokeReason] = useState('');
	const [impersonateModalOpen, setImpersonateModalOpen] = useState(false);
	const [impersonateReason, setImpersonateReason] = useState('');
	const [impersonateError, setImpersonateError] = useState<string | null>(null);
	const [impersonateLoading, setImpersonateLoading] = useState(false);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (isError || !data) {
		return (
			<div className="mx-auto max-w-5xl p-6">
				<Card className="p-6 text-sm text-destructive">User not found.</Card>
			</div>
		);
	}

	async function handleImpersonate() {
		setImpersonateError(null);
		setImpersonateLoading(true);
		try {
			const res = await fetch('/api/platform-admin/impersonation/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetId: id, reason: impersonateReason }),
			});
			if (!res.ok) {
				let message = 'Failed to start impersonation';
				const contentType = res.headers.get('content-type') ?? '';
				if (contentType.includes('application/json')) {
					const payload = await res.json().catch(() => ({}));
					const issues = Array.isArray(payload?.issues)
						? payload.issues
								.map((i: { message: string }) => i.message)
								.join('; ')
						: null;
					message = issues ?? payload?.error ?? message;
				} else {
					const text = await res.text().catch(() => '');
					if (text) message = text;
				}
				throw new Error(message);
			}
			window.location.href = '/app';
		} catch (err) {
			setImpersonateError(
				err instanceof Error ? err.message : 'Failed to start impersonation',
			);
			setImpersonateLoading(false);
		}
	}

	const newAdminValue = !data.isPlatformAdmin;

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<Link
				href="/app/admin/platform/users"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft className="h-4 w-4" />
				All users
			</Link>

			<div className="flex flex-wrap items-start justify-between gap-3">
				<PageHeader
					title={data.name ?? data.email ?? data.id}
					description={data.email ?? ''}
				/>
				{data.isPlatformAdmin && (
					<div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
						<ShieldCheck className="h-3.5 w-3.5" />
						Platform admin
					</div>
				)}
			</div>

			<div className="flex flex-wrap gap-2">
				<Button
					variant="default"
					onClick={() => {
						setImpersonateReason('');
						setImpersonateError(null);
						setImpersonateModalOpen(true);
					}}
					disabled={data.isPlatformAdmin}
					title={
						data.isPlatformAdmin
							? 'Cannot impersonate another platform admin'
							: undefined
					}
				>
					<UserCog className="mr-2 h-4 w-4" />
					Impersonate
				</Button>
				<Button
					variant="outline"
					onClick={() => {
						setAdminReason('');
						setAdminModalOpen(true);
					}}
					disabled={data.isPlatformAdmin && currentUserId === id}
					title={
						data.isPlatformAdmin && currentUserId === id
							? 'You cannot revoke your own platform admin status'
							: undefined
					}
				>
					{data.isPlatformAdmin
						? 'Revoke platform admin'
						: 'Grant platform admin'}
				</Button>
				<Button
					variant="outline"
					onClick={() => {
						setRevokeReason('');
						setRevokeModalOpen(true);
					}}
				>
					Revoke all sessions
				</Button>
			</div>

			<Tabs value={tab} onValueChange={setTab}>
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="memberships">
						Memberships ({data.memberships.length})
					</TabsTrigger>
					<TabsTrigger value="applications">
						Applications ({data.applicationCount})
					</TabsTrigger>
					<TabsTrigger value="sessions">
						Sessions ({data.sessions.length})
					</TabsTrigger>
					<TabsTrigger value="audit">Audit</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="pt-4">
					<Card className="p-6">
						<dl className="grid gap-4 sm:grid-cols-2">
							<Field label="Id" value={data.id} />
							<Field label="Email" value={data.email ?? '—'} />
							<Field label="Name" value={data.name ?? '—'} />
							<Field
								label="Email verified"
								value={
									data.emailVerified
										? new Date(data.emailVerified).toLocaleString()
										: '—'
								}
							/>
							<Field
								label="Created"
								value={new Date(data.createdAt).toLocaleString()}
							/>
							<Field
								label="Updated"
								value={new Date(data.updatedAt).toLocaleString()}
							/>
							<Field
								label="Platform admin"
								value={data.isPlatformAdmin ? 'yes' : 'no'}
							/>
							<Field
								label="Applications submitted"
								value={data.applicationCount}
							/>
						</dl>
					</Card>
				</TabsContent>

				<TabsContent value="memberships" className="pt-4">
					<Card className="divide-y">
						{data.memberships.map((m) => (
							<Link
								key={m.id}
								href={`/app/admin/platform/orgs/${m.organization.id}`}
								className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
							>
								<div className="min-w-0 flex-1">
									<div className="font-medium truncate">
										{m.organization.name}
									</div>
									<div className="text-xs text-muted-foreground truncate">
										{m.organization.slug} · joined{' '}
										{new Date(m.createdAt).toLocaleDateString()}
									</div>
								</div>
								<div className="text-xs font-medium uppercase tracking-wide">
									{m.role}
								</div>
							</Link>
						))}
						{data.memberships.length === 0 && (
							<div className="p-6 text-sm text-muted-foreground">
								No org memberships.
							</div>
						)}
						{data.companyMemberships.length > 0 && (
							<>
								<div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Companies
								</div>
								{data.companyMemberships.map((m) => (
									<div
										key={`${m.companyId}-${m.role}`}
										className="flex items-center gap-3 px-4 py-3"
									>
										<div className="min-w-0 flex-1">
											<div className="font-medium truncate">
												{m.company.name}
											</div>
											<div className="text-xs text-muted-foreground">
												Joined {new Date(m.createdAt).toLocaleDateString()}
											</div>
										</div>
										<div className="text-xs font-medium uppercase tracking-wide">
											{m.role}
										</div>
									</div>
								))}
							</>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="applications" className="pt-4">
					<Card className="divide-y">
						{data.applications.map((a) => (
							<div
								key={a.id}
								className="flex items-center gap-3 px-4 py-3 text-sm"
							>
								<div className="min-w-0 flex-1">
									<div className="font-medium truncate">
										{a.opportunity?.title ?? '(opportunity deleted)'}
									</div>
									<Link
										href={`/app/admin/platform/orgs/${a.organization.id}`}
										className="text-xs text-muted-foreground hover:text-foreground truncate block"
									>
										{a.organization.name} · {a.organization.slug}
									</Link>
									<div className="text-xs text-muted-foreground">
										Submitted {new Date(a.submittedAt).toLocaleString()}
									</div>
								</div>
								<div className="flex flex-col items-end gap-1">
									<div className="text-xs font-medium uppercase tracking-wide">
										{a.status}
									</div>
									<div className="text-xs text-muted-foreground uppercase tracking-wide">
										{a.screeningStatus}
									</div>
								</div>
							</div>
						))}
						{data.applications.length === 0 && (
							<div className="p-6 text-sm text-muted-foreground">
								No applications submitted.
							</div>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="sessions" className="pt-4">
					<Card className="divide-y">
						{data.sessions.map((s) => {
							const expired = new Date(s.expires).getTime() < Date.now();
							return (
								<div key={s.id} className="flex items-center gap-3 px-4 py-3">
									<div className="min-w-0 flex-1">
										<div className="font-medium truncate">{s.id}</div>
										<div className="text-xs text-muted-foreground">
											Created {new Date(s.createdAt).toLocaleString()} · expires{' '}
											{new Date(s.expires).toLocaleString()}
										</div>
									</div>
									<div className="text-xs font-medium uppercase tracking-wide">
										{expired ? 'expired' : 'active'}
									</div>
								</div>
							);
						})}
						{data.sessions.length === 0 && (
							<div className="p-6 text-sm text-muted-foreground">
								No sessions.
							</div>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="audit" className="pt-4">
					<UserAuditList userId={id} />
				</TabsContent>
			</Tabs>

			{/* Grant/revoke admin */}
			<Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{newAdminValue ? 'Grant platform admin' : 'Revoke platform admin'}
						</DialogTitle>
						<DialogDescription>
							This action is logged. Provide a reason (min 5 chars).
						</DialogDescription>
					</DialogHeader>
					<Input
						placeholder="Reason"
						value={adminReason}
						onChange={(e) => setAdminReason(e.target.value)}
					/>
					{setAdminMutation.error && (
						<p className="text-sm text-destructive">
							{setAdminMutation.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setAdminModalOpen(false)}
							disabled={setAdminMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								await setAdminMutation.mutateAsync({
									id,
									value: newAdminValue,
									reason: adminReason,
								});
								setAdminModalOpen(false);
							}}
							disabled={
								adminReason.trim().length < 5 || setAdminMutation.isPending
							}
						>
							{setAdminMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Confirm
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Revoke all sessions */}
			<Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Revoke all sessions</DialogTitle>
						<DialogDescription>
							Forces the user to sign in again. Provide a reason.
						</DialogDescription>
					</DialogHeader>
					<Input
						placeholder="Reason"
						value={revokeReason}
						onChange={(e) => setRevokeReason(e.target.value)}
					/>
					{revokeSessionsMutation.error && (
						<p className="text-sm text-destructive">
							{revokeSessionsMutation.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setRevokeModalOpen(false)}
							disabled={revokeSessionsMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								await revokeSessionsMutation.mutateAsync({
									id,
									reason: revokeReason,
								});
								setRevokeModalOpen(false);
							}}
							disabled={
								revokeReason.trim().length < 5 ||
								revokeSessionsMutation.isPending
							}
						>
							{revokeSessionsMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Revoke
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Impersonate */}
			<Dialog
				open={impersonateModalOpen}
				onOpenChange={(open) => {
					setImpersonateModalOpen(open);
					if (!open) setImpersonateLoading(false);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Impersonate {data.email ?? data.id}</DialogTitle>
						<DialogDescription>
							You'll act as this user for up to 30 minutes. Every action is
							tagged in the audit log. Provide a reason (10–200 chars).
						</DialogDescription>
					</DialogHeader>
					<Input
						placeholder="e.g. ticket #482: user can't see their applications"
						value={impersonateReason}
						onChange={(e) => setImpersonateReason(e.target.value)}
					/>
					{impersonateError && (
						<p className="text-sm text-destructive">{impersonateError}</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setImpersonateModalOpen(false)}
							disabled={impersonateLoading}
						>
							Cancel
						</Button>
						<Button
							onClick={handleImpersonate}
							disabled={
								impersonateReason.trim().length < 10 ||
								impersonateReason.trim().length > 200 ||
								impersonateLoading
							}
						>
							{impersonateLoading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Start impersonation
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function UserAuditList({ userId }: { userId: string }) {
	const { data, isLoading } = trpc.platformAdmin.audit.query.useQuery({
		filters: { subjectId: userId },
		limit: 50,
	});

	if (isLoading) {
		return (
			<Card className="flex items-center justify-center p-8">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</Card>
		);
	}

	if (!data || data.rows.length === 0) {
		return (
			<Card className="p-6 text-sm text-muted-foreground">
				No audit entries.
			</Card>
		);
	}

	return (
		<Card className="divide-y">
			{data.rows.map((row) => (
				<div key={row.id} className="px-4 py-3 text-sm">
					<div className="flex items-center gap-2">
						<span className="font-medium">{row.action}</span>
						<span className="text-xs text-muted-foreground">
							{row.entityType}
							{row.entityId ? `:${row.entityId.slice(0, 8)}…` : ''}
						</span>
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						{new Date(row.createdAt).toLocaleString()} ·{' '}
						{row.organization?.slug ?? 'platform'}
					</div>
				</div>
			))}
		</Card>
	);
}
