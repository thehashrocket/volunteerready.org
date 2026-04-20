'use client';

import { ChevronLeft, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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

export default function PlatformOrgDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [tab, setTab] = useState('overview');

	const utils = trpc.useUtils();
	const { data, isLoading, isError } = trpc.platformAdmin.orgs.get.useQuery({
		id,
	});

	const suspendMutation = trpc.platformAdmin.orgs.suspend.useMutation({
		onSuccess: () => utils.platformAdmin.orgs.get.invalidate({ id }),
	});
	const unsuspendMutation = trpc.platformAdmin.orgs.unsuspend.useMutation({
		onSuccess: () => utils.platformAdmin.orgs.get.invalidate({ id }),
	});

	const [suspendModalOpen, setSuspendModalOpen] = useState(false);
	const [suspendReason, setSuspendReason] = useState('');
	const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false);
	const [unsuspendReason, setUnsuspendReason] = useState('');

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
				<Card className="p-6 text-sm text-destructive">
					Organization not found.
				</Card>
			</div>
		);
	}

	const { org, members, opportunities, applications } = data;
	const isSuspended = !!org.suspendedAt;

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<Link
				href="/app/admin/platform/orgs"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft className="h-4 w-4" />
				All organizations
			</Link>

			<div className="flex flex-wrap items-start justify-between gap-3">
				<PageHeader
					title={org.name}
					description={`${org.slug} · ${org.planTier}`}
				/>
				{isSuspended && (
					<div className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium uppercase tracking-wide text-destructive">
						<ShieldAlert className="h-3.5 w-3.5" />
						Suspended
					</div>
				)}
			</div>

			{isSuspended && (
				<Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">
					<div className="flex items-start gap-2">
						<ShieldAlert className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
						<div className="space-y-1">
							<div className="font-medium text-destructive">
								Suspended on{' '}
								{org.suspendedAt
									? new Date(org.suspendedAt).toLocaleString()
									: '—'}
							</div>
							<div className="text-muted-foreground">
								By {org.suspendedBy?.email ?? org.suspendedById ?? 'unknown'}
							</div>
							{org.suspendedReason && (
								<div className="text-foreground/80">
									Reason: {org.suspendedReason}
								</div>
							)}
						</div>
					</div>
				</Card>
			)}

			<div className="flex flex-wrap gap-2">
				{isSuspended ? (
					<Button
						variant="default"
						onClick={() => {
							setUnsuspendReason('');
							setUnsuspendModalOpen(true);
						}}
					>
						Unsuspend organization
					</Button>
				) : (
					<Button
						variant="destructive"
						onClick={() => {
							setSuspendReason('');
							setSuspendModalOpen(true);
						}}
					>
						Suspend organization
					</Button>
				)}
			</div>

			<Tabs value={tab} onValueChange={setTab}>
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="members">Members ({members.length})</TabsTrigger>
					<TabsTrigger value="opportunities">
						Opportunities ({opportunities.length})
					</TabsTrigger>
					<TabsTrigger value="applications">
						Applications ({applications.length})
					</TabsTrigger>
					<TabsTrigger value="flags">Flags</TabsTrigger>
					<TabsTrigger value="audit">Audit</TabsTrigger>
				</TabsList>

				<TabsContent value="overview" className="pt-4">
					<Card className="p-6">
						<dl className="grid gap-4 sm:grid-cols-2">
							<Field label="Slug" value={org.slug} />
							<Field label="Plan tier" value={org.planTier} />
							<Field
								label="Created"
								value={new Date(org.createdAt).toLocaleString()}
							/>
							<Field
								label="Updated"
								value={new Date(org.updatedAt).toLocaleString()}
							/>
							<Field label="Members" value={org._count.members} />
							<Field label="Opportunities" value={org._count.opportunities} />
							<Field label="Applications" value={org._count.applications} />
							<Field label="Credentials" value={org._count.credentials} />
							<Field label="Shifts" value={org._count.shifts} />
							<Field
								label="Screener questions"
								value={org._count.screenerQuestions}
							/>
							<Field
								label="Stripe customer"
								value={org.stripeCustomerId ?? '—'}
							/>
							<Field
								label="Trial ends"
								value={
									org.trialEndsAt
										? new Date(org.trialEndsAt).toLocaleString()
										: '—'
								}
							/>
							<Field label="Timezone" value={org.timezone ?? 'UTC'} />
							<Field
								label="Checkr account"
								value={org.checkrAccountId ?? '—'}
							/>
							<Field
								label="Sterling account"
								value={org.sterlingAccountId ?? '—'}
							/>
							<Field
								label="First application"
								value={
									org.firstApplicationReceivedAt
										? new Date(org.firstApplicationReceivedAt).toLocaleString()
										: '—'
								}
							/>
						</dl>
					</Card>
				</TabsContent>

				<TabsContent value="members" className="pt-4">
					<Card className="divide-y">
						{members.map((m) => (
							<Link
								key={m.id}
								href={`/app/admin/platform/users/${m.user.id}`}
								className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
							>
								<div className="min-w-0 flex-1">
									<div className="font-medium truncate">
										{m.user.name ?? m.user.email ?? m.user.id}
									</div>
									<div className="text-xs text-muted-foreground truncate">
										{m.user.email}
									</div>
								</div>
								<div className="text-xs font-medium uppercase tracking-wide">
									{m.role}
								</div>
							</Link>
						))}
						{members.length === 0 && (
							<div className="p-6 text-sm text-muted-foreground">
								No members.
							</div>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="opportunities" className="pt-4">
					<Card className="divide-y">
						{opportunities.map((o) => (
							<div key={o.id} className="flex items-center gap-3 px-4 py-3">
								<div className="min-w-0 flex-1">
									<div className="font-medium truncate">{o.title}</div>
									<div className="text-xs text-muted-foreground">
										Created {new Date(o.createdAt).toLocaleDateString()}
									</div>
								</div>
								<div className="text-xs font-medium uppercase tracking-wide">
									{o.status}
								</div>
							</div>
						))}
						{opportunities.length === 0 && (
							<div className="p-6 text-sm text-muted-foreground">
								No opportunities.
							</div>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="applications" className="pt-4">
					<Card className="divide-y">
						{applications.map((a) => (
							<div key={a.id} className="flex items-center gap-3 px-4 py-3">
								<div className="min-w-0 flex-1">
									<div className="font-medium truncate">
										{a.submittedByEmail}
									</div>
									<div className="text-xs text-muted-foreground truncate">
										{a.opportunity?.title ?? '—'} · submitted{' '}
										{new Date(a.submittedAt).toLocaleString()}
									</div>
								</div>
								<div className="flex gap-2 text-xs font-medium uppercase tracking-wide">
									<span className="rounded-full bg-muted px-2 py-0.5">
										{a.status}
									</span>
									<span className="rounded-full bg-muted px-2 py-0.5">
										{a.screeningStatus}
									</span>
								</div>
							</div>
						))}
						{applications.length === 0 && (
							<div className="p-6 text-sm text-muted-foreground">
								No applications.
							</div>
						)}
					</Card>
				</TabsContent>

				<TabsContent value="flags" className="pt-4">
					<OrgFlagsPanel orgId={org.id} />
				</TabsContent>

				<TabsContent value="audit" className="pt-4">
					<OrgAuditList orgId={org.id} />
				</TabsContent>
			</Tabs>

			<Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Suspend {org.name}</DialogTitle>
						<DialogDescription>
							Members lose access to org-scoped features until unsuspended.
							Action is logged. Reason must be 10–500 chars.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="e.g. payment failed 3x; awaiting chargeback resolution"
						value={suspendReason}
						onChange={(e) => setSuspendReason(e.target.value)}
						rows={3}
					/>
					{suspendMutation.error && (
						<p className="text-sm text-destructive">
							{suspendMutation.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setSuspendModalOpen(false)}
							disabled={suspendMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={async () => {
								await suspendMutation.mutateAsync({
									id,
									reason: suspendReason,
								});
								setSuspendModalOpen(false);
							}}
							disabled={
								suspendReason.trim().length < 10 || suspendMutation.isPending
							}
						>
							{suspendMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Suspend
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={unsuspendModalOpen} onOpenChange={setUnsuspendModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unsuspend {org.name}</DialogTitle>
						<DialogDescription>
							Restores org-scoped access for all members. Provide a reason (min
							5 chars).
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="e.g. payment cleared; ticket #482 resolved"
						value={unsuspendReason}
						onChange={(e) => setUnsuspendReason(e.target.value)}
						rows={3}
					/>
					{unsuspendMutation.error && (
						<p className="text-sm text-destructive">
							{unsuspendMutation.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setUnsuspendModalOpen(false)}
							disabled={unsuspendMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								await unsuspendMutation.mutateAsync({
									id,
									reason: unsuspendReason,
								});
								setUnsuspendModalOpen(false);
							}}
							disabled={
								unsuspendReason.trim().length < 5 || unsuspendMutation.isPending
							}
						>
							{unsuspendMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Unsuspend
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function OrgFlagsPanel({ orgId }: { orgId: string }) {
	const utils = trpc.useUtils();
	const { data, isLoading, isError } = trpc.platformAdmin.flags.list.useQuery({
		orgId,
	});

	const setMutation = trpc.platformAdmin.flags.set.useMutation({
		onSuccess: () => utils.platformAdmin.flags.list.invalidate({ orgId }),
	});

	const [reasonModal, setReasonModal] = useState<{
		key: string;
		label: string;
		nextEnabled: boolean;
	} | null>(null);
	const [reason, setReason] = useState('');

	if (isLoading) {
		return (
			<Card className="flex items-center justify-center p-8">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</Card>
		);
	}

	if (isError || !data) {
		return (
			<Card className="p-6 text-sm text-destructive">
				Failed to load feature flags.
			</Card>
		);
	}

	return (
		<>
			<Card className="divide-y">
				{data.map((flag) => (
					<div
						key={flag.key}
						className="flex items-start justify-between gap-4 px-4 py-4"
					>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-medium">{flag.label}</span>
								<code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{flag.key}
								</code>
								{!flag.hasOverride && (
									<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
										default
									</span>
								)}
							</div>
							<div className="mt-1 text-sm text-muted-foreground">
								{flag.description}
							</div>
							{flag.hasOverride && flag.updatedAt && (
								<div className="mt-1 text-xs text-muted-foreground">
									Last changed {new Date(flag.updatedAt).toLocaleString()}
									{flag.updatedBy?.email ? ` · by ${flag.updatedBy.email}` : ''}
								</div>
							)}
						</div>
						<div className="flex items-center pt-1">
							<Switch
								checked={flag.enabled}
								disabled={setMutation.isPending}
								onCheckedChange={(next) => {
									setReason('');
									setReasonModal({
										key: flag.key,
										label: flag.label,
										nextEnabled: next,
									});
								}}
							/>
						</div>
					</div>
				))}
			</Card>

			<Dialog
				open={!!reasonModal}
				onOpenChange={(open) => {
					if (!open) setReasonModal(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{reasonModal?.nextEnabled ? 'Enable' : 'Disable'}{' '}
							{reasonModal?.label}
						</DialogTitle>
						<DialogDescription>
							This change is logged. Provide a reason (min 5 chars).
						</DialogDescription>
					</DialogHeader>
					<Textarea
						placeholder="e.g. enabling beta dashboard for pilot org"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						rows={3}
					/>
					{setMutation.error && (
						<p className="text-sm text-destructive">
							{setMutation.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setReasonModal(null)}
							disabled={setMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={async () => {
								if (!reasonModal) return;
								await setMutation.mutateAsync({
									orgId,
									key: reasonModal.key,
									enabled: reasonModal.nextEnabled,
									reason,
								});
								setReasonModal(null);
							}}
							disabled={reason.trim().length < 5 || setMutation.isPending}
						>
							{setMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Confirm
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function OrgAuditList({ orgId }: { orgId: string }) {
	const { data, isLoading } = trpc.platformAdmin.audit.query.useQuery({
		filters: { orgId },
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
						{row.actor?.email ?? 'system'}
					</div>
				</div>
			))}
		</Card>
	);
}
