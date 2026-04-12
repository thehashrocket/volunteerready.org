import { PlatformStatsBar } from '@/components/platform-stats-bar';

type LocalProofProps = {
	nonprofitCount: number;
	nonprofitCountSource: string;
	namedOrgs: string[];
	localContext: string;
};

export function LocalProofSection({
	nonprofitCount,
	nonprofitCountSource,
	namedOrgs,
	localContext,
}: LocalProofProps) {
	return (
		<section className="bg-muted/50 px-4 py-16">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
					<div className="shrink-0 text-center sm:text-left">
						<p className="font-display text-5xl font-bold text-primary">
							{nonprofitCount.toLocaleString()}+
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							nonprofits in the area
						</p>
						<p className="text-xs text-muted-foreground/70">
							Source: {nonprofitCountSource}
						</p>
					</div>
					<div>
						<p className="mb-3 text-sm leading-relaxed text-muted-foreground">
							{localContext}
						</p>
						{namedOrgs.length > 0 && (
							<p className="text-sm text-foreground">
								Organizations like{' '}
								{namedOrgs.length > 1
									? `${namedOrgs.slice(0, -1).join(', ')} and ${namedOrgs[namedOrgs.length - 1]}`
									: namedOrgs[0]}{' '}
								are part of this landscape.
							</p>
						)}
					</div>
				</div>
				<PlatformStatsBar />
			</div>
		</section>
	);
}
