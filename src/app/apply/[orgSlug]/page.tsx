import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getPublicFormByOrgSlug } from '@/server/repositories/publicApplyRepo';
import ApplyFormClient from './ApplyFormClient';

export default async function ApplyPage({
	params,
}: {
	params: Promise<{ orgSlug: string }>;
}) {
	const { orgSlug } = await params;
	const { org, questions } = await getPublicFormByOrgSlug(orgSlug);

	if (!org) {
		notFound();
	}

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
			<h1 className="text-2xl font-semibold">Volunteer Application</h1>
			<p className="mt-2 text-muted-foreground">
				Applying to{' '}
				<span className="font-medium text-foreground">{org.name}</span>
			</p>

			<div className="mt-8">
				<ApplyFormClient org={org} questions={questions} />
			</div>
		</main>
	);
}
