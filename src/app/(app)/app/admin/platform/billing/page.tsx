'use client';

import { ChevronLeft, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc/client';

function formatAmount(amount: number | null, currency: string | null): string {
	if (amount == null) return '—';
	const code = (currency ?? 'usd').toUpperCase();
	const dollars = amount / 100;
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: code,
		}).format(dollars);
	} catch {
		return `${dollars.toFixed(2)} ${code}`;
	}
}

function stripeCustomerUrl(customerId: string): string {
	return `https://dashboard.stripe.com/customers/${customerId}`;
}

export default function PlatformBillingPage() {
	const { data, isLoading, isError } =
		trpc.platformAdmin.billing.delinquent.useQuery({ limit: 200 });

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-6">
			<Link
				href="/app/admin/platform"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft className="h-4 w-4" />
				Platform admin
			</Link>

			<PageHeader
				title="Billing delinquency"
				description="Orgs with recorded invoice.payment_failed events from Stripe webhooks."
			/>

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			) : isError ? (
				<Card className="p-6 text-sm text-destructive">
					Failed to load billing data.
				</Card>
			) : !data || data.length === 0 ? (
				<Card className="p-6 text-sm text-muted-foreground">
					No orgs with recent payment failures.
				</Card>
			) : (
				<Card className="divide-y divide-border">
					{data.map((row) => (
						<div
							key={row.orgId}
							className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<Link
										href={`/app/admin/platform/orgs/${row.orgId}`}
										className="font-medium hover:underline truncate"
									>
										{row.name}
									</Link>
									<span className="text-xs text-muted-foreground">
										{row.slug}
									</span>
									<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
										{row.planTier}
									</span>
									{row.suspendedAt && (
										<span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
											Suspended
										</span>
									)}
								</div>
								<div className="mt-1 text-xs text-muted-foreground">
									Last failure {new Date(row.lastFailureAt).toLocaleString()} ·{' '}
									{formatAmount(row.lastFailureAmount, row.lastFailureCurrency)}{' '}
									· {row.failureCount}{' '}
									{row.failureCount === 1 ? 'failure' : 'failures'} in window
								</div>
							</div>
							<div className="flex items-center gap-3">
								<a
									href={stripeCustomerUrl(row.stripeCustomerId)}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
								>
									Stripe customer
									<ExternalLink className="h-3 w-3" />
								</a>
							</div>
						</div>
					))}
				</Card>
			)}
		</div>
	);
}
