import type { Metadata } from 'next';
import { ApplyProviders } from '../providers';
import StatusClient from './status-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
	title: 'Application status',
	description: 'Check the status of your volunteer application.',
};

export default function ApplyStatusPage({
	searchParams,
}: {
	searchParams: { token?: string };
}) {
	return (
		<main className="mx-auto max-w-2xl px-6 py-10">
			<h1 className="text-2xl font-semibold">Check application status</h1>
			<p className="mt-2 text-muted-foreground">
				Enter your email to receive a one-time link, or open the link you were
				emailed.
			</p>

			<div className="mt-8">
				<ApplyProviders>
					<StatusClient token={searchParams.token ?? null} />
				</ApplyProviders>
			</div>
		</main>
	);
}
