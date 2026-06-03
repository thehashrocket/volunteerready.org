'use client';

import { Globe, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { ActivityFeed } from '@/components/app/activity-feed';
import { FeedbackAdminNotice } from '@/components/app/feedback-admin-notice';
import { OnboardingChecklist } from '@/components/app/onboarding-checklist';
import { OrgHealthWidget } from '@/components/app/org-health-widget';
import { ReferralPrompt } from '@/components/app/referral-prompt';
import { VolunteerDashboard } from '@/components/app/volunteer-dashboard';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc/client';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
	const { data: session, status } = useSession();

	if (status === 'loading') {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-48" />
				<div className="flex gap-6">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-16 flex-1" />
					))}
				</div>
				<div className="grid gap-6 lg:grid-cols-12">
					<Skeleton className="h-64 rounded-xl lg:col-span-8" />
					<Skeleton className="h-64 rounded-xl lg:col-span-4" />
				</div>
			</div>
		);
	}

	const hasOrgContext = Boolean(session?.orgId);

	if (!hasOrgContext) {
		return <VolunteerDashboard />;
	}

	return <StaffDashboard />;
}

// ---------------------------------------------------------------------------
// KPI Rail
// ---------------------------------------------------------------------------

function KpiItem({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex-1 min-w-0">
			<div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">
				{value}
			</div>
			<div className="text-xs text-muted-foreground truncate">{label}</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Marketplace activation banner
// ---------------------------------------------------------------------------

function MarketplaceActivationBanner() {
	const [dismissed, setDismissed] = useState(false);
	const orgQuery = trpc.org.getCurrentOrg.useQuery();

	// Only show when org is loaded and not yet on the marketplace
	if (dismissed || orgQuery.isLoading || orgQuery.data?.marketplaceVisible) {
		return null;
	}

	return (
		<div className="relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
			<Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
			<div className="flex-1">
				<span className="font-medium text-foreground">
					Get discovered by volunteers —{' '}
				</span>
				<span className="text-muted-foreground">
					list your org on the public marketplace so anyone can find your
					opportunities.{' '}
				</span>
				<Link
					href="/app/settings/team#marketplace"
					className="font-medium text-primary underline-offset-2 hover:underline"
				>
					Enable marketplace listing
				</Link>
			</div>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				aria-label="Dismiss"
				className="text-muted-foreground hover:text-foreground"
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Staff dashboard (org context required)
// ---------------------------------------------------------------------------

function StaffDashboard() {
	const { data, isLoading } = trpc.screener.getDashboardStats.useQuery();

	return (
		<div className="space-y-6">
			{/* ── Feedback admin notice (platform admins only) ── */}
			<FeedbackAdminNotice />

			{/* ── Marketplace activation banner ── */}
			<MarketplaceActivationBanner />

			<PageHeader
				title="Dashboard"
				description="Track activity across your organization."
				actions={
					<Button size="sm" asChild>
						<Link href="/app/opportunities">
							<Plus className="mr-2 h-4 w-4" />
							New opportunity
						</Link>
					</Button>
				}
			/>

			{/* ── KPI Rail ── */}
			{isLoading ? (
				<div className="flex gap-6">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-14 flex-1" />
					))}
				</div>
			) : (
				<div className="flex gap-6 border-b border-border/60 pb-6">
					<KpiItem
						label="Published opportunities"
						value={data?.opportunities.published ?? 0}
					/>
					<KpiItem
						label="Total applications"
						value={data?.applications.total ?? 0}
					/>
					<KpiItem label="In review" value={data?.applications.review ?? 0} />
					<KpiItem label="Approved" value={data?.applications.approved ?? 0} />
				</div>
			)}

			{/* ── 8/4 Grid: Primary workspace + Secondary context ── */}
			<div className="grid gap-6 lg:grid-cols-12">
				{/* Primary workspace (8-col) */}
				<div className="space-y-6 lg:col-span-8">
					<ActivityFeed />
				</div>

				{/* Secondary context (4-col) */}
				<div className="space-y-6 lg:col-span-4">
					{!isLoading && data?.health && (
						<OrgHealthWidget health={data.health} />
					)}

					{!isLoading && data?.onboarding && (
						<OnboardingChecklist onboarding={data.onboarding} />
					)}
				</div>
			</div>

			{/* ── Referral prompt (shows after first background check) ── */}
			{!isLoading && data?.onboarding && (
				<ReferralPrompt
					orgSlug={data.onboarding.orgSlug}
					backgroundCheckCompleteCount={
						data.onboarding.backgroundCheckCompleteCount
					}
				/>
			)}
		</div>
	);
}
