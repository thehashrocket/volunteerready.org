'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
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

export default function PlatformOrgDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [tab, setTab] = useState('overview');

	const { data, isLoading, isError } = trpc.platformAdmin.orgs.get.useQuery({
		id,
	});

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

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<Link
				href="/app/admin/platform/orgs"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft className="h-4 w-4" />
				All organizations
			</Link>

			<PageHeader
				title={org.name}
				description={`${org.slug} · ${org.planTier}`}
			/>

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

				<TabsContent value="audit" className="pt-4">
					<OrgAuditList orgId={org.id} />
				</TabsContent>
			</Tabs>
		</div>
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
