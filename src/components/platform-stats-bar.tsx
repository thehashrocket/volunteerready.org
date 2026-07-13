import { getPlatformStats } from '@/server/repositories/statsRepo';

function formatStat(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
	return n.toString();
}

export async function PlatformStatsBar() {
	const stats = await getPlatformStats();

	const statItems = [
		{ label: 'Organizations', value: stats.orgCount },
		{ label: 'Verified Credentials', value: stats.credentialCount },
		{ label: 'Shifts Completed', value: stats.shiftCount },
		{ label: 'Volunteers', value: stats.volunteerCount },
	].filter((s) => s.value > 0);

	if (statItems.length === 0) return null;

	return (
		<section
			className="border-b border-border/40 bg-muted px-4 py-10"
			aria-label="Platform statistics"
		>
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 sm:gap-16">
				{statItems.map((s) => (
					<div key={s.label} className="text-center">
						<p className="font-display text-3xl font-bold text-primary">
							{formatStat(s.value)}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
					</div>
				))}
			</div>
		</section>
	);
}
