import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLdBreadcrumb } from '@/components/json-ld-breadcrumb';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import { getPublishedOpportunityById } from '@/server/repositories/publicOpportunityRepo';
import { ApplyProviders } from '../providers';
import ApplyFormClient from './ApplyFormClient';

export async function generateMetadata({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
	const { orgSlug } = await params;
	const { org } = await getPublicFormByOrgSlug(orgSlug);
	if (!org) return { title: 'Volunteer Application' };
	return {
		title: `Volunteer Application — ${org.name}`,
		description: `Apply to volunteer with ${org.name}.`,
		openGraph: {
			title: `Volunteer Application — ${org.name}`,
			description: `Apply to volunteer with ${org.name}.`,
			images: [`/api/og/apply/${orgSlug}`],
		},
	};
}

export default async function ApplyPage({
	params,
	searchParams,
}: {
	params: Promise<{ orgSlug: string }>;
	searchParams: Promise<{ opportunityId?: string; source?: string }>;
}) {
	const { orgSlug } = await params;
	const { opportunityId, source: rawSource } = await searchParams;
	const source =
		rawSource === 'DIRECT' || rawSource === 'MARKETPLACE'
			? rawSource
			: undefined;
	const { org, questions } = await getPublicFormByOrgSlug(orgSlug);

	if (!org) {
		notFound();
	}

	const opportunity = opportunityId
		? await getPublishedOpportunityById(orgSlug, opportunityId)
		: null;

	if (questions.length === 0) {
		return (
			<div className="mx-auto max-w-2xl px-6 py-10">
				<Card>
					<CardHeader>
						<h1 className="text-2xl font-semibold">Applications paused</h1>
						<p className="text-sm text-muted-foreground">
							{org.name} is not accepting volunteer applications right now.
						</p>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Please check back soon or contact the organization directly for
							urgent volunteer opportunities.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<main className="mx-auto max-w-2xl px-6 py-10">
			<JsonLdBreadcrumb
				items={[
					{ label: 'Home', href: '/' },
					{ label: org.name, href: `/apply/${orgSlug}` },
				]}
			/>
			<h1 className="text-2xl font-semibold">Volunteer Application</h1>
			<p className="mt-2 text-muted-foreground">
				Applying to{' '}
				<span className="font-medium text-foreground">{org.name}</span>
			</p>

			<div className="mt-8">
				<ApplyProviders>
					<ApplyFormClient
						org={org}
						questions={questions}
						opportunity={opportunity ?? null}
						source={source}
					/>
				</ApplyProviders>
			</div>

			{org.showPoweredBy && (
				<footer className="mt-12 border-t border-border/50 py-6 text-center">
					<Link
						href="/screening"
						className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
					>
						Powered by <span className="font-semibold">VolunteerReady</span> —
						Free volunteer management for nonprofits
					</Link>
				</footer>
			)}
		</main>
	);
}
